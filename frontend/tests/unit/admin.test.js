import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminLogin, adminLogout, adminSession, adminSimulations } from '../../src/api/admin.js'
import { painel, resetPainel, resetSessao, sessao, simulacao } from '../msw/handlers.js'
import { server } from '../msw/server.js'

beforeEach(() => {
  resetSessao()
  resetPainel()
})

describe('adminLogin', () => {
  it('envia usuario e senha em JSON e devolve o usuario', async () => {
    await expect(adminLogin('admin', 'segredo')).resolves.toEqual({ ok: true, username: 'admin' })
    expect(sessao.autenticada).toBe(true)
  })

  it('credencial errada vira erro com a mensagem da API', async () => {
    await expect(adminLogin('admin', 'errada')).rejects.toThrow('Usuário ou senha inválidos.')
  })

  it('o status HTTP fica acessivel no erro', async () => {
    // O painel usa isso para distinguir sessao expirada (401) de falha geral.
    await expect(adminLogin('admin', 'errada')).rejects.toMatchObject({ status: 401 })
  })

  it('bloqueio por tentativas chega como 429', async () => {
    server.use(
      http.post('/api/admin/login', () =>
        HttpResponse.json(
          { ok: false, error: 'Muitas tentativas. Tente de novo em 15 minuto(s).' },
          { status: 429 }
        )
      )
    )

    await expect(adminLogin('admin', 'segredo')).rejects.toMatchObject({
      status: 429,
      message: 'Muitas tentativas. Tente de novo em 15 minuto(s).',
    })
  })
})

describe('adminSession', () => {
  it('sem sessao, rejeita com 401', async () => {
    await expect(adminSession()).rejects.toMatchObject({ status: 401 })
  })

  it('com sessao, devolve o usuario', async () => {
    sessao.autenticada = true

    await expect(adminSession()).resolves.toMatchObject({ ok: true, username: 'admin' })
  })
})

describe('adminLogout', () => {
  it('encerra a sessao no servidor', async () => {
    sessao.autenticada = true

    await adminLogout()

    expect(sessao.autenticada).toBe(false)
  })
})

describe('adminSimulations', () => {
  it('sem sessao, rejeita com 401', async () => {
    await expect(adminSimulations()).rejects.toMatchObject({ status: 401 })
  })

  it('devolve a listagem com total e itens', async () => {
    sessao.autenticada = true
    painel.total = 3
    painel.items = [simulacao()]

    const resultado = await adminSimulations()

    expect(resultado.total).toBe(3)
    expect(resultado.items).toHaveLength(1)
    expect(resultado.items[0].style).toBe('areola')
  })
})

describe('transporte', () => {
  it('toda chamada manda o cookie de sessao junto', async () => {
    // O cookie e HttpOnly: o JavaScript nao o le, so precisa pedir que o
    // browser o envie. Sem credentials: 'include' o painel nunca autentica.
    const espiao = vi.spyOn(globalThis, 'fetch')
    sessao.autenticada = true

    await adminSession()
    await adminSimulations()
    await adminLogout()

    for (const chamada of espiao.mock.calls) {
      expect(chamada[1]).toMatchObject({ credentials: 'include' })
    }
    expect(espiao.mock.calls.length).toBe(3)
  })

  it('usa caminhos relativos, mantendo a API na mesma origem', async () => {
    const espiao = vi.spyOn(globalThis, 'fetch')
    sessao.autenticada = true

    await adminSession()

    expect(espiao.mock.calls[0][0]).toBe('/api/admin/session')
  })
})
