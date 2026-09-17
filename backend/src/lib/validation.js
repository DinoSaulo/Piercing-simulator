export const GENDERS = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar']

export const BODY_PARTS = ['Glande', 'Mamilo', 'Mamilos', 'Clítoris', 'Ânus', 'Outro']

/**
 * Espelha frontend/src/data/piercingStyles.js e o CHECK constraint de
 * `piercing_style` em supabase/schema.sql. Mexer aqui exige mexer nos dois.
 *
 * "Outro" nao aparece no mapa de proposito: sem parte do corpo conhecida nao ha
 * como restringir, e a tela mostra o catalogo inteiro nesse caso.
 */
const STYLES_BY_BODY_PART = {
  Glande: ['prince-albert', 'prince-albert-reverso', 'apadravya', 'ampallang', 'dydoe'],
  Mamilo: ['mamilo-padrao', 'areola'],
  Mamilos: ['mamilo-padrao', 'areola'],
  Clítoris: ['vch', 'hch', 'triangle', 'isabella'],
  Ânus: ['anal'],
}

export const PIERCING_STYLES = [...new Set(Object.values(STYLES_BY_BODY_PART).flat())]

const FREE_TEXT_MAX = 80

class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ValidationError'
    this.status = 400
  }
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function requireOneOf(value, allowed, field) {
  const clean = trimmed(value)
  if (!allowed.includes(clean)) {
    throw new ValidationError(`Campo "${field}" invalido.`)
  }
  return clean
}

// "Outro" nos selects libera um input de texto livre que vira obrigatorio.
function requireDetailWhenOther(selected, detail, field) {
  if (selected !== 'Outro') return null
  const clean = trimmed(detail)
  if (!clean) {
    throw new ValidationError(`Descreva a opcao "Outro" em "${field}".`)
  }
  return clean.slice(0, FREE_TEXT_MAX)
}

// A tela so oferece os estilos da parte escolhida; o backend repete a regra para
// nao aceitar combinacoes montadas fora do formulario.
function requireStyleForBodyPart(style, bodyPart) {
  const allowed = STYLES_BY_BODY_PART[bodyPart]
  if (allowed && !allowed.includes(style)) {
    throw new ValidationError(`O estilo "${style}" nao se aplica a "${bodyPart}".`)
  }
}

export function parseSimulationBody(body) {
  const gender = requireOneOf(body.gender, GENDERS, 'gender')
  const bodyPart = requireOneOf(body.bodyPart, BODY_PARTS, 'bodyPart')
  const style = requireOneOf(body.style, PIERCING_STYLES, 'style')

  requireStyleForBodyPart(style, bodyPart)

  if (trimmed(body.consent) !== 'true') {
    throw new ValidationError('Consentimento de armazenamento nao informado.')
  }

  return {
    gender,
    genderOther: requireDetailWhenOther(gender, body.genderOther, 'gender'),
    bodyPart,
    bodyPartOther: requireDetailWhenOther(bodyPart, body.bodyPartOther, 'bodyPart'),
    style,
    consent: true,
  }
}

export { ValidationError }
