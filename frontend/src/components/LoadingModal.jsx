import { useEffect, useRef, useState } from 'react'

export const LOADING_DURATION_MS = 90000

const STEPS = [
  { at: 0, label: 'Analisando a imagem…' },
  { at: 28, label: 'Mapeando a anatomia…' },
  { at: 55, label: 'Posicionando o piercing…' },
  { at: 80, label: 'Renderizando a simulação…' },
]

function labelFor(progress) {
  return STEPS.reduce((current, step) => (progress >= step.at ? step.label : current), STEPS[0].label)
}

/**
 * Barra de progresso de 4 segundos.
 *
 * O avanco vem de requestAnimationFrame lendo o relogio, nao de um setInterval
 * somando pedacinhos: assim a barra chega em 100% junto com o onComplete mesmo
 * se a aba engasgar ou perder frames.
 */
export function LoadingModal({ onComplete }) {
  const [progress, setProgress] = useState(0)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const start = performance.now()
    let frame

    function tick(now) {
      const ratio = Math.min((now - start) / LOADING_DURATION_MS, 1)
      setProgress(ratio * 100)

      if (ratio < 1) {
        frame = requestAnimationFrame(tick)
        return
      }
      onCompleteRef.current()
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/90 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-ink-800 bg-ink-900 p-6 shadow-2xl sm:p-8">
        <h2 id="loading-title" className="text-lg font-semibold text-steel-200">
          Criando sua simulação
        </h2>

        <p aria-live="polite" className="mt-1.5 text-sm text-steel-400">
          {labelFor(progress)}
        </p>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="mt-6 h-2.5 w-full overflow-hidden rounded-full bg-ink-800"
        >
          <div
            className="h-full rounded-full bg-accent-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-3 text-right font-mono text-xs text-steel-400/70">
          {Math.round(progress)}%
        </p>
      </div>
    </div>
  )
}
