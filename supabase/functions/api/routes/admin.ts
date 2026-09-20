import {
  clearFailures,
  clearedCookie,
  credentialsMatch,
  issueToken,
  lockoutRemaining,
  readSession,
  registerFailure,
  sessionCookie,
} from '../auth.ts'
import { config } from '../config.ts'
import { HttpError, clientIp, json } from '../http.ts'
import { signImageUrls } from '../storage.ts'
import { supabase } from '../supabase.ts'

export async function handleAdmin(req: Request, path: string): Promise<Response> {
  if (req.method === 'POST' && path === '/admin/login') return await login(req)
  if (req.method === 'POST' && path === '/admin/logout') return logout(req)
  if (req.method === 'GET' && path === '/admin/session') return await session(req)
  if (req.method === 'GET' && path === '/admin/simulations') return await simulations(req)

  throw new HttpError('Rota não encontrada.', 404)
}

async function login(req: Request): Promise<Response> {
  const ip = clientIp(req)

  const blocked = await lockoutRemaining(ip)
  if (blocked > 0) {
    throw new HttpError(
      `Muitas tentativas. Tente de novo em ${Math.ceil(blocked / 60)} minuto(s).`,
      429
    )
  }

  let body: { username?: unknown; password?: unknown }
  try {
    body = await req.json()
  } catch {
    throw new HttpError('Envie usuário e senha em JSON.')
  }

  const username = typeof body.username === 'string' ? body.username : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!(await credentialsMatch(username, password))) {
    await registerFailure(ip)
    // Mensagem única para usuário errado e senha errada: dizer qual dos dois
    // falhou entregaria metade da credencial.
    throw new HttpError('Usuário ou senha inválidos.', 401)
  }

  await clearFailures(ip)
  const token = await issueToken(config.adminUsername)

  return json(req, { ok: true, username: config.adminUsername }, 200, {
    'set-cookie': sessionCookie(token),
  })
}

function logout(req: Request): Response {
  // O cookie é HttpOnly, então o navegador não consegue apagá-lo sozinho — quem
  // encerra a sessão é esta resposta.
  return json(req, { ok: true }, 200, { 'set-cookie': clearedCookie() })
}

async function session(req: Request): Promise<Response> {
  const current = await readSession(req)
  if (!current) {
    return json(req, { ok: false, error: 'Sessão inválida ou expirada.' }, 401)
  }
  return json(req, { ok: true, username: current.username })
}

/**
 * O projeto não gera tipos do banco (`supabase gen types`), então o supabase-js
 * infere as colunas lendo a string do `select` em tempo de tipo. Descrever a
 * linha aqui e fixá-la com `.returns()` deixa o retorno tipado sem depender
 * dessa inferência — e é o que mantém este arquivo passando no `deno check`.
 */
interface SimulationRow {
  id: string
  created_at: string
  gender: string
  gender_other: string | null
  body_part: string
  body_part_other: string | null
  piercing_style: string
  image_path: string
  image_mime: string
  image_size: number
}

const SELECT_COLUMNS =
  'id, created_at, gender, gender_other, body_part, body_part_other, piercing_style, image_path, image_mime, image_size'

async function simulations(req: Request): Promise<Response> {
  const current = await readSession(req)
  if (!current) {
    throw new HttpError('Sessão inválida ou expirada.', 401)
  }

  // `count: 'exact'` traz o total da tabela mesmo com a listagem cortada, então
  // o contador da tela continua certo depois da centésima simulação.
  const { data, count, error } = await supabase
    .from('simulations')
    .select(SELECT_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(config.adminPageSize)
    .returns<SimulationRow[]>()

  if (error) {
    throw new Error(`Falha ao listar simulações: ${error.message}`)
  }

  const rows = data ?? []
  const urls = await signImageUrls(rows.map((row) => row.image_path))

  return json(req, {
    ok: true,
    total: count ?? rows.length,
    limit: config.adminPageSize,
    items: rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      gender: row.gender,
      genderOther: row.gender_other,
      bodyPart: row.body_part,
      bodyPartOther: row.body_part_other,
      style: row.piercing_style,
      imageUrl: urls.get(row.image_path) ?? null,
      imageMime: row.image_mime,
      imageSize: row.image_size,
    })),
  })
}
