import { createContext, useContext } from 'react'

/**
 * Contexto e hook ficam fora do arquivo do provider porque o Fast Refresh do
 * Vite so consegue preservar estado em modulos que exportam apenas componentes.
 * Misturar hook e componente no mesmo arquivo faz o painel reiniciar (e perder
 * a lista carregada) a cada edicao.
 */
export const AdminSessionContext = createContext(null)

export function useAdminSession() {
  const value = useContext(AdminSessionContext)
  if (!value) {
    throw new Error('useAdminSession precisa estar dentro de <AdminSessionProvider>.')
  }
  return value
}
