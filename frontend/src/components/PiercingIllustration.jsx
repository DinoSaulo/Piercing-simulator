/**
 * Ilustracoes inline dos estilos de piercing.
 *
 * Cada icone tem duas camadas: um contexto anatomico esquematico em traco fino
 * esmaecido e a joia em destaque. O que diferencia os icones e a orientacao da
 * joia — vertical, horizontal, argola ou na borda —, nao o desenho do corpo,
 * que fica deliberadamente abstrato.
 *
 * Tudo em currentColor para herdar a cor de selecao do card.
 */

// --- primitivas da joia -----------------------------------------------------

function Bead({ cx, cy, r = 4.5 }) {
  return <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
}

function Barbell({ x1, y1, x2, y2 }) {
  return (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <Bead cx={x1} cy={y1} />
      <Bead cx={x2} cy={y2} />
    </>
  )
}

function Ring({ cx, cy, r, beadAt }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} />
      {beadAt && <Bead cx={beadAt[0]} cy={beadAt[1]} r={5} />}
    </>
  )
}

// --- contextos anatomicos (esquematicos) ------------------------------------

function Context({ children }) {
  return (
    <g opacity="0.28" strokeWidth="2.5">
      {children}
    </g>
  )
}

function Glans({ highlightRidge = false }) {
  return (
    <>
      <Context>
        <path d="M20 50 L20 28 A12 12 0 0 1 44 28 L44 50" />
        {!highlightRidge && <path d="M17 50 H47" />}
      </Context>
      {/* Na coroa o proprio sulco e a referencia, entao ele sai do esmaecido. */}
      {highlightRidge && <path d="M17 50 H47" strokeWidth="2.5" />}
    </>
  )
}

function Nipple() {
  return (
    <Context>
      <circle cx="32" cy="32" r="18" />
      <circle cx="32" cy="32" r="7" />
    </Context>
  )
}

function Hood() {
  return (
    <Context>
      <path d="M22 56 Q22 16 32 16 Q42 16 42 56" />
      <path d="M32 36 V50" />
      <circle cx="32" cy="53" r="3.5" />
    </Context>
  )
}

function Sphincter() {
  return (
    <Context>
      <circle cx="32" cy="32" r="13" />
      <path d="M32 19 V13 M32 45 V51 M19 32 H13 M45 32 H51 M23 23 L18 18 M41 41 L46 46 M41 23 L46 18 M23 41 L18 46" />
    </Context>
  )
}

// --- catalogo de formas -----------------------------------------------------

const SHAPES = {
  // Argola atravessando a uretra e saindo por baixo: a esfera marca a saida.
  'prince-albert': (
    <>
      <Glans />
      <Ring cx={32} cy={44} r={11} beadAt={[32, 55]} />
    </>
  ),

  // Mesmo percurso, saida invertida: a esfera sobe para o topo.
  'prince-albert-reverso': (
    <>
      <Glans />
      <Ring cx={32} cy={26} r={10} beadAt={[32, 16]} />
    </>
  ),

  apadravya: (
    <>
      <Glans />
      <Barbell x1={32} y1={13} x2={32} y2={51} />
    </>
  ),

  ampallang: (
    <>
      <Glans />
      <Barbell x1={14} y1={30} x2={50} y2={30} />
    </>
  ),

  // Fora do eixo central e curto: fica na borda, nao atravessa a glande.
  dydoe: (
    <>
      <Glans highlightRidge />
      <Barbell x1={26} y1={42} x2={26} y2={58} />
    </>
  ),

  'mamilo-padrao': (
    <>
      <Nipple />
      <Barbell x1={14} y1={32} x2={50} y2={32} />
    </>
  ),

  // Deslocada para a borda: a argola cruza a areola sem alcancar a papila.
  areola: (
    <>
      <Nipple />
      <Ring cx={16} cy={32} r={8} beadAt={[16, 24]} />
    </>
  ),

  vch: (
    <>
      <Hood />
      <Barbell x1={32} y1={12} x2={32} y2={40} />
    </>
  ),

  hch: (
    <>
      <Hood />
      <Barbell x1={16} y1={30} x2={48} y2={30} />
    </>
  ),

  triangle: (
    <>
      <Hood />
      <Barbell x1={14} y1={52} x2={50} y2={52} />
    </>
  ),

  // Mais longa que a VCH de proposito: sinaliza a profundidade.
  isabella: (
    <>
      <Hood />
      <Barbell x1={32} y1={10} x2={32} y2={58} />
    </>
  ),

  anal: (
    <>
      <Sphincter />
      <Ring cx={32} cy={45} r={9} beadAt={[32, 54]} />
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
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shape}
    </svg>
  )
}
