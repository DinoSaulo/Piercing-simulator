import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PiercingStylePicker } from '../../src/components/PiercingStylePicker.jsx'
import { STYLE_IDS } from '../../src/data/piercingStyles.js'

function montar(props = {}) {
  const onChange = vi.fn()
  const resultado = render(
    <PiercingStylePicker bodyPart="" value="" onChange={onChange} {...props} />
  )
  return { ...resultado, onChange }
}

const opcoesVisiveis = () => screen.getAllByRole('radio').map((input) => input.value)

describe('filtragem pela parte do corpo', () => {
  it('sem parte escolhida mostra o catalogo inteiro', () => {
    montar()

    expect(opcoesVisiveis()).toEqual(STYLE_IDS)
  })

  it('mostra so os estilos da parte escolhida', () => {
    montar({ bodyPart: 'Clítoris' })

    expect(opcoesVisiveis()).toEqual(['vch', 'hch', 'triangle', 'isabella'])
  })

  it('"Outro" volta a mostrar o catalogo inteiro', () => {
    montar({ bodyPart: 'Outro' })

    expect(opcoesVisiveis()).toEqual(STYLE_IDS)
  })

  it('cada estilo aparece com rotulo e descricao', () => {
    montar({ bodyPart: 'Ânus' })

    expect(screen.getByText('Piercing Anal')).toBeInTheDocument()
    expect(screen.getByText(/esfíncter anal/)).toBeInTheDocument()
  })
})

describe('aviso de seguranca', () => {
  it('Clitoris exibe a nota tecnica do especialista', () => {
    montar({ bodyPart: 'Clítoris' })

    const aviso = screen.getByRole('note')
    expect(aviso).toHaveTextContent(/danos nervosos/)
  })

  it('partes sem aviso nao exibem a caixa', () => {
    montar({ bodyPart: 'Glande' })

    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})

describe('selecao', () => {
  it('avisa qual estilo foi escolhido', async () => {
    const { onChange } = montar({ bodyPart: 'Mamilos' })

    await userEvent.click(screen.getByRole('radio', { name: /Aréola/ }))

    expect(onChange).toHaveBeenCalledWith('areola')
  })

  it('marca o estilo recebido como valor atual', () => {
    montar({ bodyPart: 'Mamilos', value: 'areola' })

    expect(screen.getByRole('radio', { name: /Aréola/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Mamilo Padrão/ })).not.toBeChecked()
  })

  it('os radios continuam sendo inputs nativos, acessiveis por teclado', () => {
    // Os cards sao visuais; quem carrega a semantica e o input escondido.
    montar({ bodyPart: 'Ânus' })

    const radio = screen.getByRole('radio', { name: /Piercing Anal/ })
    expect(radio).toHaveAttribute('type', 'radio')
    expect(radio).toHaveAttribute('name', 'piercing-style')
  })

  it('o grupo tem legenda propria', () => {
    montar()

    expect(screen.getByRole('group', { name: 'Estilo do piercing' })).toBeInTheDocument()
  })
})
