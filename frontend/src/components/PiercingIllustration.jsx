/**
 * Ilustracoes inline dos estilos de piercing.
 *
 * Cada entrada e so o miolo do <svg>; o wrapper comum cuida de viewBox, stroke
 * e tamanho, e tudo usa currentColor para herdar a cor de selecao do card.
 */

function Bead({ cx, cy, r = 5 }) {
  return <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
}

const SHAPES = {
  'argola-classica': <circle cx="32" cy="32" r="19" />,

  'halter-reto': (
    <>
      <line x1="16" y1="32" x2="48" y2="32" />
      <Bead cx="14" cy="32" />
      <Bead cx="50" cy="32" />
    </>
  ),

  'halter-curvo': (
    <>
      <path d="M15 24 Q32 48 49 24" />
      <Bead cx="14" cy="22" />
      <Bead cx="50" cy="22" />
    </>
  ),

  // Arco aberto no topo: a esfera "presa" e o que fecha o anel.
  'captive-bead': (
    <>
      <path d="M22.5 16.8 A19 19 0 1 0 41.5 16.8" />
      <Bead cx="32" cy="13" r="6.5" />
    </>
  ),

  'circular-ferradura': (
    <>
      <path d="M20 17.5 A18 18 0 1 0 44 17.5" />
      <Bead cx="19" cy="15" />
      <Bead cx="45" cy="15" />
    </>
  ),

  'espiral-duplo': (
    <>
      <path d="M45 18 A15 15 0 1 0 47 34 A11 11 0 1 1 20 40" />
      <Bead cx="46" cy="16" r="4.5" />
      <Bead cx="19" cy="41" r="4.5" />
    </>
  ),
}

export function PiercingIllustration({ styleId, className = '' }) {
  const shape = SHAPES[styleId]
  if (!shape) return null

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={4.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shape}
    </svg>
  )
}
