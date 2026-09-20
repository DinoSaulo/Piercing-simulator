import { config } from './config.ts'
import { HttpError } from './http.ts'
import { supabase } from './supabase.ts'

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
}

export function isSupportedImage(mimetype: string): boolean {
  return Object.hasOwn(EXTENSION_BY_MIME, mimetype)
}

// Caminho particionado por ano/mês para a listagem no painel do Supabase não
// virar uma pasta única com milhares de arquivos.
function buildObjectPath(mimetype: string): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const extension = EXTENSION_BY_MIME[mimetype] ?? 'bin'
  return `${year}/${month}/${crypto.randomUUID()}.${extension}`
}

export interface StoredImage {
  path: string
  bucket: string
  mimetype: string
  size: number
}

/**
 * Remove um objeto já enviado.
 *
 * Usado para desfazer o upload quando o insert seguinte falha. A falha da
 * remoção é só registrada: quem chama está tratando um erro anterior, e
 * sobrepor esse erro por causa da limpeza esconderia a causa real.
 */
export async function removeImage(objectPath: string): Promise<void> {
  const { error } = await supabase.storage.from(config.storageBucket).remove([objectPath])

  if (error) {
    console.error(`[storage] órfão em ${config.storageBucket}/${objectPath}: ${error.message}`)
  }
}

export async function uploadImage(file: File): Promise<StoredImage> {
  if (!isSupportedImage(file.type)) {
    throw new HttpError(`Formato de imagem não suportado: ${file.type || 'desconhecido'}`)
  }

  if (file.size === 0) {
    throw new HttpError('Imagem vazia.')
  }

  if (file.size > config.maxUploadBytes) {
    const limit = Math.round(config.maxUploadBytes / 1024 / 1024)
    throw new HttpError(`Imagem maior que o limite de ${limit}MB.`, 413)
  }

  const objectPath = buildObjectPath(file.type)

  const { error } = await supabase.storage
    .from(config.storageBucket)
    .upload(objectPath, file, { contentType: file.type, upsert: false })

  if (error) {
    throw new Error(`Falha ao enviar imagem para o storage: ${error.message}`)
  }

  return {
    path: objectPath,
    bucket: config.storageBucket,
    mimetype: file.type,
    size: file.size,
  }
}

/**
 * Gera uma URL temporária por imagem em uma única chamada.
 *
 * Vale para quem tiver o link, sem autenticação, até expirar — por isso a
 * resposta do painel é `no-store` e o prazo é curto.
 */
export async function signImageUrls(paths: string[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>()
  if (paths.length === 0) return signed

  const { data, error } = await supabase.storage
    .from(config.storageBucket)
    .createSignedUrls(paths, config.signedUrlSeconds)

  if (error) {
    console.error(`[storage] falha ao assinar URLs: ${error.message}`)
    return signed
  }

  for (const item of data ?? []) {
    // Arquivo apagado do bucket mas ainda referenciado na tabela: o painel
    // mostra a linha sem miniatura em vez de derrubar a listagem inteira.
    if (item.path && item.signedUrl && !item.error) {
      signed.set(item.path, item.signedUrl)
    }
  }

  return signed
}
