import { useCallback, useEffect, useState } from 'react'
import { useAdminSession } from '../admin/adminSessionContext.js'
import { ImageLightbox } from '../admin/ImageLightbox.jsx'
import { adminSimulations } from '../api/admin.js'
import { labelForStyle } from '../data/piercingStyles.js'

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium',
})

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// "Outro" sozinho não diz nada: o que interessa é o texto que a pessoa digitou.
function describe(value, other) {
  return other ? `${value} — ${other}` : value
}

export function AdminDashboard() {
  const { username, signOut } = useAdminSession()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [zoomed, setZoomed] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      setData(await adminSimulations())
    } catch (loadError) {
      // Sessão expirada no meio da navegação volta para o login em vez de
      // deixar um erro genérico na tela.
      if (loadError.status === 401) {
        await signOut()
        return
      }
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [signOut])

  /* oxlint-disable react/set-state-in-effect */
  // Carga inicial da lista: o dado vem de uma chamada HTTP, que é o sistema
  // externo com que este componente sincroniza. Não há como derivá-lo durante a
  // renderização. O botão "Atualizar" reusa a mesma função pelo caminho normal.
  useEffect(() => {
    load()
  }, [load])
  /* oxlint-enable react/set-state-in-effect */

  const items = data?.items ?? []
  const hidden = (data?.total ?? 0) - items.length

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <main className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-accent-500 uppercase">
              Área restrita
            </p>
            <h1 className="mt-2 text-2xl font-bold text-steel-200 sm:text-3xl">Simulações</h1>
            <p className="mt-2 text-sm text-steel-400">
              {data ? (
                <>
                  <strong className="text-steel-200">{data.total}</strong>{' '}
                  {data.total === 1 ? 'simulação cadastrada' : 'simulações cadastradas'}
                  {hidden > 0 && ` · exibindo as ${items.length} mais recentes`}
                </>
              ) : (
                'Carregando…'
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {username && <span className="mr-1 text-sm text-steel-400/70">{username}</span>}
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-xl border border-ink-800 bg-ink-900 px-4 py-2 text-sm font-medium text-steel-200 transition-colors hover:border-ink-700 hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-xl border border-ink-800 bg-ink-900 px-4 py-2 text-sm font-medium text-steel-400 transition-colors hover:border-red-500/40 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:outline-none"
            >
              Sair
            </button>
          </div>
        </header>

        {error && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="rounded-2xl border border-ink-800 bg-ink-900/40 px-4 py-12 text-center text-sm text-steel-400">
            Nenhuma simulação cadastrada ainda.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const createdAtLabel = dateFormat.format(new Date(item.createdAt))

            return (
              <article
                key={item.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/40"
              >
                {item.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => setZoomed({ ...item, createdAtLabel })}
                    className="group relative aspect-[4/3] w-full overflow-hidden bg-ink-950 focus-visible:ring-2 focus-visible:ring-accent-500/50 focus-visible:outline-none focus-visible:ring-inset"
                  >
                    <img
                      src={item.imageUrl}
                      alt={`Simulação enviada em ${createdAtLabel}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 to-transparent px-3 py-2 text-left text-xs text-steel-200 opacity-0 transition-opacity group-hover:opacity-100">
                      Abrir em tamanho real
                    </span>
                  </button>
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-ink-950 px-4 text-center text-xs text-steel-400/60">
                    Imagem indisponível no storage
                  </div>
                )}

                <dl className="flex-1 space-y-2 p-4 text-sm">
                  <Row label="Enviada em" value={createdAtLabel} />
                  <Row label="Gênero" value={describe(item.gender, item.genderOther)} />
                  <Row
                    label="Parte do corpo"
                    value={describe(item.bodyPart, item.bodyPartOther)}
                  />
                  <Row label="Estilo" value={labelForStyle(item.style)} />
                  <Row label="Arquivo" value={formatBytes(item.imageSize)} />
                </dl>
              </article>
            )
          })}
        </div>
      </main>

      {zoomed && <ImageLightbox item={zoomed} onClose={() => setZoomed(null)} />}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-steel-400/60">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-steel-200">{value}</dd>
    </div>
  )
}
