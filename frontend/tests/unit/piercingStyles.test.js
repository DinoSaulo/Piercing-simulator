import { describe, expect, it } from 'vitest'
import { BODY_PARTS } from '../../src/constants.js'
import {
  PIERCING_STYLES,
  STYLE_IDS,
  labelForStyle,
  noticeForBodyPart,
  stylesForBodyPart,
} from '../../src/data/piercingStyles.js'

const ids = (estilos) => estilos.map((estilo) => estilo.id)

describe('catalogo', () => {
  it('nao tem ids repetidos', () => {
    expect(new Set(STYLE_IDS).size).toBe(STYLE_IDS.length)
  })

  it('todo estilo tem id, rotulo e descricao preenchidos', () => {
    for (const estilo of PIERCING_STYLES) {
      expect(estilo.id, `id ausente em ${JSON.stringify(estilo)}`).toBeTruthy()
      expect(estilo.label, `label ausente em ${estilo.id}`).toBeTruthy()
      expect(estilo.description, `descricao ausente em ${estilo.id}`).toBeTruthy()
    }
  })

  it('STYLE_IDS acompanha PIERCING_STYLES', () => {
    expect(STYLE_IDS).toEqual(ids(PIERCING_STYLES))
  })
})

describe('stylesForBodyPart', () => {
  it('filtra pela parte do corpo escolhida', () => {
    expect(ids(stylesForBodyPart('Glande'))).toEqual([
      'prince-albert',
      'prince-albert-reverso',
      'apadravya',
      'ampallang',
      'dydoe',
    ])
    expect(ids(stylesForBodyPart('Clítoris'))).toEqual(['vch', 'hch', 'triangle', 'isabella'])
    expect(ids(stylesForBodyPart('Ânus'))).toEqual(['anal'])
  })

  it('Mamilo e Mamilos compartilham a mesma lista', () => {
    expect(ids(stylesForBodyPart('Mamilo'))).toEqual(['mamilo-padrao', 'areola'])
    expect(ids(stylesForBodyPart('Mamilos'))).toEqual(ids(stylesForBodyPart('Mamilo')))
  })

  it('sem parte selecionada cai no catalogo completo', () => {
    // E o estado inicial da tela: nada escolhido ainda.
    expect(ids(stylesForBodyPart(''))).toEqual(STYLE_IDS)
    expect(ids(stylesForBodyPart(undefined))).toEqual(STYLE_IDS)
  })

  it('"Outro" tambem mostra o catalogo completo', () => {
    // Sem parte conhecida nao ha como restringir.
    expect(ids(stylesForBodyPart('Outro'))).toEqual(STYLE_IDS)
  })

  it('toda parte do corpo da tela devolve pelo menos um estilo', () => {
    for (const parte of BODY_PARTS) {
      expect(stylesForBodyPart(parte).length, `"${parte}" ficou sem estilos`).toBeGreaterThan(0)
    }
  })
})

describe('noticeForBodyPart', () => {
  it('Clitoris tem o aviso tecnico do especialista', () => {
    expect(noticeForBodyPart('Clítoris')).toContain('danos nervosos')
  })

  it('as demais partes nao tem aviso', () => {
    for (const parte of ['Glande', 'Mamilo', 'Mamilos', 'Ânus', 'Outro', '']) {
      expect(noticeForBodyPart(parte), `"${parte}" nao deveria ter aviso`).toBeNull()
    }
  })
})

describe('labelForStyle', () => {
  it('traduz o id gravado no banco para o rotulo da tela', () => {
    expect(labelForStyle('prince-albert')).toBe('Prince Albert (PA)')
    expect(labelForStyle('vch')).toBe('VCH (Vertical Clitoral Hood)')
  })

  it('id desconhecido aparece como esta, em vez de sumir', () => {
    // Linhas gravadas por versoes antigas do catalogo continuam visiveis.
    expect(labelForStyle('estilo-que-nao-existe-mais')).toBe('estilo-que-nao-existe-mais')
  })

  it('todo id do catalogo tem rotulo', () => {
    for (const id of STYLE_IDS) {
      expect(labelForStyle(id), `${id} sem rotulo`).not.toBe(id)
    }
  })
})
