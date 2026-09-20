import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSimulation } from '../../src/api/createSimulation.js'
import { enviadas, resetEnviadas } from '../msw/handlers.js'
import { server } from '../msw/server.js'

const VALIDO = {
  gender: 'Feminino',
  genderOther: '',
  bodyPart: 'Mamilos',
  bodyPartOther: '',
  style: 'areola',
  image: new File(['conteudo'], 'foto.png', { type: 'image/png' }),
}

beforeEach(resetEnviadas)

describe('montagem do multipart', () => {
  it('envia os campos do formulario', async () => {
    await createSimulation(VALIDO)

    expect(enviadas).toHaveLength(1)
    expect(enviadas[0]).toMatchObject({
      gender: 'Feminino',
      bodyPart: 'Mamilos',
      style: 'areola',
      imageName: 'foto.png',
      imageType: 'image/png',
    })
  })

  it('marca o consentimento sempre como "true"', async () => {
    // A tela so habilita o botao com o checkbox marcado; o campo e a prova
    // disso que chega ao backend, que recusa qualquer outro valor.
    await createSimulation(VALIDO)

    expect(enviadas[0].consent).toBe('true')
  })

  it('inclui os textos livres quando preenchidos', async () => {
    await createSimulation({
      ...VALIDO,
      gender: 'Outro',
      genderOther: 'Nao binario',
      bodyPart: 'Outro',
      bodyPartOther: 'Umbigo',
    })

    expect(enviadas[0].genderOther).toBe('Nao binario')
    expect(enviadas[0].bodyPartOther).toBe('Umbigo')
  })

  it('omite os textos livres vazios em vez de mandar string vazia', async () => {
    await createSimulation(VALIDO)

    expect(enviadas[0].genderOther).toBeNull()
    expect(enviadas[0].bodyPartOther).toBeNull()
  })

  it('sem imagem, o campo nao e anexado', async () => {
    await createSimulation({ ...VALIDO, image: null })

    expect(enviadas[0].imageName).toBeNull()
  })

  it('usa caminho relativo, para valer no proxy do Vite e no rewrite da Vercel', async () => {
    const espiao = vi.spyOn(globalThis, 'fetch')

    await createSimulation(VALIDO)

    expect(espiao).toHaveBeenCalledWith('/api/simulate', expect.objectContaining({ method: 'POST' }))
  })
})

describe('resposta', () => {
  it('devolve o corpo da API no sucesso', async () => {
    await expect(createSimulation(VALIDO)).resolves.toEqual({
      ok: true,
      id: 'sim-1',
      createdAt: '2026-09-20T12:00:00.000Z',
    })
  })

  it('propaga a mensagem de erro da API', async () => {
    server.use(
      http.post('/api/simulate', () =>
        HttpResponse.json({ ok: false, error: 'Imagem maior que o limite de 10MB.' }, { status: 413 })
      )
    )

    await expect(createSimulation(VALIDO)).rejects.toThrow('Imagem maior que o limite de 10MB.')
  })

  it('cai no status quando a resposta de erro nao e JSON', async () => {
    // Ex.: um 502 do proxy, com corpo em HTML.
    server.use(
      http.post('/api/simulate', () => new HttpResponse('<html>Bad Gateway</html>', { status: 502 }))
    )

    await expect(createSimulation(VALIDO)).rejects.toThrow('A API respondeu 502.')
  })

  it('erro sem campo "error" tambem cai no status', async () => {
    server.use(http.post('/api/simulate', () => HttpResponse.json({ ok: false }, { status: 500 })))

    await expect(createSimulation(VALIDO)).rejects.toThrow('A API respondeu 500.')
  })
})
