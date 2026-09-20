import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminLogin, adminLogout, adminSession } from '../api/admin.js'
import { AdminSessionContext } from './adminSessionContext.js'

/**
 * Estado da sessão do painel.
 *
 * Como o cookie é HttpOnly, o frontend não tem como inspecionar o token — a
 * única forma de saber se há sessão é perguntar ao servidor. Daí o estado
 * começar em "loading": até a resposta chegar, não dá para decidir entre
 * mostrar o login e mostrar o painel.
 */
export function AdminSessionProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', username: null })

  const refresh = useCallback(async () => {
    try {
      const result = await adminSession()
      setState({ status: 'authenticated', username: result.username })
    } catch {
      setState({ status: 'anonymous', username: null })
    }
  }, [])

  /* oxlint-disable react/set-state-in-effect */
  // A sessão mora num cookie que só o servidor enxerga: não há como derivá-la
  // durante a renderização nem inicializá-la no useState. Perguntar à API na
  // montagem é exatamente o "sincronizar com um sistema externo" que a regra
  // abre exceção para.
  useEffect(() => {
    refresh()
  }, [refresh])
  /* oxlint-enable react/set-state-in-effect */

  const signIn = useCallback(async (username, password) => {
    const result = await adminLogin(username, password)
    setState({ status: 'authenticated', username: result.username })
  }, [])

  const signOut = useCallback(async () => {
    // Só o servidor consegue apagar um cookie HttpOnly. Se a chamada falhar, a
    // tela volta para o login mesmo assim — deixar o painel aberto seria pior.
    try {
      await adminLogout()
    } catch (error) {
      console.error('[admin] falha ao encerrar a sessão no servidor', error)
    }
    setState({ status: 'anonymous', username: null })
  }, [])

  const value = useMemo(
    () => ({ ...state, refresh, signIn, signOut }),
    [state, refresh, signIn, signOut]
  )

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}
