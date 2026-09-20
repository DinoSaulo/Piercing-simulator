import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SelectField } from '../../src/components/SelectField.jsx'
import { GENDERS } from '../../src/constants.js'

function montar(props = {}) {
  const onChange = vi.fn()
  const onOtherChange = vi.fn()

  const resultado = render(
    <SelectField
      label="Gênero"
      options={GENDERS}
      value=""
      onChange={onChange}
      otherValue=""
      onOtherChange={onOtherChange}
      otherLabel="Qual?"
      otherPlaceholder="Descreva seu gênero"
      {...props}
    />
  )

  return { ...resultado, onChange, onOtherChange }
}

describe('SelectField', () => {
  it('lista todas as opcoes recebidas', () => {
    montar()

    for (const opcao of GENDERS) {
      expect(screen.getByRole('option', { name: opcao })).toBeInTheDocument()
    }
  })

  it('o rotulo aponta para o select', () => {
    montar()

    expect(screen.getByLabelText('Gênero')).toHaveRole('combobox')
  })

  it('avisa a escolha para quem controla o estado', async () => {
    const { onChange } = montar()

    await userEvent.selectOptions(screen.getByLabelText('Gênero'), 'Feminino')

    expect(onChange).toHaveBeenCalledWith('Feminino')
  })

  it('esconde o texto livre enquanto "Outro" nao e escolhido', () => {
    montar({ value: 'Masculino' })

    expect(screen.queryByLabelText('Qual?')).not.toBeInTheDocument()
  })

  it('revela o texto livre quando "Outro" e escolhido', () => {
    montar({ value: 'Outro' })

    expect(screen.getByLabelText('Qual?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Descreva seu gênero')).toBeInTheDocument()
  })

  it('o texto livre vira obrigatorio e limitado a 80 caracteres', () => {
    // 80 e o mesmo teto do CHECK no banco e do corte na validacao da API.
    montar({ value: 'Outro' })
    const campo = screen.getByLabelText('Qual?')

    expect(campo).toBeRequired()
    expect(campo).toHaveAttribute('maxLength', '80')
  })

  it('repassa o que foi digitado no texto livre', async () => {
    const { onOtherChange } = montar({ value: 'Outro' })

    await userEvent.type(screen.getByLabelText('Qual?'), 'X')

    expect(onOtherChange).toHaveBeenCalledWith('X')
  })

  it('o select e obrigatorio e comeca sem escolha', () => {
    montar()
    const select = screen.getByLabelText('Gênero')

    expect(select).toBeRequired()
    expect(select).toHaveValue('')
  })
})
