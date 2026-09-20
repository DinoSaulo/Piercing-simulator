import { defineConfig, devices } from '@playwright/test'

/**
 * E2E em navegador de verdade.
 *
 * O servidor e o `vite dev` do frontend. A API nao sobe junto: cada spec
 * intercepta /api/** com page.route(), o que mantem o E2E deterministico e sem
 * Docker. Quem exercita a API de verdade e a suite `test:live`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run dev --prefix frontend -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    // Reaproveita um `npm run dev` que ja esteja aberto durante o
    // desenvolvimento, em vez de brigar pela porta.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
