/**
 * Variáveis de ambiente da função.
 *
 * SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetadas pela plataforma — não
 * precisam (nem podem) ser cadastradas como secret.
 *
 * Todos os outros nomes NÃO podem começar com `SUPABASE_`: o prefixo é
 * reservado e o CLI recusa o cadastro. É por isso que STORAGE_BUCKET aqui não
 * se chama SUPABASE_STORAGE_BUCKET como no backend Node anterior.
 *
 *   npx supabase secrets set --env-file supabase/functions/.env
 */

function positiveNumber(name: string, fallback: number): number {
  const raw = Deno.env.get(name)
  const parsed = Number(raw)
  return raw && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',

  storageBucket: Deno.env.get('STORAGE_BUCKET') ?? 'simulations',
  maxUploadBytes: positiveNumber('MAX_UPLOAD_BYTES', 10 * 1024 * 1024),

  // Lista vazia = nenhum header de CORS emitido. O caminho normal é o rewrite
  // do vercel.json, que faz o browser enxergar tudo na mesma origem; CORS só
  // entra em jogo se alguém chamar a URL da função diretamente.
  allowedOrigins: (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  adminUsername: Deno.env.get('ADMIN_USERNAME') ?? '',
  adminPassword: Deno.env.get('ADMIN_PASSWORD') ?? '',
  adminJwtSecret: Deno.env.get('ADMIN_JWT_SECRET') ?? '',
  adminSessionSeconds: positiveNumber('ADMIN_SESSION_SECONDS', 8 * 60 * 60),

  // 'Lax' pressupõe o rewrite da Vercel, que mantém a API na mesma origem do
  // site. Chamando a função por outro domínio o cookie vira de terceiros e só
  // funciona com 'None' — que exige ALLOWED_ORIGINS preenchido e é bloqueado
  // no Safari de qualquer jeito. Deixar configurável evita ter que mexer no
  // código se o rewrite não der conta.
  adminCookieSameSite: Deno.env.get('ADMIN_COOKIE_SAMESITE') === 'None' ? 'None' : 'Lax',

  // Depois de expirada a signed URL, a imagem volta a ser inacessível. Uma hora
  // cobre uma sessão de navegação sem deixar links válidos rolando por aí.
  signedUrlSeconds: positiveNumber('SIGNED_URL_SECONDS', 60 * 60),
  adminPageSize: positiveNumber('ADMIN_PAGE_SIZE', 100),
}

const REQUIRED: Array<[string, string]> = [
  ['SUPABASE_URL', config.supabaseUrl],
  ['SUPABASE_SERVICE_ROLE_KEY', config.serviceRoleKey],
  ['ADMIN_USERNAME', config.adminUsername],
  ['ADMIN_PASSWORD', config.adminPassword],
  ['ADMIN_JWT_SECRET', config.adminJwtSecret],
]

export function missingEnv(): string[] {
  return REQUIRED.filter(([, value]) => !value).map(([name]) => name)
}
