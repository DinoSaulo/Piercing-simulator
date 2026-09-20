// fetch_fake.ts antes de qualquer import da funcao. Ver o cabecalho dele.
import {
  jsonResponse,
  onRequest,
  postgrestError,
  requestsTo,
  requireRequest,
  resetFake,
} from './support/fetch_fake.ts'

import { assertEquals } from 'jsr:@std/assert@1'
import { handler } from '../api/handler.ts'

const BUCKET = 'simulations-test'
const LIMITE = 1024 * 1024

const LINHA_CRIADA = { id: 'sim-1', created_at: '2026-09-20T12:00:00.000Z' }

function formularioValido(overrides: Record<string, string> = {}): FormData {
  const form = new FormData()
  const campos = {
    gender: 'Feminino',
    bodyPart: 'Clítoris',
    style: 'vch',
    consent: 'true',
    ...overrides,
  }
  for (const [nome, valor] of Object.entries(campos)) form.append(nome, valor)
  form.append('image', new File([new Uint8Array(128)], 'foto.png', { type: 'image/png' }))
  return form
}

function envio(body: BodyInit, headers: Record<string, string> = {}): Request {
  return new Request('http://127.0.0.1/api/simulate', { method: 'POST', body, headers })
}

function aceitaUpload(): void {
  onRequest('POST', `/storage/v1/object/${BUCKET}`, (request) =>
    jsonResponse({ Key: request.path.replace('/storage/v1/object/', '') })
  )
}

function aceitaInsert(): void {
  onRequest('POST', '/rest/v1/simulations', () => jsonResponse(LINHA_CRIADA, { status: 201 }))
}

async function semRuido<T>(acao: () => Promise<T>): Promise<T> {
  const original = console.error
  console.error = () => {}
  try {
    return await acao()
  } finally {
    console.error = original
  }
}

function cenarioCompleto(): void {
  resetFake()
  aceitaUpload()
  aceitaInsert()
}

// ---------------------------------------------------------------------------
// Limite de tamanho declarado
// ---------------------------------------------------------------------------

Deno.test('corpo maior que a folga do limite e recusado antes de ser lido', async () => {
  // A guarda olha o tamanho DECLARADO, nao o corpo: formData() carregaria tudo
  // na memoria, e recusar antes disso e justamente o ponto. Por isso o teste
  // envia um corpo minusculo com um content-length grande.
  resetFake()

  const declarado = String(Math.floor(LIMITE * 1.2) + 1)
  const response = await handler(
    envio('x', { 'content-type': 'text/plain', 'content-length': declarado })
  )

  assertEquals(response.status, 413)
  assertEquals((await response.json()).error.includes('1MB'), true)
  assertEquals(requestsTo('POST', '/storage/v1').length, 0)
})

Deno.test('tamanho declarado dentro da folga nao dispara a guarda', async () => {
  // Exatamente no limite da folga: passa da guarda e so entao falha no parse.
  resetFake()

  const declarado = String(Math.floor(LIMITE * 1.2))
  const response = await handler(
    envio('x', { 'content-type': 'text/plain', 'content-length': declarado })
  )

  assertEquals(response.status, 400)
})

Deno.test('ausencia de content-length nao bloqueia o envio', async () => {
  cenarioCompleto()

  assertEquals((await handler(envio(formularioValido()))).status, 200)
})

Deno.test('corpo dentro da folga de 20% passa da guarda inicial', async () => {
  // A folga cobre o overhead das fronteiras do multipart.
  cenarioCompleto()

  const response = await handler(envio(formularioValido()))

  assertEquals(response.status, 200)
})

// ---------------------------------------------------------------------------
// Corpo malformado
// ---------------------------------------------------------------------------

Deno.test('corpo que nao e multipart responde 400', async () => {
  resetFake()

  const response = await handler(
    envio(JSON.stringify({ gender: 'Feminino' }), { 'content-type': 'application/json' })
  )

  assertEquals(response.status, 400)
  assertEquals((await response.json()).error, 'Envie o formulário como multipart/form-data.')
})

// ---------------------------------------------------------------------------
// Validacao acontece antes do upload
// ---------------------------------------------------------------------------

Deno.test('formulario invalido nao chega a enviar a imagem', async () => {
  resetFake()
  aceitaUpload()

  const response = await handler(envio(formularioValido({ style: 'prince-albert' })))

  assertEquals(response.status, 400)
  assertEquals((await response.json()).error.includes('não se aplica'), true)
  assertEquals(requestsTo('POST', '/storage/v1').length, 0)
})

Deno.test('envio sem consentimento e recusado', async () => {
  resetFake()

  const response = await handler(envio(formularioValido({ consent: 'false' })))

  assertEquals(response.status, 400)
  assertEquals((await response.json()).error.includes('Consentimento'), true)
})

Deno.test('envio sem imagem e recusado', async () => {
  resetFake()

  const form = new FormData()
  for (const [nome, valor] of Object.entries({
    gender: 'Feminino',
    bodyPart: 'Clítoris',
    style: 'vch',
    consent: 'true',
  })) {
    form.append(nome, valor)
  }

  const response = await handler(envio(form))

  assertEquals(response.status, 400)
  assertEquals((await response.json()).error, 'Imagem obrigatória.')
})

Deno.test('campo "image" com texto em vez de arquivo e recusado', async () => {
  resetFake()

  const form = new FormData()
  for (const [nome, valor] of Object.entries({
    gender: 'Feminino',
    bodyPart: 'Clítoris',
    style: 'vch',
    consent: 'true',
    image: 'nao-sou-um-arquivo',
  })) {
    form.append(nome, valor)
  }

  assertEquals((await handler(envio(form))).status, 400)
})

Deno.test('imagem em formato nao suportado e recusada', async () => {
  resetFake()

  const form = formularioValido()
  form.set('image', new File([new Uint8Array(16)], 'doc.pdf', { type: 'application/pdf' }))

  const response = await handler(envio(form))

  assertEquals(response.status, 400)
  assertEquals((await response.json()).error.includes('application/pdf'), true)
})

// ---------------------------------------------------------------------------
// Caminho feliz
// ---------------------------------------------------------------------------

Deno.test('simulacao valida responde com id e data de criacao', async () => {
  cenarioCompleto()

  const response = await handler(envio(formularioValido()))

  assertEquals(response.status, 200)
  assertEquals(await response.json(), {
    ok: true,
    id: 'sim-1',
    createdAt: '2026-09-20T12:00:00.000Z',
  })
})

Deno.test('a linha gravada reflete o formulario e o objeto enviado', async () => {
  cenarioCompleto()

  await handler(envio(formularioValido()))

  const upload = requireRequest('POST', `/storage/v1/object/${BUCKET}`)
  const caminho = upload.path.replace(`/storage/v1/object/${BUCKET}/`, '')
  const insert = JSON.parse(requireRequest('POST', '/rest/v1/simulations').body)

  assertEquals(insert.gender, 'Feminino')
  assertEquals(insert.gender_other, null)
  assertEquals(insert.body_part, 'Clítoris')
  assertEquals(insert.body_part_other, null)
  assertEquals(insert.piercing_style, 'vch')
  assertEquals(insert.storage_bucket, BUCKET)
  assertEquals(insert.image_path, caminho)
  assertEquals(insert.image_mime, 'image/png')
  assertEquals(insert.image_size, 128)
  assertEquals(insert.consent_given, true)
})

Deno.test('o texto livre de "Outro" chega ao banco', async () => {
  cenarioCompleto()

  await handler(
    envio(
      formularioValido({
        gender: 'Outro',
        genderOther: 'Nao binario',
        bodyPart: 'Outro',
        bodyPartOther: 'Umbigo',
      })
    )
  )

  const insert = JSON.parse(requireRequest('POST', '/rest/v1/simulations').body)

  assertEquals(insert.gender_other, 'Nao binario')
  assertEquals(insert.body_part_other, 'Umbigo')
})

Deno.test('o user-agent e gravado, cortado em 500 caracteres', async () => {
  cenarioCompleto()

  await handler(envio(formularioValido(), { 'user-agent': 'N'.repeat(900) }))

  assertEquals(JSON.parse(requireRequest('POST', '/rest/v1/simulations').body).user_agent.length, 500)
})

Deno.test('sem user-agent a coluna fica nula', async () => {
  cenarioCompleto()

  await handler(envio(formularioValido()))

  assertEquals(JSON.parse(requireRequest('POST', '/rest/v1/simulations').body).user_agent, null)
})

Deno.test('o insert pede de volta apenas id e created_at', async () => {
  cenarioCompleto()

  await handler(envio(formularioValido()))

  assertEquals(requireRequest('POST', '/rest/v1/simulations').search.get('select'), 'id,created_at')
})

// ---------------------------------------------------------------------------
// Rollback — storage e banco nao compartilham transacao
// ---------------------------------------------------------------------------

Deno.test('insert que falha desfaz o upload', async () => {
  resetFake()
  aceitaUpload()
  onRequest('POST', '/rest/v1/simulations', () =>
    postgrestError('violates check constraint "style_matches_body_part"', 400)
  )
  onRequest('DELETE', `/storage/v1/object/${BUCKET}`, () => jsonResponse([{ name: 'x' }]))

  const response = await semRuido(() => handler(envio(formularioValido())))

  assertEquals(response.status, 500)
  assertEquals(await response.json(), { ok: false, error: 'Erro interno.' })

  const upload = requireRequest('POST', `/storage/v1/object/${BUCKET}`)
  const caminho = upload.path.replace(`/storage/v1/object/${BUCKET}/`, '')
  const remocao = requireRequest('DELETE', `/storage/v1/object/${BUCKET}`)

  // O bucket nao pode acumular objeto sem linha apontando para ele.
  assertEquals(JSON.parse(remocao.body), { prefixes: [caminho] })
})

Deno.test('falha ao desfazer o upload nao troca o erro original', async () => {
  resetFake()
  aceitaUpload()
  onRequest('POST', '/rest/v1/simulations', () => postgrestError('indisponivel', 500))
  onRequest('DELETE', `/storage/v1/object/${BUCKET}`, () =>
    jsonResponse({ message: 'sem permissao' }, { status: 403 })
  )

  const response = await semRuido(() => handler(envio(formularioValido())))

  assertEquals(response.status, 500)
  assertEquals((await response.json()).error, 'Erro interno.')
})

Deno.test('upload que falha nao tenta gravar no banco', async () => {
  resetFake()
  onRequest('POST', `/storage/v1/object/${BUCKET}`, () =>
    jsonResponse({ message: 'bucket inexistente' }, { status: 400 })
  )

  const response = await semRuido(() => handler(envio(formularioValido())))

  assertEquals(response.status, 500)
  assertEquals(requestsTo('POST', '/rest/v1/simulations').length, 0)
  assertEquals(requestsTo('DELETE', '/storage/v1').length, 0)
})

Deno.test('a mensagem do banco nao vaza na resposta', async () => {
  resetFake()
  aceitaUpload()
  onRequest('POST', '/rest/v1/simulations', () =>
    postgrestError('null value in column "storage_bucket" violates not-null constraint', 400)
  )
  onRequest('DELETE', `/storage/v1/object/${BUCKET}`, () => jsonResponse([]))

  const response = await semRuido(() => handler(envio(formularioValido())))
  const texto = await response.text()

  assertEquals(texto.includes('storage_bucket'), false)
  assertEquals(texto.includes('constraint'), false)
})
