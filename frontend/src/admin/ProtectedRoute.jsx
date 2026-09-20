import { AdminLogin } from '../pages/AdminLogin.jsx'
import { useAdminSession } from './adminSessionContext.js'

/**
 * Bloqueia o conteúdo administrativo enquanto não houver sessão.
 *
 * Em vez de redirecionar para outra rota, renderiza o login no lugar: a URL
 * continua /secret/adm e o caminho não vaza pelo histórico de navegação como um
 * redirecionamento vazaria.
 *
 * Isto é conveniência de interface, não segurança — quem protege os dados é o
 * middleware da API. Sem o cookie válido, /api/admin/simulations responde 401
 * por mais que alguém remova este componente pelo devtools.
 */
export function ProtectedRoute({ children }) {
  const { status } = useAdminSession()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-steel-400" role="status">
          Verificando sessão…
        </p>
      </div>
    )
  }

  if (status !== 'authenticated') {
    return <AdminLogin />
  }

  return children
}
