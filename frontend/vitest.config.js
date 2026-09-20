import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Configuracao propria, separada do vite.config.js.
 *
 * O build de producao carrega o plugin do Tailwind e monta o proxy de /api —
 * nada disso serve aos testes, que rodam em jsdom e tem o MSW no lugar do
 * proxy. Separar tambem evita que o vite.config.js precise conhecer o Vitest.
 */
export default defineConfig({
  plugins: [react()],
  // O runtime automatico precisa ser declarado aqui: o plugin do React cuida
  // dos arquivos de src, mas os proprios arquivos de teste passam pelo esbuild
  // do Vitest, que sem isto gera codigo esperando `React` no escopo.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    restoreMocks: true,
  },
})
