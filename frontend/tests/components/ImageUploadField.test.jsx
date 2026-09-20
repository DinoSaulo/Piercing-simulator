import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImageUploadField } from '../../src/components/ImageUploadField.jsx'

const MB = 1024 * 1024

function arquivo(nome = 'foto.png', bytes = 1024, tipo = 'image/png') {
  return new File([new Uint8Array(bytes)], nome, { type: tipo })
}

function montar(props = {}) {
  const onChange = vi.fn()
  const resultado = render(
    <ImageUploadField file={null} onChange={onChange} error={undefined} {...props} />
  )
  return { ...resultado, onChange }
}

/**
 * Os dois inputs sao sr-only e disparados por botao. fireEvent com a lista
 * pronta evita a validacao de tipo do jsdom, que rejeitaria o File do Node
 * usado no setup.
 */
function escolher(indice, arquivos) {
  const inputs = document.querySelectorAll('input[type="file"]')
  fireEvent.change(inputs[indice], { target: { files: arquivos } })
  return inputs[indice]
}

describe('escolha do arquivo', () => {
  it('oferece galeria e camera como caminhos separados', () => {
    // `capture` sozinho forcaria a camera no mobile e tiraria a galeria.
    montar()

    expect(screen.getByRole('button', { name: 'Escolher arquivo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar câmera' })).toBeInTheDocument()

    const inputs = document.querySelectorAll('input[type="file"]')
    expect(inputs).toHaveLength(2)
    expect(inputs[0]).not.toHaveAttribute('capture')
    expect(inputs[1]).toHaveAttribute('capture', 'environment')
  })

  it('os dois inputs so aceitam imagem', () => {
    montar()

    for (const input of document.querySelectorAll('input[type="file"]')) {
      expect(input).toHaveAttribute('accept', 'image/*')
    }
  })

  it('o botao da galeria aciona o input escondido', async () => {
    montar()
    const input = document.querySelectorAll('input[type="file"]')[0]
    const clique = vi.spyOn(input, 'click')

    await userEvent.click(screen.getByRole('button', { name: 'Escolher arquivo' }))

    expect(clique).toHaveBeenCalled()
  })

  it('entrega o arquivo escolhido', () => {
    const { onChange } = montar()
    const png = arquivo()

    escolher(0, [png])

    expect(onChange).toHaveBeenCalledWith(png)
  })

  it('a camera entrega pelo mesmo caminho', () => {
    const { onChange } = montar()
    const png = arquivo('camera.jpg', 2048, 'image/jpeg')

    escolher(1, [png])

    expect(onChange).toHaveBeenCalledWith(png)
  })

  it('cancelar a selecao nao mexe no estado', () => {
    const { onChange } = montar()

    escolher(0, [])

    expect(onChange).not.toHaveBeenCalled()
  })

  it('limpa o input para permitir reescolher o mesmo arquivo', () => {
    montar()

    const input = escolher(0, [arquivo()])

    expect(input.value).toBe('')
  })
})

describe('limite de tamanho', () => {
  it('recusa arquivo acima de 10 MB com a mensagem do tamanho', () => {
    const { onChange } = montar()

    escolher(0, [arquivo('gigante.png', 11 * MB)])

    expect(screen.getByText('A imagem tem 11.0 MB. O limite é 10 MB.')).toBeInTheDocument()
    // E descarta o que houvesse antes, em vez de deixar um arquivo velho.
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('aceita arquivo no limite', () => {
    const { onChange } = montar()
    const limite = arquivo('no-limite.png', 10 * MB)

    escolher(0, [limite])

    expect(onChange).toHaveBeenCalledWith(limite)
  })

  it('uma escolha valida limpa o erro anterior', () => {
    const { onChange } = montar()

    escolher(0, [arquivo('gigante.png', 11 * MB)])
    expect(screen.getByText(/O limite é 10 MB/)).toBeInTheDocument()

    escolher(0, [arquivo()])
    expect(screen.queryByText(/O limite é 10 MB/)).not.toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith(expect.any(File))
  })
})

describe('pre-visualizacao', () => {
  it('sem arquivo nao ha previa', () => {
    montar()

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('mostra a previa com nome e tamanho do arquivo', () => {
    montar({ file: arquivo('minha-foto.png', 2 * MB) })

    expect(screen.getByRole('img', { name: /Pré-visualização/ })).toBeInTheDocument()
    expect(screen.getByText('minha-foto.png')).toBeInTheDocument()
    expect(screen.getByText('2.0 MB')).toBeInTheDocument()
  })

  it('cria uma object URL para a previa', () => {
    montar({ file: arquivo() })

    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('revoga a object URL ao desmontar', () => {
    // Criacao e revogacao andam em par: sem isto o blob fica preso na memoria
    // da aba ate o reload.
    const { unmount } = montar({ file: arquivo() })
    const criada = URL.createObjectURL.mock.results.at(-1).value

    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(criada)
  })

  it('revoga a URL anterior ao trocar de arquivo', () => {
    const { rerender } = montar({ file: arquivo('primeira.png') })
    const primeira = URL.createObjectURL.mock.results.at(-1).value

    rerender(<ImageUploadField file={arquivo('segunda.png')} onChange={vi.fn()} />)

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(primeira)
  })

  it('o botao remover devolve null', async () => {
    const { onChange } = montar({ file: arquivo() })

    await userEvent.click(screen.getByRole('button', { name: 'Remover' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })
})

describe('mensagens', () => {
  it('mostra o erro vindo de fora', () => {
    montar({ error: 'Envie uma foto para gerar a simulação.' })

    expect(screen.getByText('Envie uma foto para gerar a simulação.')).toBeInTheDocument()
  })

  it('o erro local tem prioridade sobre o externo', () => {
    // O local e o mais recente: fala do arquivo que a pessoa acabou de tentar.
    montar({ error: 'Envie uma foto para gerar a simulação.' })

    escolher(0, [arquivo('gigante.png', 20 * MB)])

    expect(screen.getByText(/O limite é 10 MB/)).toBeInTheDocument()
    expect(screen.queryByText('Envie uma foto para gerar a simulação.')).not.toBeInTheDocument()
  })
})
