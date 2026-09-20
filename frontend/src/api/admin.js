/**
 * Cliente do painel administrativo.
 *
 * A sessão vive num cookie HttpOnly: o JavaScript não lê nem escreve o token,
 * só o envia junto das requisições. Por isso não há nada guardado aqui nem em
 * localStorage — quem sabe se a sessão é válida é o servidor.
 *
 * Os caminhos são relativos porque tanto o proxy do Vite (dev) quanto o rewrite
 * do vercel.json (produção) mantêm a API na mesma origem do site.
 */

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(payload?.error ?? `A API respondeu ${response.status}.`)
    error.status = response.status
    throw error
  }

  return payload
}

export function adminLogin(username, password) {
  return request('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export function adminLogout() {
  return request('/api/admin/logout', { method: 'POST' })
}

export function adminSession() {
  return request('/api/admin/session')
}

export function adminSimulations() {
  return request('/api/admin/simulations')
}
