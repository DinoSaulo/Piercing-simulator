import 'dotenv/config'

// Aceita o nome novo (sb_secret_...) e cai no legado (service_role JWT) para
// nao quebrar ambientes criados antes da troca de nomenclatura do Supabase.
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const missing = []
if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL')
if (!secretKey) missing.push('SUPABASE_SECRET_KEY')

if (missing.length > 0) {
  console.error(
    `\n[config] Variaveis de ambiente ausentes: ${missing.join(', ')}\n` +
      `Copie backend/.env.example para backend/.env e preencha os valores do seu projeto Supabase.\n`
  )
  process.exit(1)
}

export const config = {
  port: Number(process.env.PORT) || 3333,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseSecretKey: secretKey,
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'simulations',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 10 * 1024 * 1024,
}
