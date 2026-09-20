import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.jsx'
import { painel, resetPainel, resetSessao, sessao, simulacao } from '../msw/handlers.js'
import { server } from '../msw/server.js'

/**
 * Painel completo pela rota real, incluindo o provider de sessao e o guard.
 *
 * A sessao vive num cookie HttpOnly, entao o frontend nunca sabe se esta
 * autenticado sem perguntar ao servidor — e o MSW e quem responde.
 */
beforeEach(() => {
  resetSessao()
  resetPainel()
})

function abrirPainel() {
  render(
    <MemoryRouter initialEntries={['/secret/adm']}>
      <App />
    </MemoryRouter>
  )
}

async function entrar(usuario = 'admin', senha = 'segredo') {
  await userEvent.type(screen.getByLabelText('Usuário'), usuario)
  await userEvent.type(screen.getByLabelText('Senha'), senha)
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

const esperarLogin = () => screen.findByRole('heading', { name: 'Painel administrativo' })
const esperarPainel = () => screen.findByRole('heading', { name: 'Simulações' })

describe('verificacao inicial da sessao', () => {
  it('mostra o estado de verificacao antes de decidir a tela', async () => {
    abrirPainel()

    // Ate a resposta chegar nao da para escolher entre login e painel.
    expect(screen.getByRole('status')).toHaveTextContent('Verificando sessão…')

    await esperarLogin()
  })

  it('sem sessao valida, cai no login', async () => {
    abrirPainel()

    expect(await esperarLogin()).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Simulações' })).not.toBeInTheDocument()
  })

  it('com sessao valida, entra direto no painel', async () => {
    sessao.autenticada = true

    abrirPainel()

    expect(await esperarPainel()).toBeInTheDocument()
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument()
  })

  it('a URL nao muda ao cair no login', async () => {
    // Renderizar o login no lugar, em vez de redirecionar, evita que o caminho
    // vaze pelo historico de navegacao.
    abrirPainel()
    await esperarLogin()

    expect(window.location.pathname).not.toContain('login')
  })
})

describe('login', () => {
  it('credencial errada mostra o erro e mantem a tela', async () => {
    abrirPainel()
    await esperarLogin()

    await entrar('admin', 'errada')

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha inválidos.')
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument()
  })

  it('a senha e limpa depois de uma tentativa falha', async () => {
    abrirPainel()
    await esperarLogin()

    await entrar('admin', 'errada')
    await screen.findByRole('alert')

    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(screen.getByLabelText('Usuário')).toHaveValue('admin')
  })

  it('o botao volta a ficar disponivel apos a falha', async () => {
    abrirPainel()
    await esperarLogin()

    await entrar('admin', 'errada')
    await screen.findByRole('alert')

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('o bloqueio por tentativas aparece com a mensagem do servidor', async () => {
    server.use(
      http.post('/api/admin/login', () =>
        HttpResponse.json(
          { ok: false, error: 'Muitas tentativas. Tente de novo em 15 minuto(s).' },
          { status: 429 }
        )
      )
    )

    abrirPainel()
    await esperarLogin()
    await entrar()

    expect(await screen.findByRole('alert')).toHaveTextContent('Tente de novo em 15 minuto(s).')
  })

  it('credencial correta abre o painel', async () => {
    painel.total = 1
    painel.items = [simulacao()]

    abrirPainel()
    await esperarLogin()

    await entrar()

    expect(await esperarPainel()).toBeInTheDocument()
    expect(await screen.findByRole('article')).toBeInTheDocument()
  })

  it('os campos tem autocomplete adequado para gerenciadores de senha', async () => {
    abrirPainel()
    await esperarLogin()

    expect(screen.getByLabelText('Usuário')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password')
  })
})

describe('sessao ativa', () => {
  it('o ciclo entrar, listar e sair volta ao login', async () => {
    painel.total = 1
    painel.items = [simulacao()]

    abrirPainel()
    await esperarLogin()
    await entrar()
    await esperarPainel()

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await esperarLogin()).toBeInTheDocument()
    await waitFor(() => expect(sessao.autenticada).toBe(false))
  })

  it('a saida volta ao login mesmo se o servidor falhar', async () => {
    // Deixar o painel aberto seria pior do que a falha silenciosa.
    sessao.autenticada = true
    server.use(http.post('/api/admin/logout', () => HttpResponse.error()))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    abrirPainel()
    await esperarPainel()

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await esperarLogin()).toBeInTheDocument()
  })

  it('a listagem so e buscada depois de haver sessao', async () => {
    const espiao = vi.spyOn(globalThis, 'fetch')

    abrirPainel()
    await esperarLogin()

    const caminhos = espiao.mock.calls.map((chamada) => chamada[0])
    expect(caminhos).toContain('/api/admin/session')
    expect(caminhos).not.toContain('/api/admin/simulations')
  })
})
