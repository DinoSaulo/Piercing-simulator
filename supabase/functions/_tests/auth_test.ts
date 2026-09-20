// ATENCAO: fetch_fake.ts precisa vir antes de qualquer import da funcao — ele
// troca o fetch global, e supabase.ts guarda a referencia no import.
import {
  jsonResponse,
  noContent,
  onRequest,
  postgrestError,
  requestsTo,
  requireRequest,
  resetFake,
} from './support/fetch_fake.ts'

import { assertEquals } from 'jsr:@std/assert@1'
import { SignJWT } from 'npm:jose@5'
import {
  clearFailures,
  clearedCookie,
  credentialsMatch,
  issueToken,
  lockoutRemaining,
  readSession,
  registerFailure,
  sessionCookie,
} from '../api/auth.ts'

// Alinhado com .env.test.
const USUARIO = 'admin-de-teste'
const SENHA = 'senha-de-teste'
const SEGREDO = 'segredo-jwt-de-teste-com-tamanho-suficiente'

const chave = () => new TextEncoder().encode(SEGREDO)

function comCookie(valor: string): Request {
  return new Request('http://127.0.0.1/api/admin/session', { headers: { cookie: valor } })
}

/** Captura o que foi para console.error durante a execucao. */
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
// Comparacao de credenciais
// ---------------------------------------------------------------------------

Deno.test('aceita a dupla correta', async () => {
  assertEquals(await credentialsMatch(USUARIO, SENHA), true)
})

Deno.test('recusa usuario errado com senha certa', async () => {
  assertEquals(await credentialsMatch('outro', SENHA), false)
})

Deno.test('recusa senha errada com usuario certo', async () => {
  assertEquals(await credentialsMatch(USUARIO, 'errada'), false)
})

Deno.test('recusa credenciais vazias', async () => {
  assertEquals(await credentialsMatch('', ''), false)
})

Deno.test('recusa senha que e prefixo da correta', async () => {
  // O digest muda por inteiro com um caractere a menos: e o que impede
  // descobrir a senha posicao a posicao pelo tempo de resposta.
  assertEquals(await credentialsMatch(USUARIO, SENHA.slice(0, -1)), false)
  assertEquals(await credentialsMatch(USUARIO, SENHA + 'x'), false)
})

Deno.test('a comparacao diferencia maiusculas', async () => {
  assertEquals(await credentialsMatch(USUARIO.toUpperCase(), SENHA), false)
})

// ---------------------------------------------------------------------------
// Token de sessao
// ---------------------------------------------------------------------------

Deno.test('token emitido e aceito de volta pelo cookie', async () => {
  const token = await issueToken(USUARIO)
  const sessao = await readSession(comCookie(`admin_session=${token}`))

  assertEquals(sessao, { username: USUARIO })
})

Deno.test('requisicao sem cookie nao tem sessao', async () => {
  assertEquals(await readSession(new Request('http://127.0.0.1/api/admin/session')), null)
})

Deno.test('cookie de outro nome e ignorado', async () => {
  const token = await issueToken(USUARIO)

  assertEquals(await readSession(comCookie(`outro_cookie=${token}`)), null)
})

Deno.test('o cookie e encontrado no meio de outros', async () => {
  const token = await issueToken(USUARIO)
  const sessao = await readSession(comCookie(`_ga=1; admin_session=${token}; tema=escuro`))

  assertEquals(sessao, { username: USUARIO })
})

Deno.test('cookie malformado nao derruba a leitura', async () => {
  assertEquals(await readSession(comCookie('sem-sinal-de-igual')), null)
})

Deno.test('token com assinatura de outro segredo e recusado', async () => {
  const forjado = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(USUARIO)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode('segredo-do-atacante-com-tamanho-suficiente'))

  assertEquals(await readSession(comCookie(`admin_session=${forjado}`)), null)
})

Deno.test('token com alg "none" e recusado', async () => {
  // Confusao de algoritmo: sem fixar `algorithms: ['HS256']` na verificacao,
  // um token sem assinatura nenhuma poderia passar.
  const b64 = (valor: unknown) =>
    btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const cabecalho = b64({ alg: 'none', typ: 'JWT' })
  const corpo = b64({ role: 'admin', sub: USUARIO, exp: Math.floor(Date.now() / 1000) + 3600 })

  assertEquals(await readSession(comCookie(`admin_session=${cabecalho}.${corpo}.`)), null)
})

Deno.test('token expirado e recusado', async () => {
  const vencido = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(USUARIO)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(chave())

  assertEquals(await readSession(comCookie(`admin_session=${vencido}`)), null)
})

Deno.test('token sem role de admin e recusado', async () => {
  const semRole = await new SignJWT({ role: 'visitante' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(USUARIO)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(chave())

  assertEquals(await readSession(comCookie(`admin_session=${semRole}`)), null)
})

Deno.test('token sem subject e recusado', async () => {
  const semSub = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(chave())

  assertEquals(await readSession(comCookie(`admin_session=${semSub}`)), null)
})

Deno.test('token adulterado no payload e recusado', async () => {
  const token = await issueToken(USUARIO)
  const [cabecalho, , assinatura] = token.split('.')
  const outroCorpo = btoa(JSON.stringify({ role: 'admin', sub: 'invasor' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  assertEquals(await readSession(comCookie(`admin_session=${cabecalho}.${outroCorpo}.${assinatura}`)), null)
})

Deno.test('lixo no lugar do token nao lanca excecao', async () => {
  assertEquals(await readSession(comCookie('admin_session=nao-e-um-jwt')), null)
})

// ---------------------------------------------------------------------------
// Cookie
// ---------------------------------------------------------------------------

Deno.test('o cookie de sessao carrega as protecoes esperadas', () => {
  const cookie = sessionCookie('abc123')
  const partes = cookie.split('; ')

  assertEquals(partes.includes('admin_session=abc123'), true)
  // HttpOnly tira o token do alcance de qualquer JavaScript da pagina.
  assertEquals(partes.includes('HttpOnly'), true)
  assertEquals(partes.includes('Secure'), true)
  assertEquals(partes.includes('SameSite=Lax'), true)
  assertEquals(partes.includes('Path=/'), true)
  assertEquals(partes.includes('Max-Age=3600'), true)
})

Deno.test('o cookie de logout zera valor e validade', () => {
  const partes = clearedCookie().split('; ')

  assertEquals(partes.includes('admin_session='), true)
  assertEquals(partes.includes('Max-Age=0'), true)
})

Deno.test('logout repete os atributos do cookie original', () => {
  // Atributo diferente faz o browser tratar como outro cookie, e o antigo
  // continuaria valendo.
  const emitidos = sessionCookie('x').split('; ').filter((parte) => !parte.startsWith('admin_session=') && !parte.startsWith('Max-Age='))
  const limpos = clearedCookie().split('; ')

  for (const atributo of emitidos) {
    assertEquals(limpos.includes(atributo), true, `logout nao repetiu "${atributo}"`)
  }
})

// ---------------------------------------------------------------------------
// Bloqueio por tentativas
// ---------------------------------------------------------------------------

const IP = '203.0.113.7'

Deno.test('sem registro no banco o IP esta liberado', async () => {
  resetFake()
  onRequest('GET', '/rest/v1/admin_login_attempts', () => jsonResponse([]))

  assertEquals(await lockoutRemaining(IP), 0)
})

Deno.test('registro sem locked_until deixa o IP liberado', async () => {
  resetFake()
  onRequest('GET', '/rest/v1/admin_login_attempts', () => jsonResponse([{ locked_until: null }]))

  assertEquals(await lockoutRemaining(IP), 0)
})

Deno.test('bloqueio no futuro devolve os segundos restantes', async () => {
  resetFake()
  const ate = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  onRequest('GET', '/rest/v1/admin_login_attempts', () => jsonResponse([{ locked_until: ate }]))

  const restante = await lockoutRemaining(IP)

  // Arredonda para cima; a folga cobre o tempo gasto na propria chamada.
  assertEquals(restante > 295 && restante <= 300, true, `restante inesperado: ${restante}`)
})

Deno.test('bloqueio ja vencido devolve zero', async () => {
  resetFake()
  const passado = new Date(Date.now() - 60 * 1000).toISOString()
  onRequest('GET', '/rest/v1/admin_login_attempts', () => jsonResponse([{ locked_until: passado }]))

  assertEquals(await lockoutRemaining(IP), 0)
})

Deno.test('erro no banco nao bloqueia o login', async () => {
  // Falha de leitura nao pode virar recusa: derrubaria o painel inteiro.
  resetFake()
  onRequest('GET', '/rest/v1/admin_login_attempts', () => postgrestError('indisponivel', 500))

  assertEquals(await lockoutRemaining(IP), 0)
})

Deno.test('lockoutRemaining consulta o IP pedido', async () => {
  resetFake()
  onRequest('GET', '/rest/v1/admin_login_attempts', () => jsonResponse([]))

  await lockoutRemaining(IP)

  const consulta = requireRequest('GET', '/rest/v1/admin_login_attempts')
  assertEquals(consulta.search.get('client_ip'), `eq.${IP}`)
  assertEquals(consulta.search.get('select'), 'locked_until')
})

Deno.test('registerFailure chama a RPC atomica com o IP', async () => {
  resetFake()
  onRequest('POST', '/rest/v1/rpc/register_admin_login_failure', () => jsonResponse(null))

  await registerFailure(IP)

  const chamada = requireRequest('POST', '/rest/v1/rpc/register_admin_login_failure')
  assertEquals(JSON.parse(chamada.body), { p_ip: IP })
})

Deno.test('falha na RPC e apenas registrada no log', async () => {
  resetFake()
  onRequest('POST', '/rest/v1/rpc/register_admin_login_failure', () => postgrestError('sem conexao', 500))

  const logs = await capturandoErros(() => registerFailure(IP))

  assertEquals(logs.length, 1)
  assertEquals(logs[0].includes('[auth]'), true)
  assertEquals(logs[0].includes(IP), true)
})

Deno.test('clearFailures apaga o registro do IP sem registrar erro', async () => {
  resetFake()
  onRequest('DELETE', '/rest/v1/admin_login_attempts', () => noContent())

  const logs = await capturandoErros(() => clearFailures(IP))

  assertEquals(logs, [])
  assertEquals(requireRequest('DELETE', '/rest/v1/admin_login_attempts').search.get('client_ip'), `eq.${IP}`)
})

Deno.test('falha ao limpar tentativas e apenas registrada no log', async () => {
  resetFake()
  onRequest('DELETE', '/rest/v1/admin_login_attempts', () => postgrestError('sem conexao', 500))

  const logs = await capturandoErros(() => clearFailures(IP))

  assertEquals(logs.length, 1)
  assertEquals(logs[0].includes('[auth]'), true)
})

Deno.test('nenhuma chamada extra e feita nas operacoes de bloqueio', async () => {
  resetFake()
  onRequest('DELETE', '/rest/v1/admin_login_attempts', () => noContent())

  await clearFailures(IP)

  assertEquals(requestsTo('DELETE', '/rest/v1').length, 1)
})
