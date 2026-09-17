import { PiercingIllustration } from './PiercingIllustration.jsx'
import { noticeForBodyPart, stylesForBodyPart } from '../data/piercingStyles.js'

function SafetyNotice({ children }) {
  return (
    <div
      role="note"
      className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <p className="text-sm leading-relaxed text-amber-100/90">{children}</p>
    </div>
  )
}

/**
 * Radiogroup custom filtrado pela parte do corpo.
 *
 * Inputs radio nativos escondidos (teclado e leitores de tela continuam
 * funcionando) com o card visivel controlado por peer-checked. Sem parte
 * selecionada, ou com "Outro", a lista cai no catalogo completo.
 */
export function PiercingStylePicker({ bodyPart, value, onChange }) {
  const styles = stylesForBodyPart(bodyPart)
  const notice = noticeForBodyPart(bodyPart)

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-steel-200">Estilo do piercing</legend>

      {notice && <SafetyNotice>{notice}</SafetyNotice>}

      <div className="grid gap-3 sm:grid-cols-2">
        {styles.map((style) => (
          <label key={style.id} className="cursor-pointer">
            <input
              type="radio"
              name="piercing-style"
              value={style.id}
              checked={value === style.id}
              onChange={() => onChange(style.id)}
              className="peer sr-only"
            />
            <div className="flex h-full items-start gap-3 rounded-xl border border-ink-800 bg-ink-900 p-4 text-left text-steel-400 transition-all duration-200 hover:border-ink-700 hover:bg-ink-800 peer-checked:border-accent-500 peer-checked:bg-accent-500/10 peer-checked:text-accent-400 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-500/50">
              <PiercingIllustration styleId={style.id} className="h-12 w-12 shrink-0" />

              <div className="min-w-0">
                <p className="text-sm font-bold leading-snug">{style.label}</p>
                {/* opacity em vez de peer-checked: a descricao nao e irma do
                    input, entao herdar a cor atual e o unico jeito que funciona. */}
                <p className="mt-1 text-xs leading-relaxed opacity-60">{style.description}</p>
              </div>
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
