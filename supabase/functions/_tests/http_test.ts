import { assertEquals } from 'jsr:@std/assert@1'
import { HttpError, clientIp, corsHeaders, json } from '../api/http.ts'

// Alinhado com ALLOWED_ORIGINS de .env.test.
const LIBERADA = 'https://piercing.exemplo.test'
const OUTRA_LIBERADA = 'https://outra.exemplo.test'

function req(headers: Record<string, string> = {}): Request {
  return new Request('http://127.0.0.1/api/health', { headers })
}

// ---------------------------------------------------------------------------
// HttpError
// ---------------------------------------------------------------------------

Deno.test('HttpError usa 400 por padrao', () => {
  const error = new HttpError('algo')

  assertEquals(error.status, 400)
  assertEquals(error.name, 'HttpError')
  assertEquals(error.message, 'algo')
  assertEquals(error instanceof Error, true)
})

Deno.test('HttpError aceita status explicito', () => {
  assertEquals(new HttpError('nao achei', 404).status, 404)
})

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

Deno.test('sem header Origin nao emite CORS', () => {
  assertEquals(corsHeaders(req()), {})
})

Deno.test('origem fora da lista nao emite CORS', () => {
  assertEquals(corsHeaders(req({ origin: 'https://invasor.test' })), {})
})

Deno.test('origem liberada emite o conjunto completo de headers', () => {
  const headers = corsHeaders(req({ origin: LIBERADA }))

  assertEquals(headers['access-control-allow-origin'], LIBERADA)
  assertEquals(headers['access-control-allow-credentials'], 'true')
  assertEquals(headers['access-control-allow-methods'], 'GET, POST, OPTIONS')
  assertEquals(headers['access-control-allow-headers'], 'content-type')
  // Sem `Vary: Origin` um cache intermediario serviria a resposta de uma origem
  // para outra.
  assertEquals(headers.vary, 'Origin')
})

Deno.test('cada origem liberada recebe a si mesma, nunca "*"', () => {
  // Com cookie de sessao o browser recusa "*"; o header tem que ser nominal.
  assertEquals(corsHeaders(req({ origin: OUTRA_LIBERADA }))['access-control-allow-origin'], OUTRA_LIBERADA)
})

Deno.test('origem que apenas comeca igual a uma liberada nao passa', () => {
  assertEquals(corsHeaders(req({ origin: 'https://piercing.exemplo.test.invasor.io' })), {})
})

Deno.test('a comparacao de origem diferencia esquema e porta', () => {
  assertEquals(corsHeaders(req({ origin: 'http://piercing.exemplo.test' })), {})
  assertEquals(corsHeaders(req({ origin: 'https://piercing.exemplo.test:8443' })), {})
})

// ---------------------------------------------------------------------------
// json()
// ---------------------------------------------------------------------------

Deno.test('json() devolve corpo, status e content-type', async () => {
  const response = json(req(), { ok: true }, 201)

  assertEquals(response.status, 201)
  assertEquals(response.headers.get('content-type'), 'application/json; charset=utf-8')
  assertEquals(await response.json(), { ok: true })
})

Deno.test('json() marca toda resposta como no-store', () => {
  // O painel devolve dados sensiveis; nenhum intermediario deve guarda-los.
  assertEquals(json(req(), {}).headers.get('cache-control'), 'no-store')
})

Deno.test('json() anexa os headers de CORS quando a origem e liberada', () => {
  const response = json(req({ origin: LIBERADA }), { ok: true })

  assertEquals(response.headers.get('access-control-allow-origin'), LIBERADA)
})

Deno.test('json() aceita headers extras, como o set-cookie do login', () => {
  const response = json(req(), { ok: true }, 200, { 'set-cookie': 'a=1' })

  assertEquals(response.headers.get('set-cookie'), 'a=1')
  assertEquals(response.headers.get('cache-control'), 'no-store')
})

Deno.test('headers extras sobrescrevem os padroes', () => {
  const response = json(req(), {}, 200, { 'cache-control': 'max-age=60' })

  assertEquals(response.headers.get('cache-control'), 'max-age=60')
})

// ---------------------------------------------------------------------------
// clientIp — base do bloqueio por tentativas
// ---------------------------------------------------------------------------

Deno.test('clientIp usa o primeiro endereco de x-forwarded-for', () => {
  // O primeiro e o cliente original; os seguintes sao os proxies do caminho.
  assertEquals(clientIp(req({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })), '203.0.113.7')
})

Deno.test('clientIp remove espacos ao redor do endereco', () => {
  assertEquals(clientIp(req({ 'x-forwarded-for': '  203.0.113.7  , 10.0.0.1' })), '203.0.113.7')
})

Deno.test('clientIp cai para x-real-ip quando nao ha x-forwarded-for', () => {
  assertEquals(clientIp(req({ 'x-real-ip': '198.51.100.4' })), '198.51.100.4')
})

Deno.test('clientIp ignora x-forwarded-for vazio e usa x-real-ip', () => {
  assertEquals(clientIp(req({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.4' })), '198.51.100.4')
})

Deno.test('sem nenhum header todo mundo cai no mesmo balde', () => {
  // Bloqueio mais agressivo do que o previsto e o lado seguro do erro.
  assertEquals(clientIp(req()), 'desconhecido')
})
