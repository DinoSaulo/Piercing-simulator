import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.jsx'
import { LOADING_DURATION_MS } from '../../src/components/LoadingModal.jsx'
import { enviadas, resetEnviadas } from '../msw/handlers.js'
import { server } from '../msw/server.js'

beforeEach(resetEnviadas)

function abrir(rota = '/') {
  render(
    <MemoryRouter initialEntries={[rota]}>
      <App />
    </MemoryRouter>
  )
}

const passarPeloPortao = () => userEvent.click(screen.getByRole('button', { name: 'Sim, tenho 18+' }))

function anexarFoto(nome = 'minha-foto.png') {
  const input = document.querySelectorAll('input[type="file"]')[0]
  fireEvent.change(input, {
    target: { files: [new File([new Uint8Array(256)], nome, { type: 'image/png' })] },
  })
}

async function preencher() {
  await userEvent.selectOptions(screen.getByLabelText('Gênero'), 'Feminino')
  await userEvent.selectOptions(screen.getByLabelText('Parte do corpo'), 'Clítoris')
  await userEvent.click(screen.getByRole('radio', { name: /VCH/ }))
  anexarFoto()
  await userEvent.click(screen.getByRole('checkbox'))
}

const enviarFormulario = () => fireEvent.submit(document.querySelector('form'))

/**
 * Envia o formulario e pula os 4 segundos da barra de progresso.
 *
 * Os timers falsos precisam envolver o envio, nao so a espera: a barra agenda
 * o primeiro requestAnimationFrame no momento em que monta, e um frame
 * agendado com o rAF real nao seria avancado depois.
 *
 * Fora daqui os timers sao reais. Ligados durante o userEvent, travam tudo: o
 * userEvent agenda o proprio trabalho em timers e o MSW precisa de timers
 * reais para resolver a requisicao.
 */
async function enviarEPularABarra() {
  vi.useFakeTimers()
  try {
    enviarFormulario()

    // A barra aparece na hora: a tela nao espera a resposta da API.
    expect(screen.getByRole('progressbar')).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(LOADING_DURATION_MS + 100))
  } finally {
    vi.useRealTimers()
  }
}

describe('portao de idade', () => {
  it('abre bloqueando o conteudo', () => {
    abrir()

    expect(screen.getByRole('dialog', { name: /18 anos/ })).toBeInTheDocument()
    // `inert` impede foco e clique no que esta atras, nao so visualmente.
    expect(document.querySelector('[inert]')).toBeInTheDocument()
  })

  it('confirmar a idade libera o formulario', async () => {
    abrir()

    await passarPeloPortao()

    expect(screen.queryByRole('dialog', { name: /18 anos/ })).not.toBeInTheDocument()
    expect(document.querySelector('[inert]')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar simulação' })).toBeInTheDocument()
  })

  it('o titulo do simulador esta na pagina desde o inicio', () => {
    abrir()

    expect(
      screen.getByRole('heading', { name: 'Simulador de piercings corporais +18' })
    ).toBeInTheDocument()
  })
})

describe('fluxo completo', () => {
  it('do formulario a tela de erro cenografica', async () => {
    abrir()
    await passarPeloPortao()
    await preencher()

    await enviarEPularABarra()

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(document.body.textContent).toMatch(/500|Error/i)
  })

  it('o envio chega a API com os campos do formulario', async () => {
    abrir()
    await passarPeloPortao()
    await preencher()

    enviarFormulario()

    await waitFor(() => expect(enviadas).toHaveLength(1))
    expect(enviadas[0]).toMatchObject({
      gender: 'Feminino',
      bodyPart: 'Clítoris',
      style: 'vch',
      consent: 'true',
      imageName: 'minha-foto.png',
      imageType: 'image/png',
    })
  })

  it('a tela so oferece estilos da parte escolhida', async () => {
    abrir()
    await passarPeloPortao()

    await userEvent.selectOptions(screen.getByLabelText('Parte do corpo'), 'Glande')

    expect(screen.getAllByRole('radio').map((input) => input.value)).toEqual([
      'prince-albert',
      'prince-albert-reverso',
      'apadravya',
      'ampallang',
      'dydoe',
    ])
  })

  it('o aviso do Clitoris aparece junto com os estilos', async () => {
    abrir()
    await passarPeloPortao()

    await userEvent.selectOptions(screen.getByLabelText('Parte do corpo'), 'Clítoris')

    expect(screen.getByRole('note')).toHaveTextContent(/danos nervosos/)
  })

  it('formulario incompleto nao sai da tela', async () => {
    abrir()
    await passarPeloPortao()

    await userEvent.click(screen.getByRole('checkbox'))
    enviarFormulario()

    expect(screen.getByText('Escolha um estilo de piercing.')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(enviadas).toHaveLength(0)
  })

  it('falha da API nao muda o que a pessoa ve', async () => {
    // O desfecho e sempre o mesmo; o resultado real so vai para o console.
    server.use(
      http.post('/api/simulate', () =>
        HttpResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 })
      )
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})

    abrir()
    await passarPeloPortao()
    await preencher()

    await enviarEPularABarra()

    expect(document.body.textContent).toMatch(/500|Error/i)
  })
})

describe('rotas', () => {
  it('uma rota desconhecida cai no simulador', () => {
    abrir('/qualquer/coisa')

    expect(screen.getByRole('dialog', { name: /18 anos/ })).toBeInTheDocument()
  })

  it('a home nao consulta a sessao do painel', async () => {
    // O provider envolve so o ramo administrativo; a home nao tem por que
    // bater em /api/admin/session a cada carregamento.
    const espiao = vi.spyOn(globalThis, 'fetch')

    abrir()
    await passarPeloPortao()

    expect(espiao).not.toHaveBeenCalled()
  })
})
