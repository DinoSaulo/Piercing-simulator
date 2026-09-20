import { HttpResponse, http } from 'msw'

/**
 * Handlers padrao da API.
 *
 * Interceptam no nivel da rede, entao os testes atravessam o codigo real de
 * api/createSimulation.js e api/admin.js — incluindo o `credentials: 'include'`,
 * o parsing de erro e o status anexado. Nada e substituido por dublê.
 *
 * Estado do login mora em `sessao`, para os testes encadearem entrar e sair.
 */
export const sessao = {
  autenticada: false,
  username: 'admin',
}

export function resetSessao() {
  sessao.autenticada = false
  sessao.username = 'admin'
}

/** Simulacoes que a listagem do painel devolve. */
export const painel = {
  total: 0,
  limit: 100,
  items: [],
}

export function resetPainel() {
  painel.total = 0
  painel.limit = 100
  painel.items = []
}

/** Guarda o que o formulario publico enviou, para os testes conferirem. */
export const enviadas = []

export function resetEnviadas() {
  enviadas.length = 0
}

function naoAutenticado() {
  return HttpResponse.json({ ok: false, error: 'Sessão inválida ou expirada.' }, { status: 401 })
}

export const handlers = [
  http.post('/api/simulate', async ({ request }) => {
    const form = await request.formData()
    const imagem = form.get('image')

    enviadas.push({
      gender: form.get('gender'),
      genderOther: form.get('genderOther'),
      bodyPart: form.get('bodyPart'),
      bodyPartOther: form.get('bodyPartOther'),
      style: form.get('style'),
      consent: form.get('consent'),
      imageName: imagem instanceof File ? imagem.name : null,
      imageType: imagem instanceof File ? imagem.type : null,
    })

    return HttpResponse.json({ ok: true, id: 'sim-1', createdAt: '2026-09-20T12:00:00.000Z' })
  }),

  http.post('/api/admin/login', async ({ request }) => {
    const { username, password } = await request.json()

    if (username !== 'admin' || password !== 'segredo') {
      return HttpResponse.json({ ok: false, error: 'Usuário ou senha inválidos.' }, { status: 401 })
    }

    sessao.autenticada = true
    return HttpResponse.json({ ok: true, username })
  }),

  http.post('/api/admin/logout', () => {
    sessao.autenticada = false
    return HttpResponse.json({ ok: true })
  }),

  http.get('/api/admin/session', () =>
    sessao.autenticada
      ? HttpResponse.json({ ok: true, username: sessao.username })
      : naoAutenticado()
  ),

  http.get('/api/admin/simulations', () =>
    sessao.autenticada ? HttpResponse.json({ ok: true, ...painel }) : naoAutenticado()
  ),
]

/** Uma linha de simulacao com os campos que o painel espera. */
export function simulacao(overrides = {}) {
  return {
    id: 'sim-1',
    createdAt: '2026-09-20T15:30:00.000Z',
    gender: 'Feminino',
    genderOther: null,
    bodyPart: 'Mamilos',
    bodyPartOther: null,
    style: 'areola',
    imageUrl: 'https://storage.exemplo.test/foto.png?token=abc',
    imageMime: 'image/png',
    imageSize: 2048,
    ...overrides,
  }
}
