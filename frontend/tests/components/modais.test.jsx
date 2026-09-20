import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgeGateModal } from '../../src/components/AgeGateModal.jsx'
import { ConsentNotice } from '../../src/components/ConsentNotice.jsx'
import { FakeErrorScreen } from '../../src/components/FakeErrorScreen.jsx'
import { LOADING_DURATION_MS, LoadingModal } from '../../src/components/LoadingModal.jsx'

describe('AgeGateModal', () => {
  it('e um dialogo modal rotulado', () => {
    render(<AgeGateModal onConfirm={vi.fn()} />)

    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Você tem mais de 18 anos?')).toBeInTheDocument()
  })

  it('"Sim" libera o conteudo', async () => {
    const onConfirm = vi.fn()
    render(<AgeGateModal onConfirm={onConfirm} />)

    await userEvent.click(screen.getByRole('button', { name: 'Sim, tenho 18+' }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('"Nao" tira a pessoa do site', async () => {
    // replace() e nao assign(): o site nao pode ficar no historico para o
    // botao "voltar" trazer de volta.
    const replace = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ replace })

    const onConfirm = vi.fn()
    render(<AgeGateModal onConfirm={onConfirm} />)

    await userEvent.click(screen.getByRole('button', { name: 'Não' }))

    expect(replace).toHaveBeenCalledWith('https://www.google.com')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('o botao de confirmar recebe o foco ao abrir', () => {
    render(<AgeGateModal onConfirm={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Sim, tenho 18+' })).toHaveFocus()
  })
})

describe('ConsentNotice', () => {
  it('diz que a imagem sera enviada e armazenada no servidor', () => {
    render(<ConsentNotice checked={false} onChange={vi.fn()} />)

    expect(screen.getByText(/será enviada, armazenada no/)).toBeInTheDocument()
  })

  it('avisa explicitamente que a administracao ve as fotos', () => {
    // "armazenada" sozinho nao descreve isso para quem manda uma foto intima.
    render(<ConsentNotice checked={false} onChange={vi.fn()} />)

    expect(screen.getByText(/poderá ser vista pela administração do site/)).toBeInTheDocument()
  })

  it('o aceite e obrigatorio e reflete o estado recebido', () => {
    const { rerender } = render(<ConsentNotice checked={false} onChange={vi.fn()} />)

    const caixa = screen.getByRole('checkbox')
    expect(caixa).toBeRequired()
    expect(caixa).not.toBeChecked()

    rerender(<ConsentNotice checked onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('avisa a mudanca com o valor booleano', async () => {
    const onChange = vi.fn()
    render(<ConsentNotice checked={false} onChange={onChange} />)

    await userEvent.click(screen.getByRole('checkbox'))

    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('LoadingModal', () => {
  /**
   * A barra le o relogio dentro de requestAnimationFrame. Com timers falsos, o
   * rAF do jsdom vira um timer comum e `performance.now()` acompanha o relogio
   * falso, entao avancar o tempo avanca a barra de forma deterministica.
   */
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function avancar(ms) {
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  }

  it('comeca em zero, com o primeiro passo descrito', () => {
    render(<LoadingModal onComplete={vi.fn()} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByText('Analisando a imagem…')).toBeInTheDocument()
  })

  it('a barra avanca com o tempo', () => {
    render(<LoadingModal onComplete={vi.fn()} />)

    avancar(LOADING_DURATION_MS / 2)

    const valor = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))
    expect(valor).toBeGreaterThan(30)
    expect(valor).toBeLessThan(70)
  })

  it('o texto do passo acompanha o progresso', () => {
    render(<LoadingModal onComplete={vi.fn()} />)

    avancar(LOADING_DURATION_MS * 0.6)

    expect(screen.getByText('Posicionando o piercing…')).toBeInTheDocument()
  })

  it('chama onComplete ao fim dos 4 segundos', () => {
    const onComplete = vi.fn()
    render(<LoadingModal onComplete={onComplete} />)

    avancar(LOADING_DURATION_MS - 100)
    expect(onComplete).not.toHaveBeenCalled()

    avancar(200)
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('a barra chega a 100 junto com o fim', () => {
    render(<LoadingModal onComplete={vi.fn()} />)

    avancar(LOADING_DURATION_MS + 50)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('nao chama onComplete depois de desmontado', () => {
    // O cleanup cancela o frame pendente; sem isso seria setState em
    // componente fora da arvore.
    const onComplete = vi.fn()
    const { unmount } = render(<LoadingModal onComplete={onComplete} />)

    avancar(LOADING_DURATION_MS / 2)
    unmount()
    avancar(LOADING_DURATION_MS)

    expect(onComplete).not.toHaveBeenCalled()
  })

  it('tem os limites de progresso declarados para leitores de tela', () => {
    render(<LoadingModal onComplete={vi.fn()} />)

    const barra = screen.getByRole('progressbar')
    expect(barra).toHaveAttribute('aria-valuemin', '0')
    expect(barra).toHaveAttribute('aria-valuemax', '100')
  })
})

describe('FakeErrorScreen', () => {
  it('apresenta a tela de erro cenografica', () => {
    render(<FakeErrorScreen />)

    expect(document.body.textContent).toMatch(/500|erro|Error/i)
  })

  it('o conteudo se mantem estavel entre renders', () => {
    // O traceId e sorteado uma vez por montagem (useMemo); se mudasse a cada
    // render, a tela piscaria numeros diferentes.
    const { rerender, container } = render(<FakeErrorScreen />)
    const antes = container.innerHTML

    rerender(<FakeErrorScreen />)

    expect(container.innerHTML).toBe(antes)
  })
})
