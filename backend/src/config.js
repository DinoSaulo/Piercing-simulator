import 'dotenv/config'

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']

const missing = required.filter((key) => !process.env[key])
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
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'simulations',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 10 * 1024 * 1024,
}
