import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // O front chama sempre "/api/...", nunca uma URL absoluta. Em dev quem
      // encaminha e este proxy; em producao, o rewrite do vercel.json. Nos dois
      // casos o browser enxerga mesma origem: sem CORS e com o cookie do painel
      // valendo como first-party.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:54321',
          changeOrigin: true,
          // O Supabase publica Edge Functions sob /functions/v1/<nome>. A funcao
          // se chama "api", entao /api/simulate vira /functions/v1/api/simulate.
          rewrite: (path) => `/functions/v1${path}`,
        },
      },
    },
  }
})
