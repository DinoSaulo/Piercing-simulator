import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // O front chama sempre "/api/...". Em dev o Vite encaminha para o Express,
      // entao nao existe CORS nem URL absoluta espalhada pelo codigo.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:3333',
          changeOrigin: true,
        },
      },
    },
  }
})
