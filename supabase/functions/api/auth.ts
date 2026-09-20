import { SignJWT, jwtVerify } from 'npm:jose@5'
import { config } from './config.ts'
import { supabase } from './supabase.ts'

const COOKIE_NAME = 'admin_session'

const secretKey = () => new TextEncoder().encode(config.adminJwtSecret)

// ---------------------------------------------------------------------------
// Comparação de segredos
// ---------------------------------------------------------------------------

async function sha256(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
}

/**
 * Compara dois segredos em tempo constante.
 *
 * `a === b` sai no primeiro byte diferente, e essa diferença de tempo é
 * mensurável pela rede — dá para descobrir a senha caractere a caractere. Comparar
 * os digests resolve os dois vazamentos de uma vez: o laço tem sempre 32
 * iterações, independente do conteúdo e do tamanho das entradas.
 */
async function secretEquals(a: string, b: string): Promise<boolean> {
  const [digestA, digestB] = await Promise.all([sha256(a), sha256(b)])

  let diff = 0
  for (let i = 0; i < digestA.length; i++) {
    diff |= digestA[i] ^ digestB[i]
  }
  return diff === 0
}

export async function credentialsMatch(username: string, password: string): Promise<boolean> {
  // Sempre avalia as duas comparações: parar no usuário errado revelaria, pelo
  // tempo de resposta, qual nome de usuário existe.
  const userOk = await secretEquals(username, config.adminUsername)
  const passOk = await secretEquals(password, config.adminPassword)
  return userOk && passOk
}

// ---------------------------------------------------------------------------
// Token de sessão
// ---------------------------------------------------------------------------

export async function issueToken(username: string): Promise<string> {
  return await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${config.adminSessionSeconds}s`)
    .sign(secretKey())
}

export async function readSession(req: Request): Promise<{ username: string } | null> {
  const token = readCookie(req)
  if (!token) return null

  try {
    // `algorithms` fixo em HS256 fecha a confusão de algoritmo: sem isso um
    // token forjado com alg "none" ou RS256 poderia passar na verificação.
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    if (payload.role !== 'admin' || typeof payload.sub !== 'string') return null
    return { username: payload.sub }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Cookie
// ---------------------------------------------------------------------------

/**
 * HttpOnly tira o token do alcance de qualquer JavaScript da página — é a
 * diferença entre um XSS incomodar e um XSS entregar o painel inteiro.
 *
 * SameSite=Lax só funciona porque o rewrite do vercel.json coloca a API na mesma
 * origem do site. Chamando a URL da função direto, o cookie seria de terceiros:
 * bloqueado no Safari e em extinção no Chrome.
 */
export function sessionCookie(token: string): string {
  return [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Secure',
    `SameSite=${config.adminCookieSameSite}`,
    'Path=/',
    `Max-Age=${config.adminSessionSeconds}`,
  ].join('; ')
}

export function clearedCookie(): string {
  // Os atributos precisam bater com os do cookie original, senão o navegador
  // trata como outro cookie e o antigo continua valendo.
  return [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Secure',
    `SameSite=${config.adminCookieSameSite}`,
    'Path=/',
    'Max-Age=0',
  ].join('; ')
}

function readCookie(req: Request): string | null {
  const header = req.headers.get('cookie')
  if (!header) return null

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() === COOKIE_NAME) {
      return part.slice(separator + 1).trim()
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Bloqueio por tentativas
// ---------------------------------------------------------------------------

/**
 * Um único usuário e senha guardando fotos íntimas: sem trava, força bruta é só
 * questão de tempo. O contador vive no Postgres porque cada requisição da função
 * pode cair num isolate diferente — um Map em memória não seria compartilhado.
 *
 * Retorna quantos segundos ainda faltam para liberar, ou 0 se estiver liberado.
 */
export async function lockoutRemaining(ip: string): Promise<number> {
  const { data, error } = await supabase
    .from('admin_login_attempts')
    .select('locked_until')
    .eq('client_ip', ip)
    .maybeSingle()

  if (error || !data?.locked_until) return 0

  const remaining = new Date(data.locked_until).getTime() - Date.now()
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}

export async function registerFailure(ip: string): Promise<void> {
  // Incremento atômico: a RPC faz insert/update numa instrução só, então um
  // ataque em paralelo não consegue ler o mesmo contador várias vezes.
  const { error } = await supabase.rpc('register_admin_login_failure', { p_ip: ip })
  if (error) {
    console.error(`[auth] falha ao registrar tentativa de ${ip}: ${error.message}`)
  }
}

export async function clearFailures(ip: string): Promise<void> {
  const { error } = await supabase.from('admin_login_attempts').delete().eq('client_ip', ip)
  if (error) {
    console.error(`[auth] falha ao limpar tentativas de ${ip}: ${error.message}`)
  }
}
