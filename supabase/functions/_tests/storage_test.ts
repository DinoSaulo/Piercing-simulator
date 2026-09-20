// fetch_fake.ts antes de qualquer import da funcao. Ver o cabecalho dele.
import {
  jsonResponse,
  onRequest,
  requestsTo,
  requireRequest,
  resetFake,
} from './support/fetch_fake.ts'

import { assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { HttpError } from '../api/http.ts'
import { isSupportedImage, removeImage, signImageUrls, uploadImage } from '../api/storage.ts'

// Alinhado com .env.test.
const BUCKET = 'simulations-test'
const LIMITE = 1024 * 1024

function imagem(mime = 'image/jpeg', bytes = 32, nome = 'foto.jpg'): File {
  return new File([new Uint8Array(bytes)], nome, { type: mime })
}

function aceitaUpload(): void {
  onRequest('POST', `/storage/v1/object/${BUCKET}`, (request) =>
    jsonResponse({ Key: request.path.replace('/storage/v1/object/', '') })
  )
}

async function capturandoErros(corpo: () => Promise<void>): Promise<string[]> {
  const original = console.error
  const linhas: string[] = []
  console.error = (...args: unknown[]) => linhas.push(args.map(String).join(' '))

  try {
    await corpo()
  } finally {
    console.error = original
  }
  return linhas
}

// ---------------------------------------------------------------------------
// Formatos aceitos
// ---------------------------------------------------------------------------

Deno.test('reconhece os formatos de imagem suportados', () => {
  for (const mime of [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/avif',
  ]) {
    assertEquals(isSupportedImage(mime), true, `${mime} deveria ser aceito`)
  }
})

Deno.test('recusa o que nao e imagem suportada', () => {
  for (const mime of ['application/pdf', 'text/html', 'image/bmp', 'image/svg+xml', '']) {
    assertEquals(isSupportedImage(mime), false, `${mime} nao deveria ser aceito`)
  }
})

Deno.test('isSupportedImage nao herda propriedades de Object.prototype', () => {
  // Object.hasOwn em vez de `in`: "constructor" e "toString" nao podem passar.
  assertEquals(isSupportedImage('constructor'), false)
  assertEquals(isSupportedImage('toString'), false)
})

// ---------------------------------------------------------------------------
// uploadImage — guardas
// ---------------------------------------------------------------------------

Deno.test('recusa formato nao suportado antes de tocar na rede', async () => {
  resetFake()

  const error = await assertRejects(() => uploadImage(imagem('application/pdf')), HttpError)

  assertEquals(error.status, 400)
  assertEquals(error.message.includes('application/pdf'), true)
  assertEquals(requestsTo('POST', '/storage/v1').length, 0)
})

Deno.test('arquivo sem tipo aparece como "desconhecido" na mensagem', async () => {
  resetFake()

  const error = await assertRejects(() => uploadImage(new File([new Uint8Array(4)], 'x')), HttpError)

  assertEquals(error.message.includes('desconhecido'), true)
})

Deno.test('recusa imagem vazia', async () => {
  resetFake()

  const error = await assertRejects(() => uploadImage(imagem('image/png', 0)), HttpError)

  assertEquals(error.status, 400)
  assertEquals(error.message, 'Imagem vazia.')
})

Deno.test('recusa imagem acima do limite com status 413', async () => {
  resetFake()

  const error = await assertRejects(() => uploadImage(imagem('image/jpeg', LIMITE + 1)), HttpError)

  assertEquals(error.status, 413)
  assertEquals(error.message.includes('1MB'), true)
  assertEquals(requestsTo('POST', '/storage/v1').length, 0)
})

Deno.test('aceita imagem exatamente no limite', async () => {
  resetFake()
  aceitaUpload()

  const stored = await uploadImage(imagem('image/jpeg', LIMITE))

  assertEquals(stored.size, LIMITE)
})

// ---------------------------------------------------------------------------
// uploadImage — caminho feliz
// ---------------------------------------------------------------------------

Deno.test('devolve caminho particionado por ano/mes com uuid e extensao', async () => {
  resetFake()
  aceitaUpload()

  const stored = await uploadImage(imagem('image/jpeg', 64))

  const agora = new Date()
  const ano = agora.getUTCFullYear()
  const mes = String(agora.getUTCMonth() + 1).padStart(2, '0')

  assertEquals(
    new RegExp(`^${ano}/${mes}/[0-9a-f-]{36}\\.jpg$`).test(stored.path),
    true,
    `caminho inesperado: ${stored.path}`
  )
  assertEquals(stored.bucket, BUCKET)
  assertEquals(stored.mimetype, 'image/jpeg')
  assertEquals(stored.size, 64)
})

Deno.test('cada mime vira a extensao correspondente', async () => {
  const esperado: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/avif': 'avif',
  }

  for (const [mime, extensao] of Object.entries(esperado)) {
    resetFake()
    aceitaUpload()

    const stored = await uploadImage(imagem(mime, 16))
    assertEquals(stored.path.endsWith(`.${extensao}`), true, `${mime} virou ${stored.path}`)
  }
})

Deno.test('dois envios seguidos nao colidem de caminho', async () => {
  resetFake()
  aceitaUpload()

  const primeiro = await uploadImage(imagem('image/png', 16))
  const segundo = await uploadImage(imagem('image/png', 16))

  assertEquals(primeiro.path === segundo.path, false)
})

Deno.test('o upload vai para o bucket configurado, sem sobrescrever', async () => {
  resetFake()
  aceitaUpload()

  const stored = await uploadImage(imagem('image/webp', 16))
  const enviada = requireRequest('POST', `/storage/v1/object/${BUCKET}`)

  assertEquals(enviada.path, `/storage/v1/object/${BUCKET}/${stored.path}`)
  // upsert: false vira x-upsert: false — dois envios nunca se sobrepoem.
  assertEquals(enviada.headers.get('x-upsert'), 'false')
})

Deno.test('falha do storage vira erro interno, nao HttpError', async () => {
  resetFake()
  onRequest('POST', `/storage/v1/object/${BUCKET}`, () =>
    jsonResponse({ message: 'bucket inexistente' }, { status: 400 })
  )

  const error = await assertRejects(() => uploadImage(imagem()), Error)

  assertEquals(error instanceof HttpError, false)
  assertEquals(error.message.includes('Falha ao enviar imagem para o storage'), true)
})

// ---------------------------------------------------------------------------
// removeImage — desfazer o upload
// ---------------------------------------------------------------------------

Deno.test('removeImage apaga o objeto no bucket configurado', async () => {
  resetFake()
  onRequest('DELETE', `/storage/v1/object/${BUCKET}`, () => jsonResponse([{ name: 'x' }]))

  await removeImage('2026/09/abc.jpg')

  const apagada = requireRequest('DELETE', `/storage/v1/object/${BUCKET}`)
  assertEquals(JSON.parse(apagada.body), { prefixes: ['2026/09/abc.jpg'] })
})

Deno.test('falha ao remover e apenas registrada — nao sobrepoe o erro original', async () => {
  // Quem chama removeImage ja esta tratando outro erro; lancar aqui esconderia
  // a causa real.
  resetFake()
  onRequest('DELETE', `/storage/v1/object/${BUCKET}`, () =>
    jsonResponse({ message: 'sem permissao' }, { status: 403 })
  )

  const logs = await capturandoErros(() => removeImage('2026/09/abc.jpg'))

  assertEquals(logs.length, 1)
  assertEquals(logs[0].includes('[storage]'), true)
  assertEquals(logs[0].includes('2026/09/abc.jpg'), true)
})

// ---------------------------------------------------------------------------
// signImageUrls — miniaturas do painel
// ---------------------------------------------------------------------------

function assinaturaPara(caminhos: string[], comErro: string[] = []): void {
  onRequest('POST', `/storage/v1/object/sign/${BUCKET}`, () =>
    jsonResponse(
      caminhos.map((caminho) => ({
        error: comErro.includes(caminho) ? 'nao encontrado' : null,
        path: caminho,
        signedURL: comErro.includes(caminho)
          ? null
          : `/object/sign/${BUCKET}/${caminho}?token=tok-${caminho}`,
      }))
    )
  )
}

Deno.test('lista vazia nao chama o storage', async () => {
  resetFake()

  assertEquals((await signImageUrls([])).size, 0)
  assertEquals(requestsTo('POST', '/storage/v1').length, 0)
})

Deno.test('mapeia cada caminho para sua URL assinada', async () => {
  resetFake()
  assinaturaPara(['a.jpg', 'b.png'])

  const urls = await signImageUrls(['a.jpg', 'b.png'])

  assertEquals(urls.size, 2)
  assertEquals(urls.get('a.jpg')?.includes('token=tok-a.jpg'), true)
  assertEquals(urls.get('b.png')?.includes('token=tok-b.png'), true)
})

Deno.test('as URLs sao assinadas em uma unica chamada', async () => {
  resetFake()
  assinaturaPara(['a.jpg', 'b.png', 'c.webp'])

  await signImageUrls(['a.jpg', 'b.png', 'c.webp'])

  assertEquals(requestsTo('POST', `/storage/v1/object/sign/${BUCKET}`).length, 1)
})

Deno.test('o prazo de validade vem da configuracao', async () => {
  resetFake()
  assinaturaPara(['a.jpg'])

  await signImageUrls(['a.jpg'])

  assertEquals(JSON.parse(requireRequest('POST', `/storage/v1/object/sign/${BUCKET}`).body), {
    expiresIn: 600,
    paths: ['a.jpg'],
  })
})

Deno.test('arquivo apagado do bucket some do mapa, sem derrubar os outros', async () => {
  // O painel mostra a linha sem miniatura em vez de perder a listagem inteira.
  resetFake()
  assinaturaPara(['a.jpg', 'sumiu.jpg'], ['sumiu.jpg'])

  const urls = await signImageUrls(['a.jpg', 'sumiu.jpg'])

  assertEquals(urls.size, 1)
  assertEquals(urls.has('a.jpg'), true)
  assertEquals(urls.has('sumiu.jpg'), false)
})

Deno.test('falha geral da assinatura devolve mapa vazio e registra o erro', async () => {
  resetFake()
  onRequest('POST', `/storage/v1/object/sign/${BUCKET}`, () =>
    jsonResponse({ message: 'indisponivel' }, { status: 500 })
  )

  let urls = new Map<string, string>()
  const logs = await capturandoErros(async () => {
    urls = await signImageUrls(['a.jpg'])
  })

  assertEquals(urls.size, 0)
  assertEquals(logs.length, 1)
  assertEquals(logs[0].includes('[storage]'), true)
})
