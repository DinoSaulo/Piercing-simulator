/**
 * Aviso de armazenamento + aceite obrigatorio.
 *
 * A imagem sai do dispositivo e fica guardada no servidor; a pessoa precisa
 * saber disso antes de enviar, nao depois.
 *
 * O texto menciona explicitamente que a administracao do site pode ver a foto.
 * Existe um painel em /secret/adm exatamente para isso, e "armazenada" sozinho
 * nao descreve isso para quem esta mandando uma foto intima.
 */
export function ConsentNotice({ checked, onChange }) {
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
          Tenho 18 anos ou mais, a imagem é minha e entendo que ela será enviada, armazenada no
          servidor e poderá ser vista pela administração do site.
        </span>
      </label>
    </div>
  )
}
