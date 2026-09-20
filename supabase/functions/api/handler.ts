import { missingEnv } from './config.ts'
import { HttpError, corsHeaders, json } from './http.ts'
import { handleAdmin } from './routes/admin.ts'
import { handleSimulate } from './routes/simulate.ts'

function route(req: Request, path: string): Promise<Response> | Response {
  if (req.method === 'GET' && (path === '/health' || path === '/')) {
    return json(req, { ok: true })
  }

  if (req.method === 'POST' && path === '/simulate') {
    return handleSimulate(req)
  }

  if (path.startsWith('/admin/')) {
    return handleAdmin(req, path)
  }

  throw new HttpError('Rota não encontrada.', 404)
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) })
  }

  // O Supabase entrega a requisição em /<nome-da-função>/<resto>. Como a função
  // se chama `api`, o caminho já chega com o mesmo prefixo que o frontend usa.
  const path = new URL(req.url).pathname.replace(/^\/api(?=\/|$)/, '') || '/'

  try {
    // Falta de secret derruba toda requisição com a mesma mensagem genérica; o
    // nome do que falta vai para o log, não para a resposta.
    const missing = missingEnv()
    if (missing.length > 0) {
      console.error(`[config] variáveis de ambiente ausentes: ${missing.join(', ')}`)
      throw new HttpError('Função mal configurada.', 500)
    }

    return await route(req, path)
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500

    if (status >= 500) {
      console.error('[api] erro inesperado:', error)
      // Erro interno não vaza detalhe: a mensagem original pode conter nome de
      // coluna, constraint ou caminho de arquivo.
      return json(req, { ok: false, error: 'Erro interno.' }, status)
    }

    return json(req, { ok: false, error: (error as Error).message }, status)
  }
}
