import { config } from './config.ts'

export class HttpError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

/**
 * CORS só é emitido para origens explicitamente liberadas em ALLOWED_ORIGINS.
 *
 * Sem a lista, a função responde apenas a chamadas de mesma origem — o rewrite
 * da Vercel em produção e o proxy do Vite em dev —, que é o desenho pretendido.
 * Emitir `*` seria inútil aqui de qualquer forma: com cookie de sessão o browser
 * exige uma origem nominal.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  if (!origin || !config.allowedOrigins.includes(origin)) return {}

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'Origin',
  }
}

export function json(
  req: Request,
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // O painel devolve dados sensíveis; nenhum intermediário deve guardá-los.
      'cache-control': 'no-store',
      ...corsHeaders(req),
      ...headers,
    },
  })
}

/**
 * Atrás do rewrite da Vercel o IP que a função enxerga é o da edge, não o de
 * quem chamou — o original vem no x-forwarded-for. Se nenhum dos dois estiver
 * presente, todo mundo cai no mesmo balde e o bloqueio fica mais agressivo do
 * que o previsto; é o lado seguro do erro.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || req.headers.get('x-real-ip') || 'desconhecido'
}
