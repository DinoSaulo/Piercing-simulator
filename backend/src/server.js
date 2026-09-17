import cors from 'cors'
import express from 'express'
import { MulterError } from 'multer'
import { config } from './config.js'
import { simulateRouter } from './routes/simulate.js'

const app = express()

app.use(cors({ origin: config.corsOrigin }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

app.use('/api', simulateRouter)

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Rota nao encontrada.' })
})

app.use((error, _req, res, _next) => {
  if (error instanceof MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `Imagem maior que o limite de ${Math.round(config.maxUploadBytes / 1024 / 1024)}MB.`
        : `Upload invalido: ${error.message}`
    res.status(400).json({ ok: false, error: message })
    return
  }

  const status = error.status ?? 500
  if (status >= 500) {
    console.error('[api] erro inesperado:', error)
  }

  res.status(status).json({ ok: false, error: error.message })
})

app.listen(config.port, () => {
  console.log(`[api] ouvindo em http://localhost:${config.port}`)
})
