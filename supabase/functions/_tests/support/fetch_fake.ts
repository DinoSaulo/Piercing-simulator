/**
 * Fake da rede do Supabase.
 *
 * ORDEM DE IMPORT IMPORTA: este modulo precisa ser importado ANTES de qualquer
 * arquivo da funcao. O supabase-js guarda a referencia do `fetch` global no
 * momento em que `createClient()` roda — que e no import de supabase.ts. Trocar
 * `globalThis.fetch` depois disso nao teria efeito nenhum: o client continuaria
 * segurando a funcao original.
 *
 * Por isso a troca acontece aqui no corpo do modulo, e cada teste so registra
 * as rotas que quer atender. O que o dispatcher entrega e devolve e HTTP de
 * verdade, entao o supabase-js real monta as queries e interpreta as respostas:
 * o unico dublê e a rede.
 */

export interface RecordedRequest {
  method: string
  url: URL
  /** Caminho sem querystring, ex.: "/rest/v1/simulations". */
  path: string
  search: URLSearchParams
  headers: Headers
  body: string
  /** true quando nenhuma rota registrada atendeu a chamada. */
  unmatched: boolean
}

type Responder = (request: RecordedRequest) => Response | Promise<Response>

interface Route {
  method: string
  /** Prefixo do caminho. Cobre os paths de storage, que terminam no objeto. */
  path: string
  responder: Responder
}

const realFetch = globalThis.fetch

/**
 * Com LIVE=1 o fake se desliga por completo.
 *
 * A suite live fala com o stack local, que atende no mesmo host e porta que o
 * dispatcher intercepta. Sem esta guarda, importar este modulo por engano numa
 * execucao live transformaria toda chamada real num 501.
 */
const DESLIGADO = Deno.env.get('LIVE') === '1'

let routes: Route[] = []
let recorded: RecordedRequest[] = []

async function toRecorded(input: RequestInfo | URL, init?: RequestInit): Promise<RecordedRequest> {
  const request = new Request(input, init)
  const url = new URL(request.url)

  return {
    method: request.method.toUpperCase(),
    url,
    path: url.pathname,
    search: url.searchParams,
    headers: request.headers,
    body: await request.text(),
    unmatched: false,
  }
}

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(new Request(input, init).url)

  // Qualquer coisa fora do host do Supabase segue para a rede de verdade.
  if (DESLIGADO || !url.origin.includes('127.0.0.1:54321')) {
    return await realFetch(input, init)
  }

  const request = await toRecorded(input, init)
  recorded.push(request)

  const route = routes.find(
    (candidate) => candidate.method === request.method && request.path.startsWith(candidate.path)
  )

  if (!route) {
    request.unmatched = true
    // 501 com corpo descritivo em vez de excecao: o supabase-js engole erros de
    // fetch e devolve `{ error }`, o que esconderia a causa. Assim a mensagem
    // aparece no erro que o codigo de producao propaga.
    return jsonResponse(
      { message: `rota nao registrada no fake: ${request.method} ${request.path}` },
      { status: 501 }
    )
  }

  return await route.responder(request)
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...init.headers },
  })
}

/**
 * 204 do PostgREST (delete sem `return=representation`).
 *
 * Precisa ser corpo nulo: `new Response('null', { status: 204 })` lanca, e o
 * erro apareceria como falha da operacao em vez de erro do teste.
 */
export function noContent(): Response {
  return new Response(null, { status: 204 })
}

/** Registra uma rota. Rotas registradas depois tem prioridade menor. */
export function onRequest(method: string, path: string, responder: Responder): void {
  routes.push({ method: method.toUpperCase(), path, responder })
}

/** Limpa rotas e historico. Chame no inicio de cada teste. */
export function resetFake(): void {
  routes = []
  recorded = []
}

export function requests(): RecordedRequest[] {
  return recorded
}

export function requestsTo(method: string, path: string): RecordedRequest[] {
  return recorded.filter(
    (request) => request.method === method.toUpperCase() && request.path.startsWith(path)
  )
}

/** Primeira requisicao que bateu no caminho, ou erro se nao houve nenhuma. */
export function requireRequest(method: string, path: string): RecordedRequest {
  const found = requestsTo(method, path)[0]
  if (!found) {
    const seen = recorded.map((request) => `${request.method} ${request.path}`).join(', ') || 'nenhuma'
    throw new Error(`Esperava ${method.toUpperCase()} ${path}; requisicoes vistas: ${seen}`)
  }
  return found
}

// ---------------------------------------------------------------------------
// Atalhos para as respostas que a funcao consome
// ---------------------------------------------------------------------------

/**
 * Resposta de listagem do PostgREST.
 *
 * O total de `count: 'exact'` nao vem no corpo: o PostgREST devolve no header
 * `content-range`, no formato `inicio-fim/total`.
 */
export function postgrestList(rows: unknown[], total = rows.length): Response {
  const end = rows.length === 0 ? 0 : rows.length - 1
  return jsonResponse(rows, {
    headers: { 'content-range': `0-${end}/${total}` },
  })
}

export function postgrestError(message: string, status = 400): Response {
  return jsonResponse({ message, code: 'TESTE', details: null, hint: null }, { status })
}
