import { useEffect } from 'react'

/**
 * Imagem em tamanho real sobre o painel.
 *
 * Abre num overlay em vez de numa aba nova de propósito: a URL assinada vale
 * para qualquer pessoa que a tenha, então não convém deixá-la na barra de
 * endereços nem no histórico do navegador.
 */
export function ImageLightbox({ item, onClose }) {
  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKey)
    // Sem isto a lista continua rolando atrás do overlay.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Imagem da simulação em tamanho real"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/90 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-lg border border-ink-800 bg-ink-900/80 px-3 py-1.5 text-sm text-steel-200 transition-colors hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:outline-none"
      >
        Fechar
      </button>

      <img
        src={item.imageUrl}
        alt={`Simulação de ${item.createdAtLabel}`}
        // O clique no overlay fecha; no próprio arquivo, não.
        onClick={(event) => event.stopPropagation()}
        className="max-h-full max-w-full rounded-xl object-contain"
      />
    </div>
  )
}
