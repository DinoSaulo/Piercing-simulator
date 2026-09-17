import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 300

/**
 * Mostra/esconde os filhos com fade + colapso de altura.
 *
 * O truque do grid-rows 0fr -> 1fr anima a altura sem precisar medir o
 * conteudo. O no fica montado durante a saida e so entao e desmontado, senao
 * o fade-out nunca chega a ser exibido.
 */
export function FadeReveal({ show, children, className = '' }) {
  const [mounted, setMounted] = useState(show)
  const [visible, setVisible] = useState(show)
  const exitTimer = useRef(null)

  // Os setState abaixo dirigem o motor de transicao do CSS, que e externo ao
  // React: a entrada precisa de um frame montado em opacity-0 e a saida precisa
  // sobreviver ate o fade terminar. Derivar durante o render nao da conta disso.
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    clearTimeout(exitTimer.current)

    if (show) {
      setMounted(true)
      // Um frame montado em opacity-0 antes de virar opacity-100: sem isso o
      // browser aplica o estado final direto e nao ha transicao.
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }

    setVisible(false)
    exitTimer.current = setTimeout(() => setMounted(false), DURATION_MS)
    return () => clearTimeout(exitTimer.current)
  }, [show])
  /* oxlint-enable react/set-state-in-effect */

  useEffect(() => () => clearTimeout(exitTimer.current), [])

  if (!mounted) return null

  return (
    <div
      aria-hidden={!visible}
      className={`grid transition-all duration-300 ease-out ${
        visible ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      } ${className}`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}
