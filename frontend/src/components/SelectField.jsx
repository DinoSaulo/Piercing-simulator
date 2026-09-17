import { useId } from 'react'
import { FadeReveal } from './FadeReveal.jsx'
import { OTHER_OPTION } from '../constants.js'

/**
 * Select + input de texto que aparece em fade quando "Outro" e escolhido.
 */
export function SelectField({
  label,
  options,
  value,
  onChange,
  otherValue,
  onOtherChange,
  otherLabel,
  otherPlaceholder,
}) {
  const selectId = useId()
  const otherId = useId()
  const showOther = value === OTHER_OPTION

  return (
    <div className="space-y-2">
      <label htmlFor={selectId} className="block text-sm font-medium text-steel-200">
        {label}
      </label>

      <select
        id={selectId}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 text-steel-200 outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
      >
        <option value="" disabled>
          Selecione…
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <FadeReveal show={showOther}>
        <div className="pt-2">
          <label htmlFor={otherId} className="mb-1.5 block text-sm text-steel-400">
            {otherLabel}
          </label>
          <input
            id={otherId}
            type="text"
            maxLength={80}
            required={showOther}
            value={otherValue}
            placeholder={otherPlaceholder}
            onChange={(event) => onOtherChange(event.target.value)}
            className="w-full rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 text-steel-200 placeholder:text-ink-700 outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
          />
        </div>
      </FadeReveal>
    </div>
  )
}
