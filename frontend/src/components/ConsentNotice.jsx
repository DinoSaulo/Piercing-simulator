import { useState } from 'react'
import { TermsOfUseModal } from './TermsOfUseModal.jsx'

export function ConsentNotice({ checked, onChange }) {
  const [termsOpen, setTermsOpen] = useState(false)

  return (
    <div className="space-y-3 rounded-xl border border-ink-800 bg-ink-900/60 p-4">
      <label className="flex cursor-pointer items-start gap-3 text-sm text-steel-200">
        <input
          type="checkbox"
          required
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-accent-500)]"
        />
        <span>
          Concordo com os{' '}
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="font-medium text-accent-500 underline underline-offset-2 hover:text-accent-400"
          >
            termos de uso
          </button>{' '}
          do site.
        </span>
      </label>

      <TermsOfUseModal isOpen={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  )
}
