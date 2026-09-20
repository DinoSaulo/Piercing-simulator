import { HttpError } from './http.ts'

export const GENDERS = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar']

export const BODY_PARTS = ['Glande', 'Mamilo', 'Mamilos', 'Clítoris', 'Ânus', 'Outro']

/**
 * Espelha frontend/src/data/piercingStyles.js e o CHECK constraint de
 * `piercing_style` em supabase/schema.sql. Mexer aqui exige mexer nos dois.
 *
 * "Outro" não aparece no mapa de propósito: sem parte do corpo conhecida não há
 * como restringir, e a tela mostra o catálogo inteiro nesse caso.
 */
const STYLES_BY_BODY_PART: Record<string, string[]> = {
  Glande: ['prince-albert', 'prince-albert-reverso', 'apadravya', 'ampallang', 'dydoe'],
  Mamilo: ['mamilo-padrao', 'areola'],
  Mamilos: ['mamilo-padrao', 'areola'],
  Clítoris: ['vch', 'hch', 'triangle', 'isabella'],
  Ânus: ['anal'],
}

export const PIERCING_STYLES = [...new Set(Object.values(STYLES_BY_BODY_PART).flat())]

const FREE_TEXT_MAX = 80

export interface SimulationInput {
  gender: string
  genderOther: string | null
  bodyPart: string
  bodyPartOther: string | null
  style: string
  consent: true
}

function field(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function requireOneOf(value: string, allowed: string[], name: string): string {
  if (!allowed.includes(value)) {
    throw new HttpError(`Campo "${name}" inválido.`)
  }
  return value
}

// "Outro" nos selects libera um input de texto livre que vira obrigatório.
function requireDetailWhenOther(selected: string, detail: string, name: string): string | null {
  if (selected !== 'Outro') return null
  if (!detail) {
    throw new HttpError(`Descreva a opção "Outro" em "${name}".`)
  }
  return detail.slice(0, FREE_TEXT_MAX)
}

// A tela só oferece os estilos da parte escolhida; a API repete a regra para não
// aceitar combinações montadas fora do formulário.
function requireStyleForBodyPart(style: string, bodyPart: string): void {
  const allowed = STYLES_BY_BODY_PART[bodyPart]
  if (allowed && !allowed.includes(style)) {
    throw new HttpError(`O estilo "${style}" não se aplica a "${bodyPart}".`)
  }
}

export function parseSimulationForm(form: FormData): SimulationInput {
  const gender = requireOneOf(field(form, 'gender'), GENDERS, 'gender')
  const bodyPart = requireOneOf(field(form, 'bodyPart'), BODY_PARTS, 'bodyPart')
  const style = requireOneOf(field(form, 'style'), PIERCING_STYLES, 'style')

  requireStyleForBodyPart(style, bodyPart)

  if (field(form, 'consent') !== 'true') {
    throw new HttpError('Consentimento de armazenamento não informado.')
  }

  return {
    gender,
    genderOther: requireDetailWhenOther(gender, field(form, 'genderOther'), 'gender'),
    bodyPart,
    bodyPartOther: requireDetailWhenOther(bodyPart, field(form, 'bodyPartOther'), 'bodyPart'),
    style,
    consent: true,
  }
}
