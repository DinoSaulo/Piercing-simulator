import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SimulationForm } from '../../src/components/SimulationForm.jsx'

function montar() {
  const onSubmit = vi.fn()
  const resultado = render(<SimulationForm onSubmit={onSubmit} />)
  return { ...resultado, onSubmit }
}

const imagem = (nome = 'foto.png') => new File([new Uint8Array(64)], nome, { type: 'image/png' })

function anexar(arquivo = imagem()) {
  const input = document.querySelectorAll('input[type="file"]')[0]
  fireEvent.change(input, { target: { files: [arquivo] } })
}

const enviar = () => fireEvent.submit(document.querySelector('form'))

async function marcarConsentimento() {
  await userEvent.click(screen.getByRole('checkbox'))
}

async function preencherTudo() {
  await userEvent.selectOptions(screen.getByLabelText('Gênero'), 'Feminino')
  await userEvent.selectOptions(screen.getByLabelText('Parte do corpo'), 'Mamilos')
  await userEvent.click(screen.getByRole('radio', { name: /Aréola/ }))
  anexar()
  await marcarConsentimento()
}

describe('consentimento', () => {
  it('o botao comeca desabilitado', () => {
    montar()

    expect(screen.getByRole('button', { name: 'Criar simulação' })).toBeDisabled()
  })

  it('marcar o aceite habilita o botao', async () => {
    montar()

    await marcarConsentimento()

    expect(screen.getByRole('button', { name: 'Criar simulação' })).toBeEnabled()
  })

  it('desmarcar volta a desabilitar', async () => {
    montar()

    await marcarConsentimento()
    await marcarConsentimento()

    expect(screen.getByRole('button', { name: 'Criar simulação' })).toBeDisabled()
  })
})

describe('validacao dos campos sem equivalente nativo', () => {
  it('sem estilo e sem imagem, mostra as duas mensagens e nao envia', async () => {
    const { onSubmit } = montar()

    await marcarConsentimento()
    enviar()

    expect(screen.getByText('Escolha um estilo de piercing.')).toBeInTheDocument()
    expect(screen.getByText('Envie uma foto para gerar a simulação.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('so a imagem faltando deixa so a mensagem da imagem', async () => {
    const { onSubmit } = montar()

    await userEvent.click(screen.getByRole('radio', { name: /Aréola/ }))
    await marcarConsentimento()
    enviar()

    expect(screen.queryByText('Escolha um estilo de piercing.')).not.toBeInTheDocument()
    expect(screen.getByText('Envie uma foto para gerar a simulação.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('escolher o estilo apaga a mensagem correspondente', async () => {
    montar()

    await marcarConsentimento()
    enviar()
    expect(screen.getByText('Escolha um estilo de piercing.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /Aréola/ }))

    expect(screen.queryByText('Escolha um estilo de piercing.')).not.toBeInTheDocument()
  })

  it('anexar a imagem apaga a mensagem da imagem', async () => {
    montar()

    await marcarConsentimento()
    enviar()
    expect(screen.getByText('Envie uma foto para gerar a simulação.')).toBeInTheDocument()

    anexar()

    expect(screen.queryByText('Envie uma foto para gerar a simulação.')).not.toBeInTheDocument()
  })
})

describe('troca da parte do corpo', () => {
  it('descarta o estilo que a nova parte nao oferece', async () => {
    // Senao o formulario enviaria uma combinacao que a tela nunca mostrou — e
    // que o backend recusa.
    const { onSubmit } = montar()

    await userEvent.selectOptions(screen.getByLabelText('Parte do corpo'), 'Mamilos')
    await userEvent.click(screen.getByRole('radio', { name: /Aréola/ }))
    await userEvent.selectOptions(screen.getByLabelText('Parte do corpo'), 'Glande')

    anexar()
    await marcarConsentimento()
    enviar()

    expect(screen.getByText('Escolha um estilo de piercing.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('mantem o estilo quando a nova parte tambem o oferece', async () => {
    // Mamilo e Mamilos compartilham a lista.
    const { onSubmit } = montar()

    await userEvent.selectOptions(screen.getByLabelText('Gênero'), 'Feminino')
    await userEvent.selectOptions(screen.getByLabelText('Parte do corpo'), 'Mamilos')
    await userEvent.click(screen.getByRole('radio', { name: /Aréola/ }))
    await userEvent.selectOptions(screen.getByLabelText('Parte do corpo'), 'Mamilo')

    anexar()
    await marcarConsentimento()
    enviar()

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ style: 'areola' }))
  })

  it('a lista de estilos acompanha a parte escolhida', async () => {
    montar()

    await userEvent.selectOptions(screen.getByLabelText('Parte do corpo'), 'Ânus')

    expect(screen.getAllByRole('radio')).toHaveLength(1)
    expect(screen.getByRole('radio', { name: /Piercing Anal/ })).toBeInTheDocument()
  })
})

describe('envio', () => {
  it('entrega os valores preenchidos', async () => {
    const { onSubmit } = montar()

    await preencherTudo()
    enviar()

    expect(onSubmit).toHaveBeenCalledWith({
      gender: 'Feminino',
      genderOther: '',
      bodyPart: 'Mamilos',
      bodyPartOther: '',
      style: 'areola',
      image: expect.any(File),
    })
  })

  it('manda os textos livres quando "Outro" esta escolhido', async () => {
    const { onSubmit } = montar()

    await userEvent.selectOptions(screen.getByLabelText('Gênero'), 'Outro')
    await userEvent.type(screen.getByLabelText('Qual?'), 'Nao binario')
    await userEvent.selectOptions(screen.getByLabelText('Parte do corpo'), 'Outro')
    await userEvent.type(screen.getByLabelText('Qual parte?'), 'Umbigo')
    await userEvent.click(screen.getAllByRole('radio')[0])
    anexar()
    await marcarConsentimento()
    enviar()

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ genderOther: 'Nao binario', bodyPartOther: 'Umbigo' })
    )
  })

  it('apara espacos dos textos livres', async () => {
    const { onSubmit } = montar()

    await userEvent.selectOptions(screen.getByLabelText('Gênero'), 'Outro')
    await userEvent.type(screen.getByLabelText('Qual?'), '   Agênero   ')
    await userEvent.selectOptions(screen.getByLabelText('Parte do corpo'), 'Mamilos')
    await userEvent.click(screen.getByRole('radio', { name: /Aréola/ }))
    anexar()
    await marcarConsentimento()
    enviar()

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ genderOther: 'Agênero' }))
  })

  it('descarta o texto livre quando o select deixa de ser "Outro"', async () => {
    const { onSubmit } = montar()

    await userEvent.selectOptions(screen.getByLabelText('Gênero'), 'Outro')
    await userEvent.type(screen.getByLabelText('Qual?'), 'digitado antes')
    await userEvent.selectOptions(screen.getByLabelText('Gênero'), 'Feminino')
    await userEvent.selectOptions(screen.getByLabelText('Parte do corpo'), 'Mamilos')
    await userEvent.click(screen.getByRole('radio', { name: /Aréola/ }))
    anexar()
    await marcarConsentimento()
    enviar()

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ genderOther: '' }))
  })
})
