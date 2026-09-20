import { useState } from 'react'
import { useAdminSession } from '../admin/adminSessionContext.js'

export function AdminLogin() {
  const { signIn } = useAdminSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await signIn(username, password)
    } catch (submitError) {
      setError(submitError.message)
      setPassword('')
      setSubmitting(false)
    }
    // Em caso de sucesso não há setState aqui: a sessão muda e este componente
    // sai da árvore. Mexer no estado depois disso seria escrever em um
    // componente desmontado.
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <main className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-accent-500 uppercase">
            Área restrita
          </p>
          <h1 className="mt-3 text-2xl font-bold text-steel-200">Painel administrativo</h1>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-ink-800 bg-ink-900/40 p-6"
        >
          <div className="space-y-2">
            <label htmlFor="admin-username" className="block text-sm font-medium text-steel-200">
              Usuário
            </label>
            <input
              id="admin-username"
              name="username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-xl border border-ink-800 bg-ink-900 px-4 py-2.5 text-sm text-steel-200 transition-colors outline-none placeholder:text-steel-400/40 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="admin-password" className="block text-sm font-medium text-steel-200">
              Senha
            </label>
            <input
              id="admin-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-ink-800 bg-ink-900 px-4 py-2.5 text-sm text-steel-200 transition-colors outline-none placeholder:text-steel-400/40 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-300"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-accent-500 px-4 py-3 text-sm font-semibold text-ink-950 transition-all duration-200 hover:bg-accent-400 focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </main>
    </div>
  )
}
