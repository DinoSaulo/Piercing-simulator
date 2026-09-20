import { config } from '../config.ts'
import { HttpError, json } from '../http.ts'
import { removeImage, uploadImage } from '../storage.ts'
import { supabase } from '../supabase.ts'
import { parseSimulationForm } from '../validation.ts'

export async function handleSimulate(req: Request): Promise<Response> {
  // `formData()` carrega o corpo inteiro na memória (o limite da função é
  // 256MB). Rejeitar pelo content-length antes disso evita gastar memória com
  // um envio que já sabemos que será recusado; a folga de 20% cobre o overhead
  // das fronteiras do multipart.
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > config.maxUploadBytes * 1.2) {
    const limit = Math.round(config.maxUploadBytes / 1024 / 1024)
    throw new HttpError(`Imagem maior que o limite de ${limit}MB.`, 413)
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    throw new HttpError('Envie o formulário como multipart/form-data.')
  }

  const payload = parseSimulationForm(form)

  const image = form.get('image')
  if (!(image instanceof File)) {
    throw new HttpError('Imagem obrigatória.')
  }

  const stored = await uploadImage(image)

  // Storage e banco não compartilham transação: se o insert falhar depois do
  // upload, a imagem fica no bucket sem nenhuma linha apontando para ela. O
  // catch desfaz o upload para o bucket não acumular lixo.
  try {
    const { data, error } = await supabase
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
        user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
      })
      .select('id, created_at')
      .single()

    if (error) {
      throw new Error(`Falha ao gravar a simulação: ${error.message}`)
    }

    return json(req, { ok: true, id: data.id, createdAt: data.created_at })
  } catch (error) {
    await removeImage(stored.path)
    throw error
  }
}
