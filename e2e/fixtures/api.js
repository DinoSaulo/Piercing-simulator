/**
 * Interceptacao de /api/** para o E2E.
 *
 * O Playwright nao consegue reusar os handlers do MSW (formatos diferentes),
 * entao os cenarios sao redeclarados aqui. Sao poucos e estaveis: o contrato
 * real da API e coberto pelos testes de integracao do Deno e pela suite live.
 */

/** PNG 1x1, para o <input type="file"> ter um arquivo de verdade. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

function json(corpo, status = 200) {
  return { status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(corpo) }
}

/**
 * Instala as rotas da API publica.
 *
 * Devolve um array que recebe o que foi enviado, para o teste conferir os
 * campos do multipart que chegaram.
 */
export async function interceptarSimulacao(page, { falhando = false } = {}) {
  const enviadas = []

  await page.route('**/api/simulate', async (route) => {
    const dados = route.request().postDataBuffer()?.toString('latin1') ?? ''

    // Parse simples do multipart: basta para conferir os campos de texto.
    const campos = {}
    for (const parte of dados.split(/------\w+/)) {
      const nome = parte.match(/name="([^"]+)"/)?.[1]
      if (!nome) continue
      const valor = parte.split('\r\n\r\n')[1]?.replace(/\r\n$/, '')
      campos[nome] = nome === 'image' ? '<binario>' : valor
    }
    campos.temImagem = dados.includes('filename=')
    enviadas.push(campos)

    await route.fulfill(
      falhando
        ? json({ ok: false, error: 'Erro interno.' }, 500)
        : json({ ok: true, id: 'sim-e2e', createdAt: '2026-09-20T12:00:00.000Z' })
    )
  })

  return enviadas
}

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
    imageUrl: `data:image/png;base64,${PNG_1X1.toString('base64')}`,
    imageMime: 'image/png',
    imageSize: 2048,
    ...overrides,
  }
}

/**
 * Instala as rotas do painel, com sessao em memoria.
 *
 * O cookie HttpOnly real nao existe aqui: quem guarda o estado e este objeto,
 * e as rotas respondem 401 enquanto `autenticada` for falso — que e o que o
 * frontend enxerga de qualquer jeito.
 */
export async function interceptarPainel(page, { itens = [], total = null, autenticada = false } = {}) {
  const estado = { autenticada }

  await page.route('**/api/admin/session', (route) =>
    route.fulfill(
      estado.autenticada
        ? json({ ok: true, username: 'admin' })
        : json({ ok: false, error: 'Sessão inválida ou expirada.' }, 401)
    )
  )

  await page.route('**/api/admin/login', async (route) => {
    const { username, password } = JSON.parse(route.request().postData() ?? '{}')

    if (username !== 'admin' || password !== 'segredo') {
      return route.fulfill(json({ ok: false, error: 'Usuário ou senha inválidos.' }, 401))
    }

    estado.autenticada = true
    return route.fulfill(json({ ok: true, username }))
  })

  await page.route('**/api/admin/logout', (route) => {
    estado.autenticada = false
    return route.fulfill(json({ ok: true }))
  })

  await page.route('**/api/admin/simulations', (route) =>
    route.fulfill(
      estado.autenticada
        ? json({ ok: true, total: total ?? itens.length, limit: 100, items: itens })
        : json({ ok: false, error: 'Sessão inválida ou expirada.' }, 401)
    )
  )

  return estado
}
