import { PiercingIllustration } from './PiercingIllustration.jsx'
import { PIERCING_STYLES } from '../constants.js'

/**
 * Radiogroup custom: inputs radio nativos escondidos (teclado e leitores de tela
 * continuam funcionando) com o card visivel controlado por peer-checked.
 */
export function PiercingStylePicker({ value, onChange }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-steel-200">Estilo do piercing</legend>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PIERCING_STYLES.map((style) => (
          <label key={style.id} className="cursor-pointer">
            <input
              type="radio"
              name="piercing-style"
              value={style.id}
              checked={value === style.id}
              onChange={() => onChange(style.id)}
              className="peer sr-only"
            />
            <div className="flex h-full flex-col items-center gap-2 rounded-xl border border-ink-800 bg-ink-900 p-4 text-center text-steel-400 transition-all duration-200 hover:border-ink-700 hover:bg-ink-800 peer-checked:border-accent-500 peer-checked:bg-accent-500/10 peer-checked:text-accent-400 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-500/50">
              <PiercingIllustration styleId={style.id} className="h-12 w-12" />
              <span className="text-sm font-medium leading-tight">{style.label}</span>
              {/* opacity em vez de peer-checked: o hint nao e irmao do input,
                  entao herdar a cor atual e o unico jeito que funciona. */}
              <span className="text-xs leading-tight opacity-60">{style.hint}</span>
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
