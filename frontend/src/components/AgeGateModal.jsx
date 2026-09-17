const EXIT_URL = 'https://www.google.com'

/**
 * Portao de idade. "Nao" tira a pessoa do site; "Sim" libera o conteudo.
 */
export function AgeGateModal({ onConfirm }) {
  function handleDecline() {
    window.location.replace(EXIT_URL)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/90 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-ink-800 bg-ink-900 p-6 text-center shadow-2xl sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-accent-500 uppercase">
          Conteúdo adulto
        </p>

        <h2 id="age-gate-title" className="mt-3 text-2xl font-bold text-steel-200">
          Você tem mais de 18 anos?
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-steel-400">
          Este site contém conteúdo adulto e é destinado exclusivamente a maiores de idade.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="flex-1 rounded-lg bg-accent-500 px-5 py-3 font-semibold text-ink-950 transition-colors hover:bg-accent-400 focus-visible:ring-2 focus-visible:ring-accent-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 focus-visible:outline-none"
          >
            Sim, tenho 18+
          </button>
          <button
            type="button"
            onClick={handleDecline}
            className="flex-1 rounded-lg border border-ink-700 px-5 py-3 font-semibold text-steel-400 transition-colors hover:bg-ink-800 hover:text-steel-200 focus-visible:ring-2 focus-visible:ring-steel-400/40 focus-visible:outline-none"
          >
            Não
          </button>
        </div>
      </div>
    </div>
  )
}
