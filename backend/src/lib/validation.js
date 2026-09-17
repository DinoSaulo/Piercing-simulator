export const GENDERS = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar']

export const BODY_PARTS = ['Glandis', 'Mamilo', 'Mamilos', 'Clítoris', 'Outro']

export const PIERCING_STYLES = [
  'argola-classica',
  'halter-reto',
  'halter-curvo',
  'captive-bead',
  'circular-ferradura',
  'espiral-duplo',
]

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

export function parseSimulationBody(body) {
  const gender = requireOneOf(body.gender, GENDERS, 'gender')
  const bodyPart = requireOneOf(body.bodyPart, BODY_PARTS, 'bodyPart')
  const style = requireOneOf(body.style, PIERCING_STYLES, 'style')

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
