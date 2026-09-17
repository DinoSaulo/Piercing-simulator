import { useEffect, useRef, useState } from 'react'

const MAX_BYTES = 10 * 1024 * 1024

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Upload de imagem com dois caminhos: arquivo do dispositivo ou camera.
 *
 * Sao dois inputs porque o atributo `capture` sozinho forca a camera no mobile e
 * tira a opcao da galeria — com inputs separados o usuario escolhe qual quer.
 */
export function ImageUploadField({ file, onChange, error }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const galleryInput = useRef(null)
  const cameraInput = useRef(null)
  const [localError, setLocalError] = useState('')

  // Object URLs sao um recurso externo: criacao e revogacao andam em par, e o
  // cleanup do efeito e o unico ponto que garante a revogacao na troca de
  // arquivo e no unmount. Por isso a URL vive em estado atualizado pelo efeito.
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  /* oxlint-enable react/set-state-in-effect */

  function handleSelect(event) {
    const selected = event.target.files?.[0]
    event.target.value = '' // permite reescolher o mesmo arquivo depois

    if (!selected) return

    if (selected.size > MAX_BYTES) {
      setLocalError(`A imagem tem ${formatSize(selected.size)}. O limite é 10 MB.`)
      onChange(null)
      return
    }

    setLocalError('')
    onChange(selected)
  }

  const message = localError || error

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-steel-200">Sua foto</span>

      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        onChange={handleSelect}
        className="sr-only"
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleSelect}
        className="sr-only"
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => galleryInput.current?.click()}
          className="rounded-lg border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm font-medium text-steel-200 transition-colors hover:border-steel-400/40 hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:outline-none"
        >
          Escolher arquivo
        </button>
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          className="rounded-lg border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm font-medium text-steel-200 transition-colors hover:border-steel-400/40 hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:outline-none"
        >
          Usar câmera
        </button>
      </div>

      {previewUrl && (
        <div className="flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-900 p-3">
          <img
            src={previewUrl}
            alt="Pré-visualização da imagem selecionada"
            className="h-16 w-16 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-steel-200">{file.name}</p>
            <p className="text-xs text-steel-400/70">{formatSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md px-2 py-1 text-xs text-steel-400 transition-colors hover:bg-ink-800 hover:text-accent-400"
          >
            Remover
          </button>
        </div>
      )}

      {message && <p className="text-sm text-accent-400">{message}</p>}
    </div>
  )
}
