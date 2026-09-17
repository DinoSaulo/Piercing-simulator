import { Router } from 'express'
import multer from 'multer'
import { config } from '../config.js'
import { supabase } from '../lib/supabase.js'
import { isSupportedImage, removeImage, uploadImage } from '../lib/storage.js'
import { ValidationError, parseSimulationBody } from '../lib/validation.js'

// memoryStorage: o arquivo vai direto do request para o Supabase Storage,
// sem nunca tocar o disco desta maquina.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter(_req, file, cb) {
    if (!isSupportedImage(file.mimetype)) {
      cb(new ValidationError(`Formato de imagem nao suportado: ${file.mimetype}`))
      return
    }
    cb(null, true)
  },
})

export const simulateRouter = Router()

simulateRouter.post('/simulate', upload.single('image'), async (req, res, next) => {
  try {
    const payload = parseSimulationBody(req.body)

    if (!req.file) {
      throw new ValidationError('Imagem obrigatoria.')
    }

    const stored = await uploadImage(req.file)

    // Storage e banco nao compartilham transacao: se o insert falhar depois do
    // upload, a imagem fica no bucket sem nenhuma linha apontando para ela. O
    // catch desfaz o upload para o bucket nao acumular lixo.
    let data
    try {
      const result = await supabase
        .from('simulations')
        .insert({
          gender: payload.gender,
          gender_other: payload.genderOther,
          body_part: payload.bodyPart,
          body_part_other: payload.bodyPartOther,
          piercing_style: payload.style,
          storage_bucket: stored.bucket,
          image_path: stored.path,
          image_mime: stored.mimetype,
          image_size: stored.size,
          consent_given: payload.consent,
          user_agent: req.get('user-agent')?.slice(0, 500) ?? null,
        })
        .select('id, created_at')
        .single()

      if (result.error) {
        throw new Error(`Falha ao gravar a simulacao: ${result.error.message}`)
      }
      data = result.data
    } catch (error) {
      await removeImage(stored.path)
      throw error
    }

    res.status(200).json({ ok: true, id: data.id, createdAt: data.created_at })
  } catch (error) {
    next(error)
  }
})
