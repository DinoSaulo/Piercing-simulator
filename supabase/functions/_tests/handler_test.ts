// fetch_fake.ts antes de qualquer import da funcao. Ver o cabecalho dele.
import { onRequest, postgrestError, resetFake } from './support/fetch_fake.ts'

import { assertEquals } from 'jsr:@std/assert@1'
import { issueToken } from '../api/auth.ts'
import { handler } from '../api/handler.ts'

const ORIGEM_LIBERADA = 'https://piercing.exemplo.test'

function pedido(method: string, path: string, init: RequestInit = {}): Request {
  return new Request(`http://127.0.0.1${path}`, { method, ...init })
}

async function corpo(response: Response): Promise<Record<string, unknown>> {
  return await response.json()
}

/** Silencia (e devolve) o que a funcao mandou para console.error. */
async function semRuido<T>(acao: () => Promise<T>): Promise<{ valor: T; logs: string[] }> {
  const original = console.error
  const logs: string[] = []
  console.error = (...args: unknown[]) => logs.push(args.map(String).join(' '))

  try {
    return { valor: await acao(), logs }
  } finally {
    console.error = original
  }
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

Deno.test('OPTIONS responde 204 sem corpo', async () => {
  const response = await handler(pedido('OPTIONS', '/api/simulate'))

  assertEquals(response.status, 204)
  assertEquals(await response.text(), '')
})

Deno.test('OPTIONS de origem liberada recebe os headers de CORS', async () => {
  const response = await handler(
    pedido('OPTIONS', '/api/simulate', { headers: { origin: ORIGEM_LIBERADA } })
  )

  assertEquals(response.headers.get('access-control-allow-origin'), ORIGEM_LIBERADA)
  assertEquals(response.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS')
})

Deno.test('OPTIONS de origem desconhecida nao recebe CORS', async () => {
  const response = await handler(
    pedido('OPTIONS', '/api/simulate', { headers: { origin: 'https://invasor.test' } })
  )

  assertEquals(response.status, 204)
  assertEquals(response.headers.get('access-control-allow-origin'), null)
})

Deno.test('OPTIONS nao depende de rota existente', async () => {
  // O preflight e respondido antes do roteamento.
  assertEquals((await handler(pedido('OPTIONS', '/api/rota/inexistente'))).status, 204)
})

// ---------------------------------------------------------------------------
// Health e normalizacao do caminho
// ---------------------------------------------------------------------------

Deno.test('GET /api/health responde ok', async () => {
  const response = await handler(pedido('GET', '/api/health'))

  assertEquals(response.status, 200)
  assertEquals(await corpo(response), { ok: true })
})

Deno.test('o prefixo /api e removido antes do roteamento', async () => {
  // O Supabase entrega em /<nome-da-funcao>/<resto>; a funcao se chama "api".
  for (const caminho of ['/api/health', '/health', '/api', '/', '/api/']) {
    const response = await handler(pedido('GET', caminho))
    assertEquals(response.status, 200, `${caminho} deveria responder 200`)
  }
})

Deno.test('"/apix" nao e confundido com o prefixo', async () => {
  // A regex exige que o proximo caractere seja "/" ou o fim do caminho.
  const response = await handler(pedido('GET', '/apix/health'))

  assertEquals(response.status, 404)
})

Deno.test('health responde com no-store como todas as respostas', async () => {
  assertEquals((await handler(pedido('GET', '/api/health'))).headers.get('cache-control'), 'no-store')
})

// ---------------------------------------------------------------------------
// Rotas inexistentes
// ---------------------------------------------------------------------------

Deno.test('rota desconhecida responde 404', async () => {
  const response = await handler(pedido('GET', '/api/nao-existe'))

  assertEquals(response.status, 404)
  assertEquals(await corpo(response), { ok: false, error: 'Rota não encontrada.' })
})

Deno.test('metodo errado numa rota existente responde 404', async () => {
  assertEquals((await handler(pedido('GET', '/api/simulate'))).status, 404)
  assertEquals((await handler(pedido('POST', '/api/health'))).status, 404)
})

Deno.test('sub-rota administrativa desconhecida responde 404', async () => {
  assertEquals((await handler(pedido('GET', '/api/admin/nao-existe'))).status, 404)
  assertEquals((await handler(pedido('DELETE', '/api/admin/login'))).status, 404)
})

Deno.test('"/admin" sem barra nao entra no ramo administrativo', async () => {
  // O roteamento testa startsWith('/admin/'), com barra.
  assertEquals((await handler(pedido('GET', '/api/admin'))).status, 404)
})

// ---------------------------------------------------------------------------
// Formato das respostas de erro
// ---------------------------------------------------------------------------

Deno.test('erro 4xx devolve a mensagem original', async () => {
  const response = await handler(pedido('GET', '/api/admin/session'))

  assertEquals(response.status, 401)
  assertEquals(await corpo(response), { ok: false, error: 'Sessão inválida ou expirada.' })
})

Deno.test('erro inesperado responde 500 sem vazar detalhe interno', async () => {
  // A mensagem original pode conter nome de coluna, constraint ou caminho de
  // arquivo — nada disso pode chegar ao cliente.
  resetFake()
  onRequest('GET', '/rest/v1/simulations', () =>
    postgrestError('column "segredo_interno" does not exist', 500)
  )

  const cookie = `admin_session=${await issueToken('admin-de-teste')}`
  const { valor: response, logs } = await semRuido(() =>
    handler(pedido('GET', '/api/admin/simulations', { headers: { cookie } }))
  )

  assertEquals(response.status, 500)
  assertEquals(await corpo(response), { ok: false, error: 'Erro interno.' })

  // O detalhe vai para o log, nao para a resposta.
  assertEquals(logs.some((linha) => linha.includes('segredo_interno')), true)
})

Deno.test('respostas de erro tambem carregam CORS quando a origem e liberada', async () => {
  const response = await handler(
    pedido('GET', '/api/nao-existe', { headers: { origin: ORIGEM_LIBERADA } })
  )

  assertEquals(response.status, 404)
  assertEquals(response.headers.get('access-control-allow-origin'), ORIGEM_LIBERADA)
})

Deno.test('toda resposta e JSON com charset declarado', async () => {
  const response = await handler(pedido('GET', '/api/nao-existe'))

  assertEquals(response.headers.get('content-type'), 'application/json; charset=utf-8')
})
