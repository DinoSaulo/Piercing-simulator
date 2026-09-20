import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { AdminSessionProvider } from '../../src/admin/AdminSessionProvider.jsx'
import { ProtectedRoute } from '../../src/admin/ProtectedRoute.jsx'
import { AdminDashboard } from '../../src/pages/AdminDashboard.jsx'
import { painel, resetPainel, resetSessao, sessao, simulacao } from '../msw/handlers.js'
import { server } from '../msw/server.js'

beforeEach(() => {
  resetSessao()
  resetPainel()
  sessao.autenticada = true
})

/** Monta o painel dentro do provider, como em producao. */
function montar() {
  return render(
    <AdminSessionProvider>
      <AdminDashboard />
    </AdminSessionProvider>
  )
}

const esperarCarregar = () => waitForElementToBeRemoved(() => screen.queryByText('Carregando…'))

describe('listagem', () => {
  it('mostra a mensagem de vazio quando nao ha simulacoes', async () => {
    montar()

    expect(await screen.findByText('Nenhuma simulação cadastrada ainda.')).toBeInTheDocument()
  })

  it('renderiza um card por simulacao', async () => {
    painel.total = 2
    painel.items = [simulacao({ id: 'a' }), simulacao({ id: 'b', style: 'vch' })]

    montar()
    await esperarCarregar()

    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('traduz o id do estilo para o rotulo da tela', async () => {
    // O banco guarda "areola"; a tela precisa dizer o mesmo que o formulario.
    painel.total = 1
    painel.items = [simulacao({ style: 'areola' })]

    montar()

    expect(await screen.findByText('Piercing de Aréola')).toBeInTheDocument()
  })

  it('id de estilo desconhecido aparece cru, em vez de sumir', async () => {
    painel.total = 1
    painel.items = [simulacao({ style: 'estilo-antigo' })]

    montar()

    expect(await screen.findByText('estilo-antigo')).toBeInTheDocument()
  })

  it('junta o texto livre ao valor do select', async () => {
    // "Outro" sozinho nao diz nada; o que interessa e o que a pessoa digitou.
    painel.total = 1
    painel.items = [simulacao({ gender: 'Outro', genderOther: 'Agênero' })]

    montar()

    expect(await screen.findByText('Outro — Agênero')).toBeInTheDocument()
  })

  it('sem texto livre mostra so o valor do select', async () => {
    painel.total = 1
    painel.items = [simulacao({ bodyPart: 'Mamilos', bodyPartOther: null })]

    montar()
    await esperarCarregar()

    expect(screen.getByText('Mamilos')).toBeInTheDocument()
  })

  it('formata o tamanho do arquivo', async () => {
    painel.total = 2
    painel.items = [
      simulacao({ id: 'a', imageSize: 500 * 1024 }),
      simulacao({ id: 'b', imageSize: 3 * 1024 * 1024 }),
    ]

    montar()
    await esperarCarregar()

    expect(screen.getByText('500 KB')).toBeInTheDocument()
    expect(screen.getByText('3.0 MB')).toBeInTheDocument()
  })
})

describe('contador', () => {
  it('usa singular com uma simulacao', async () => {
    painel.total = 1
    painel.items = [simulacao()]

    montar()

    expect(await screen.findByText(/simulação cadastrada/)).toBeInTheDocument()
  })

  it('usa plural com varias', async () => {
    painel.total = 2
    painel.items = [simulacao({ id: 'a' }), simulacao({ id: 'b' })]

    montar()

    expect(await screen.findByText(/simulações cadastradas/)).toBeInTheDocument()
  })

  it('avisa quando a listagem esta cortada pelo limite', async () => {
    // O total vem do banco inteiro; a lista traz so a primeira pagina.
    painel.total = 137
    painel.limit = 2
    painel.items = [simulacao({ id: 'a' }), simulacao({ id: 'b' })]

    montar()

    expect(await screen.findByText(/exibindo as 2 mais recentes/)).toBeInTheDocument()
    expect(screen.getByText('137')).toBeInTheDocument()
  })

  it('nao avisa corte quando tudo cabe', async () => {
    painel.total = 1
    painel.items = [simulacao()]

    montar()
    await esperarCarregar()

    expect(screen.queryByText(/exibindo as/)).not.toBeInTheDocument()
  })
})

describe('imagens', () => {
  it('a miniatura abre a imagem em tamanho real', async () => {
    painel.total = 1
    painel.items = [simulacao()]

    montar()
    await esperarCarregar()

    await userEvent.click(screen.getByRole('button', { name: /Simulação enviada em/ }))

    expect(screen.getByRole('dialog', { name: /tamanho real/ })).toBeInTheDocument()
  })

  it('o overlay fecha pelo botao', async () => {
    painel.total = 1
    painel.items = [simulacao()]

    montar()
    await esperarCarregar()
    await userEvent.click(screen.getByRole('button', { name: /Simulação enviada em/ }))

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('o overlay fecha com Escape', async () => {
    painel.total = 1
    painel.items = [simulacao()]

    montar()
    await esperarCarregar()
    await userEvent.click(screen.getByRole('button', { name: /Simulação enviada em/ }))

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('imagem que sumiu do bucket mostra o aviso, sem quebrar o card', async () => {
    painel.total = 1
    painel.items = [simulacao({ imageUrl: null })]

    montar()
    await esperarCarregar()

    expect(screen.getByText('Imagem indisponível no storage')).toBeInTheDocument()
    expect(screen.getByRole('article')).toBeInTheDocument()
  })
})

describe('atualizar e erros', () => {
  it('o botao atualizar recarrega a lista', async () => {
    painel.total = 0
    montar()
    await screen.findByText('Nenhuma simulação cadastrada ainda.')

    painel.total = 1
    painel.items = [simulacao()]
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    expect(await screen.findByRole('article')).toBeInTheDocument()
  })

  it('erro na listagem aparece como alerta', async () => {
    server.use(
      http.get('/api/admin/simulations', () =>
        HttpResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 })
      )
    )

    montar()

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno.')
  })

  it('sessao expirada durante a navegacao volta para o login', async () => {
    // 401 no meio do uso nao pode virar erro generico: a pessoa precisa
    // conseguir entrar de novo.
    render(
      <AdminSessionProvider>
        <ProtectedRoute>
          <AdminDashboard />
        </ProtectedRoute>
      </AdminSessionProvider>
    )

    await screen.findByText('Nenhuma simulação cadastrada ainda.')

    sessao.autenticada = false
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    expect(await screen.findByRole('heading', { name: 'Painel administrativo' })).toBeInTheDocument()
  })
})

describe('identificacao e saida', () => {
  it('mostra o usuario logado', async () => {
    montar()

    expect(await screen.findByText('admin')).toBeInTheDocument()
  })

  it('o botao sair encerra a sessao no servidor', async () => {
    montar()
    await esperarCarregar()

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))

    await waitFor(() => expect(sessao.autenticada).toBe(false))
  })
})
