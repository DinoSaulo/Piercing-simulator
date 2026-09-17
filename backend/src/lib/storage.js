import { randomUUID } from 'node:crypto'
import { config } from '../config.js'
import { supabase } from './supabase.js'

const EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
}

export function isSupportedImage(mimetype) {
  return Object.hasOwn(EXTENSION_BY_MIME, mimetype)
}

// Caminho particionado por ano/mes para a listagem no painel do Supabase nao
// virar uma pasta unica com milhares de arquivos.
function buildObjectPath(mimetype) {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const extension = EXTENSION_BY_MIME[mimetype] ?? 'bin'
  return `${year}/${month}/${randomUUID()}.${extension}`
}

export async function uploadImage(file) {
  const objectPath = buildObjectPath(file.mimetype)

  const { error } = await supabase.storage
    .from(config.storageBucket)
    .upload(objectPath, file.buffer, { contentType: file.mimetype, upsert: false })

  if (error) {
    throw new Error(`Falha ao enviar imagem para o storage: ${error.message}`)
  }

  return {
    path: objectPath,
    bucket: config.storageBucket,
    mimetype: file.mimetype,
    size: file.size,
  }
}
