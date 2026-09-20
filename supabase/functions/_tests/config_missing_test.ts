/**
 * Funcao mal configurada.
 *
 * Roda numa invocacao separada do `deno test`, com --env-file=.env.missing:
 * config.ts congela os valores no primeiro import, entao nao da para simular
 * secret ausente mexendo em Deno.env no meio de outra suite.
 */
import { assertEquals } from 'jsr:@std/assert@1'
import { missingEnv } from '../api/config.ts'
import { handler } from '../api/handler.ts'

function pedido(method: string, path: string): Request {
  return new Request(`http://127.0.0.1${path}`, { method })
}

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

Deno.test('missingEnv lista exatamente as variaveis ausentes', () => {
  assertEquals(missingEnv(), ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_JWT_SECRET'])
})

Deno.test('secret ausente derruba qualquer requisicao com 500', async () => {
  for (const [method, path] of [
    ['GET', '/api/health'],
    ['POST', '/api/simulate'],
    ['POST', '/api/admin/login'],
    ['GET', '/api/admin/simulations'],
  ] as const) {
    const { valor: response } = await semRuido(() => handler(pedido(method, path)))

    assertEquals(response.status, 500, `${method} ${path} deveria responder 500`)
    assertEquals(await response.json(), { ok: false, error: 'Erro interno.' })
  }
})

Deno.test('o nome do que falta vai para o log, nunca para a resposta', async () => {
  const { valor: response, logs } = await semRuido(() => handler(pedido('GET', '/api/health')))
  const texto = await response.text()

  assertEquals(texto.includes('ADMIN_JWT_SECRET'), false)
  assertEquals(logs.some((linha) => linha.includes('ADMIN_JWT_SECRET')), true)
  assertEquals(logs.some((linha) => linha.includes('[config]')), true)
})

Deno.test('o preflight ainda responde — ele nem chega na checagem', async () => {
  // OPTIONS e tratado antes de missingEnv(); um preflight quebrado esconderia
  // o erro real do browser atras de uma falha de CORS.
  assertEquals((await handler(pedido('OPTIONS', '/api/simulate'))).status, 204)
})
