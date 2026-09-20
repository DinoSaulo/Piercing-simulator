/**
 * Suite contra o Supabase de verdade.
 *
 * Desligada por padrao: cada teste checa LIVE=1 e se marca como ignorado. Roda
 * em invocacao separada, e NAO importa support/fetch_fake.ts — o fake
 * interceptaria exatamente o host que esta suite precisa alcancar.
 *
 * O que ela cobre e justamente o que o fake nao alcanca: os CHECK constraints
 * do Postgres, o `on conflict` atomico da RPC de bloqueio, os limites do bucket
 * e uma signed URL que realmente abre a imagem.
 *
 * Pre-requisitos (detalhados no README):
 *
 *   npx supabase start
 *   docker exec -i supabase_db_<ref> psql -U postgres -d postgres < supabase/schema.sql
 *   LIVE=1 deno test --env-file=supabase/functions/.env ... live_test.ts
 *
 * As credenciais vem da env, nunca do codigo: sao as mesmas que a funcao local
 * ja usa.
 */
import { assertEquals } from 'jsr:@std/assert@1'

const LIGADA = Deno.env.get('LIVE') === '1'
const BASE = Deno.env.get('LIVE_API_URL') ?? 'http://127.0.0.1:54321/functions/v1/api'
const USUARIO = Deno.env.get('ADMIN_USERNAME') ?? ''
const SENHA = Deno.env.get('ADMIN_PASSWORD') ?? ''

/** Wrapper que respeita o interruptor e nao deixa vazamento de recurso passar. */
function live(nome: string, corpo: () => Promise<void>): void {
  Deno.test({ name: `live: ${nome}`, ignore: !LIGADA, fn: corpo })
}

/**
 * Cada execucao usa um IP ficticio novo.
 *
 * O contador de tentativas vive no banco e nao e limpo entre execucoes. Com um
 * IP por execucao, o teste de bloqueio nunca trava a execucao seguinte.
 */
const IP_DA_EXECUCAO = () =>
  `198.51.100.${Math.floor(Math.random() * 200) + 1}:${crypto.randomUUID().slice(0, 8)}`

function url(path: string): string {
  return `${BASE}${path}`
}

/**
 * Traz a URL assinada para uma origem que o host alcanca.
 *
 * No stack local a funcao recebe SUPABASE_URL=http://kong:8000, que so resolve
 * dentro da rede do Docker — entao a URL que ela assina nao abre daqui. Trocar
 * a origem pela mesma da API resolve, e em ambiente remoto a troca e inocua:
 * a funcao e o storage vivem no mesmo host.
 *
 * O que isto NAO cobre: se a origem emitida estiver errada em producao, este
 * teste nao acusa. O que ele prova e que o objeto chegou ao bucket e que a
 * assinatura e valida.
 */
function alcancavel(assinada: string): string {
  const externo = new URL(BASE).origin
  const original = new URL(assinada)
  return `${externo}${original.pathname}${original.search}`
}

/** PNG minimo de 1x1 — valido o bastante para o bucket aceitar o mime. */
function pngDeTeste(): File {
  const bytes = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    ),
    (c) => c.charCodeAt(0)
  )
  return new File([bytes], 'pixel.png', { type: 'image/png' })
}

function formulario(overrides: Record<string, string> = {}): FormData {
  const form = new FormData()
  const campos = {
    gender: 'Feminino',
    bodyPart: 'Mamilos',
    style: 'areola',
    consent: 'true',
    ...overrides,
  }
  for (const [nome, valor] of Object.entries(campos)) form.append(nome, valor)
  form.append('image', pngDeTeste())
  return form
}

async function enviaSimulacao(form: FormData): Promise<Response> {
  return await fetch(url('/simulate'), { method: 'POST', body: form })
}

async function entra(): Promise<string> {
  const response = await fetch(url('/admin/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': IP_DA_EXECUCAO() },
    body: JSON.stringify({ username: USUARIO, password: SENHA }),
  })

  assertEquals(response.status, 200, 'login do painel falhou — confira ADMIN_USERNAME/ADMIN_PASSWORD')
  await response.body?.cancel()

  return (response.headers.get('set-cookie') ?? '').split(';')[0]
}

// ---------------------------------------------------------------------------
// Basico
// ---------------------------------------------------------------------------

live('a funcao esta no ar e configurada', async () => {
  const response = await fetch(url('/health'))

  assertEquals(response.status, 200)
  assertEquals(await response.json(), { ok: true })
})

live('rota inexistente responde 404', async () => {
  const response = await fetch(url('/nao-existe'))

  assertEquals(response.status, 404)
  await response.body?.cancel()
})

// ---------------------------------------------------------------------------
// Gravacao real: Postgres + Storage
// ---------------------------------------------------------------------------

live('simulacao valida e gravada no banco e no bucket', async () => {
  const response = await enviaSimulacao(formulario())
  const corpo = await response.json()

  assertEquals(response.status, 200)
  assertEquals(corpo.ok, true)
  assertEquals(typeof corpo.id, 'string')
  assertEquals(typeof corpo.createdAt, 'string')
  // O id vem do default do Postgres, entao tem formato de uuid.
  assertEquals(/^[0-9a-f-]{36}$/.test(corpo.id), true)
})

live('o texto livre de "Outro" passa pelos constraints do banco', async () => {
  // gender_other_required: (gender = 'Outro') = (gender_other is not null).
  const response = await enviaSimulacao(
    formulario({ gender: 'Outro', genderOther: 'Nao binario' })
  )

  assertEquals(response.status, 200)
  await response.body?.cancel()
})

live('combinacao invalida de estilo e parte e recusada', async () => {
  const response = await enviaSimulacao(formulario({ bodyPart: 'Ânus', style: 'apadravya' }))
  const corpo = await response.json()

  assertEquals(response.status, 400)
  assertEquals(corpo.error.includes('não se aplica'), true)
})

live('envio sem consentimento e recusado', async () => {
  const response = await enviaSimulacao(formulario({ consent: 'false' }))

  assertEquals(response.status, 400)
  await response.body?.cancel()
})

live('formato de imagem nao suportado e recusado', async () => {
  const form = formulario()
  form.set('image', new File([new Uint8Array(32)], 'doc.pdf', { type: 'application/pdf' }))

  const response = await enviaSimulacao(form)

  assertEquals(response.status, 400)
  await response.body?.cancel()
})

// ---------------------------------------------------------------------------
// Painel: sessao real
// ---------------------------------------------------------------------------

live('credenciais erradas sao recusadas com 401', async () => {
  const response = await fetch(url('/admin/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': IP_DA_EXECUCAO() },
    body: JSON.stringify({ username: USUARIO, password: 'senha-errada-de-proposito' }),
  })

  assertEquals(response.status, 401)
  assertEquals((await response.json()).error, 'Usuário ou senha inválidos.')
})

live('login valido abre sessao utilizavel', async () => {
  const cookie = await entra()

  assertEquals(cookie.startsWith('admin_session='), true)

  const sessao = await fetch(url('/admin/session'), { headers: { cookie } })

  assertEquals(sessao.status, 200)
  assertEquals((await sessao.json()).username, USUARIO)
})

live('listagem sem sessao responde 401', async () => {
  const response = await fetch(url('/admin/simulations'))

  assertEquals(response.status, 401)
  await response.body?.cancel()
})

live('a simulacao enviada aparece no painel com imagem acessivel', async () => {
  const enviada = await (await enviaSimulacao(formulario({ bodyPart: 'Glande', style: 'dydoe' }))).json()
  assertEquals(enviada.ok, true)

  const cookie = await entra()
  const listagem = await (await fetch(url('/admin/simulations'), { headers: { cookie } })).json()

  assertEquals(listagem.ok, true)
  assertEquals(listagem.total >= 1, true)

  const item = listagem.items.find((linha: { id: string }) => linha.id === enviada.id)
  assertEquals(item !== undefined, true, 'a simulacao recem-criada nao apareceu na listagem')
  assertEquals(item.bodyPart, 'Glande')
  assertEquals(item.style, 'dydoe')
  assertEquals(item.imageMime, 'image/png')
  assertEquals(item.imageSize > 0, true)

  // A signed URL precisa abrir de verdade: e o que prova que o objeto chegou
  // ao bucket e que a assinatura vale.
  const imagem = await fetch(alcancavel(item.imageUrl))
  assertEquals(imagem.status, 200)
  assertEquals(imagem.headers.get('content-type')?.includes('image/png'), true)
  assertEquals((await imagem.arrayBuffer()).byteLength, item.imageSize)
})

live('o bucket e privado: sem assinatura a imagem nao abre', async () => {
  const enviada = await (await enviaSimulacao(formulario())).json()

  const cookie = await entra()
  const listagem = await (await fetch(url('/admin/simulations'), { headers: { cookie } })).json()
  const item = listagem.items.find((linha: { id: string }) => linha.id === enviada.id)

  // Mesma imagem, pelo caminho publico do storage em vez da URL assinada.
  const semAssinatura = alcancavel(item.imageUrl)
    .replace('/object/sign/', '/object/public/')
    .split('?')[0]
  const response = await fetch(semAssinatura)

  assertEquals(response.status >= 400, true, 'o bucket respondeu sem exigir assinatura')
  await response.body?.cancel()
})

live('logout apaga o cookie', async () => {
  const response = await fetch(url('/admin/logout'), { method: 'POST' })
  const cookie = response.headers.get('set-cookie') ?? ''

  assertEquals(response.status, 200)
  assertEquals(cookie.includes('Max-Age=0'), true)
  await response.body?.cancel()
})

// ---------------------------------------------------------------------------
// Bloqueio por tentativas — a RPC atomica de verdade
// ---------------------------------------------------------------------------

live('cinco falhas seguidas bloqueiam o IP', async () => {
  const ip = IP_DA_EXECUCAO()

  async function tenta(): Promise<number> {
    const response = await fetch(url('/admin/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ username: USUARIO, password: 'errada' }),
    })
    const status = response.status
    await response.body?.cancel()
    return status
  }

  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    assertEquals(await tenta(), 401, `tentativa ${tentativa} deveria ser 401`)
  }

  // A sexta ja cai no bloqueio gravado pela RPC.
  assertEquals(await tenta(), 429)
})

live('o bloqueio vale mesmo com a senha correta', async () => {
  const ip = IP_DA_EXECUCAO()

  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    const errada = await fetch(url('/admin/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ username: USUARIO, password: 'errada' }),
    })
    await errada.body?.cancel()
  }

  const certa = await fetch(url('/admin/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ username: USUARIO, password: SENHA }),
  })

  assertEquals(certa.status, 429)
  await certa.body?.cancel()
})

live('o bloqueio e por IP, nao global', async () => {
  const bloqueado = IP_DA_EXECUCAO()

  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    const errada = await fetch(url('/admin/login'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': bloqueado },
      body: JSON.stringify({ username: USUARIO, password: 'errada' }),
    })
    await errada.body?.cancel()
  }

  // Outro IP continua entrando normalmente.
  const cookie = await entra()
  assertEquals(cookie.startsWith('admin_session='), true)
})
