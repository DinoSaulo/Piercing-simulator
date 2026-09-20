// fetch_fake.ts antes de qualquer import da funcao. Ver o cabecalho dele.
import {
  jsonResponse,
  noContent,
  onRequest,
  postgrestError,
  postgrestList,
  requestsTo,
  requireRequest,
  resetFake,
} from './support/fetch_fake.ts'

import { assertEquals } from 'jsr:@std/assert@1'
import { issueToken } from '../api/auth.ts'
import { handler } from '../api/handler.ts'

// Alinhado com .env.test.
const USUARIO = 'admin-de-teste'
const SENHA = 'senha-de-teste'
const BUCKET = 'simulations-test'
const PAGINA = 5

const IP = '203.0.113.7'

function login(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://127.0.0.1/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': IP, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function get(path: string, cookie?: string): Request {
  return new Request(`http://127.0.0.1${path}`, {
    headers: cookie ? { cookie } : {},
  })
}

async function cookieDeSessao(): Promise<string> {
  return `admin_session=${await issueToken(USUARIO)}`
}

function semBloqueio(): void {
  onRequest('GET', '/rest/v1/admin_login_attempts', () => jsonResponse([]))
}

function bloqueadoPor(segundos: number): void {
  const ate = new Date(Date.now() + segundos * 1000).toISOString()
  onRequest('GET', '/rest/v1/admin_login_attempts', () => jsonResponse([{ locked_until: ate }]))
}

function aceitaContadores(): void {
  onRequest('POST', '/rest/v1/rpc/register_admin_login_failure', () => jsonResponse(null))
  onRequest('DELETE', '/rest/v1/admin_login_attempts', () => noContent())
}

const LINHA = {
  id: 'sim-1',
  created_at: '2026-09-20T12:00:00.000Z',
  gender: 'Outro',
  gender_other: 'Nao binario',
  body_part: 'Mamilos',
  body_part_other: null,
  piercing_style: 'areola',
  image_path: '2026/09/foto.png',
  image_mime: 'image/png',
  image_size: 2048,
}

function listaCom(linhas: unknown[], total = linhas.length): void {
  onRequest('GET', '/rest/v1/simulations', () => postgrestList(linhas, total))
}

function assinaturaOk(caminhos: string[]): void {
  onRequest('POST', `/storage/v1/object/sign/${BUCKET}`, () =>
    jsonResponse(
      caminhos.map((caminho) => ({
        error: null,
        path: caminho,
        signedURL: `/object/sign/${BUCKET}/${caminho}?token=tok`,
      }))
    )
  )
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

// ---------------------------------------------------------------------------
// Login — bloqueio por tentativas
// ---------------------------------------------------------------------------

Deno.test('IP bloqueado recebe 429 sem que as credenciais sejam avaliadas', async () => {
  resetFake()
  bloqueadoPor(600)

  const response = await handler(login({ username: USUARIO, password: SENHA }))

  assertEquals(response.status, 429)
  // Nem a RPC de falha e chamada: o pedido morre antes.
  assertEquals(requestsTo('POST', '/rest/v1/rpc').length, 0)
})

Deno.test('a mensagem de bloqueio informa os minutos restantes', async () => {
  resetFake()
  bloqueadoPor(150)

  const response = await handler(login({ username: 'x', password: 'y' }))

  assertEquals((await response.json()).error, 'Muitas tentativas. Tente de novo em 3 minuto(s).')
})

Deno.test('o bloqueio e consultado pelo IP de x-forwarded-for', async () => {
  resetFake()
  semBloqueio()
  aceitaContadores()

  await handler(login({ username: USUARIO, password: SENHA }))

  assertEquals(requireRequest('GET', '/rest/v1/admin_login_attempts').search.get('client_ip'), `eq.${IP}`)
})

// ---------------------------------------------------------------------------
// Login — corpo e credenciais
// ---------------------------------------------------------------------------

Deno.test('corpo que nao e JSON responde 400', async () => {
  resetFake()
  semBloqueio()

  const response = await handler(login('nao-e-json'))

  assertEquals(response.status, 400)
  assertEquals((await response.json()).error, 'Envie usuário e senha em JSON.')
})

Deno.test('credenciais erradas respondem 401 e registram a tentativa', async () => {
  resetFake()
  semBloqueio()
  aceitaContadores()

  const response = await handler(login({ username: USUARIO, password: 'errada' }))

  assertEquals(response.status, 401)
  assertEquals(JSON.parse(requireRequest('POST', '/rest/v1/rpc/register_admin_login_failure').body), {
    p_ip: IP,
  })
})

Deno.test('usuario errado e senha errada dao a mesma resposta', async () => {
  // Dizer qual dos dois falhou entregaria metade da credencial.
  const respostas: string[] = []

  for (const corpo of [
    { username: 'invasor', password: SENHA },
    { username: USUARIO, password: 'errada' },
    { username: 'invasor', password: 'errada' },
  ]) {
    resetFake()
    semBloqueio()
    aceitaContadores()

    const response = await handler(login(corpo))
    assertEquals(response.status, 401)
    respostas.push((await response.json()).error)
  }

  assertEquals(new Set(respostas).size, 1)
  assertEquals(respostas[0], 'Usuário ou senha inválidos.')
})

Deno.test('campos ausentes ou de outro tipo sao tratados como vazios', async () => {
  for (const corpo of [{}, { username: 123, password: [] }, { username: null }]) {
    resetFake()
    semBloqueio()
    aceitaContadores()

    assertEquals((await handler(login(corpo))).status, 401)
  }
})

Deno.test('login sem cookie nao vaza set-cookie na falha', async () => {
  resetFake()
  semBloqueio()
  aceitaContadores()

  const response = await handler(login({ username: USUARIO, password: 'errada' }))

  assertEquals(response.headers.get('set-cookie'), null)
})

// ---------------------------------------------------------------------------
// Login — sucesso
// ---------------------------------------------------------------------------

Deno.test('login valido responde 200 e emite o cookie de sessao', async () => {
  resetFake()
  semBloqueio()
  aceitaContadores()

  const response = await handler(login({ username: USUARIO, password: SENHA }))

  assertEquals(response.status, 200)
  assertEquals(await response.json(), { ok: true, username: USUARIO })

  const cookie = response.headers.get('set-cookie') ?? ''
  assertEquals(cookie.startsWith('admin_session='), true)
  assertEquals(cookie.includes('HttpOnly'), true)
  assertEquals(cookie.includes('Secure'), true)
})

Deno.test('login valido zera o contador de tentativas', async () => {
  resetFake()
  semBloqueio()
  aceitaContadores()

  await handler(login({ username: USUARIO, password: SENHA }))

  assertEquals(requireRequest('DELETE', '/rest/v1/admin_login_attempts').search.get('client_ip'), `eq.${IP}`)
  assertEquals(requestsTo('POST', '/rest/v1/rpc').length, 0)
})

Deno.test('o cookie emitido no login abre a sessao', async () => {
  resetFake()
  semBloqueio()
  aceitaContadores()

  const entrada = await handler(login({ username: USUARIO, password: SENHA }))
  const cookie = (entrada.headers.get('set-cookie') ?? '').split(';')[0]

  const sessao = await handler(get('/api/admin/session', cookie))

  assertEquals(sessao.status, 200)
  assertEquals(await sessao.json(), { ok: true, username: USUARIO })
})

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

Deno.test('logout responde ok e apaga o cookie', async () => {
  resetFake()

  const response = await handler(
    new Request('http://127.0.0.1/api/admin/logout', { method: 'POST' })
  )

  assertEquals(response.status, 200)
  assertEquals(await response.json(), { ok: true })

  const cookie = response.headers.get('set-cookie') ?? ''
  assertEquals(cookie.includes('admin_session='), true)
  assertEquals(cookie.includes('Max-Age=0'), true)
})

Deno.test('logout funciona mesmo sem sessao ativa', async () => {
  // O cookie e HttpOnly: so o servidor consegue apaga-lo, entao a rota nao
  // pode exigir sessao valida para encerrar.
  resetFake()

  assertEquals(
    (await handler(new Request('http://127.0.0.1/api/admin/logout', { method: 'POST' }))).status,
    200
  )
})

// ---------------------------------------------------------------------------
// Sessao
// ---------------------------------------------------------------------------

Deno.test('sessao sem cookie responde 401', async () => {
  resetFake()

  const response = await handler(get('/api/admin/session'))

  assertEquals(response.status, 401)
  assertEquals(await response.json(), { ok: false, error: 'Sessão inválida ou expirada.' })
})

Deno.test('sessao com cookie valido devolve o usuario', async () => {
  resetFake()

  const response = await handler(get('/api/admin/session', await cookieDeSessao()))

  assertEquals(await response.json(), { ok: true, username: USUARIO })
})

// ---------------------------------------------------------------------------
// Listagem
// ---------------------------------------------------------------------------

Deno.test('listagem sem sessao responde 401 e nao consulta o banco', async () => {
  resetFake()

  const response = await handler(get('/api/admin/simulations'))

  assertEquals(response.status, 401)
  assertEquals(requestsTo('GET', '/rest/v1/simulations').length, 0)
})

Deno.test('listagem devolve as linhas em camelCase com a URL assinada', async () => {
  resetFake()
  listaCom([LINHA])
  assinaturaOk(['2026/09/foto.png'])

  const response = await handler(get('/api/admin/simulations', await cookieDeSessao()))
  const corpo = await response.json()

  assertEquals(corpo.ok, true)
  assertEquals(corpo.total, 1)
  assertEquals(corpo.limit, PAGINA)
  assertEquals(corpo.items.length, 1)

  const item = corpo.items[0]
  assertEquals(item.id, 'sim-1')
  assertEquals(item.createdAt, '2026-09-20T12:00:00.000Z')
  assertEquals(item.gender, 'Outro')
  assertEquals(item.genderOther, 'Nao binario')
  assertEquals(item.bodyPart, 'Mamilos')
  assertEquals(item.bodyPartOther, null)
  assertEquals(item.style, 'areola')
  assertEquals(item.imageMime, 'image/png')
  assertEquals(item.imageSize, 2048)
  assertEquals(item.imageUrl.includes('token=tok'), true)
})

Deno.test('a listagem nao expoe o caminho interno do objeto', async () => {
  resetFake()
  listaCom([LINHA])
  assinaturaOk(['2026/09/foto.png'])

  const response = await handler(get('/api/admin/simulations', await cookieDeSessao()))
  const item = (await response.json()).items[0]

  assertEquals('image_path' in item, false)
  assertEquals('storage_bucket' in item, false)
})

Deno.test('o total vem do banco mesmo com a listagem cortada', async () => {
  // count: 'exact' mantem o contador da tela certo depois da centesima linha.
  resetFake()
  listaCom([LINHA], 137)
  assinaturaOk(['2026/09/foto.png'])

  const corpo = await (await handler(get('/api/admin/simulations', await cookieDeSessao()))).json()

  assertEquals(corpo.total, 137)
  assertEquals(corpo.items.length, 1)
})

Deno.test('a consulta usa o limite configurado e ordena do mais recente', async () => {
  resetFake()
  listaCom([])

  await handler(get('/api/admin/simulations', await cookieDeSessao()))

  const consulta = requireRequest('GET', '/rest/v1/simulations')
  assertEquals(consulta.search.get('limit'), String(PAGINA))
  assertEquals(consulta.search.get('order'), 'created_at.desc')
  assertEquals(consulta.headers.get('prefer'), 'count=exact')
})

Deno.test('listagem vazia nao chama o storage', async () => {
  resetFake()
  listaCom([])

  const corpo = await (await handler(get('/api/admin/simulations', await cookieDeSessao()))).json()

  assertEquals(corpo.items, [])
  assertEquals(corpo.total, 0)
  assertEquals(requestsTo('POST', '/storage/v1').length, 0)
})

Deno.test('imagem que sumiu do bucket vira imageUrl nula, sem derrubar a lista', async () => {
  resetFake()
  listaCom([LINHA, { ...LINHA, id: 'sim-2', image_path: '2026/09/sumiu.png' }], 2)
  assinaturaOk(['2026/09/foto.png'])

  const corpo = await (await handler(get('/api/admin/simulations', await cookieDeSessao()))).json()

  assertEquals(corpo.items.length, 2)
  assertEquals(corpo.items[0].imageUrl.includes('token=tok'), true)
  assertEquals(corpo.items[1].imageUrl, null)
})

Deno.test('falha na assinatura mantem a listagem, sem miniaturas', async () => {
  resetFake()
  listaCom([LINHA])
  onRequest('POST', `/storage/v1/object/sign/${BUCKET}`, () =>
    jsonResponse({ message: 'indisponivel' }, { status: 500 })
  )

  const corpo = await semRuido(async () =>
    await (await handler(get('/api/admin/simulations', await cookieDeSessao()))).json()
  )

  assertEquals(corpo.items.length, 1)
  assertEquals(corpo.items[0].imageUrl, null)
})

Deno.test('erro do banco na listagem responde 500 sem vazar a mensagem', async () => {
  resetFake()
  onRequest('GET', '/rest/v1/simulations', () =>
    postgrestError('permission denied for table simulations', 403)
  )

  const cookie = await cookieDeSessao()
  const response = await semRuido(() => handler(get('/api/admin/simulations', cookie)))
  const texto = await response.text()

  assertEquals(response.status, 500)
  assertEquals(JSON.parse(texto).error, 'Erro interno.')
  assertEquals(texto.includes('permission denied'), false)
})
