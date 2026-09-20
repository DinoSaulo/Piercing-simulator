import { assertEquals, assertThrows } from 'jsr:@std/assert@1'
import { HttpError } from '../api/http.ts'
import {
  BODY_PARTS,
  GENDERS,
  PIERCING_STYLES,
  parseSimulationForm,
} from '../api/validation.ts'

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.append(name, value)
  return data
}

const VALID = {
  gender: 'Masculino',
  bodyPart: 'Glande',
  style: 'prince-albert',
  consent: 'true',
}

function assertRejects(fields: Record<string, string>, trecho: string): void {
  const error = assertThrows(() => parseSimulationForm(form(fields)), HttpError)
  assertEquals(
    error.message.includes(trecho),
    true,
    `mensagem "${error.message}" nao contem "${trecho}"`
  )
  assertEquals(error.status, 400)
}

Deno.test('aceita um formulario completo e valido', () => {
  const parsed = parseSimulationForm(form(VALID))

  assertEquals(parsed, {
    gender: 'Masculino',
    genderOther: null,
    bodyPart: 'Glande',
    bodyPartOther: null,
    style: 'prince-albert',
    consent: true,
  })
})

Deno.test('remove espacos ao redor dos valores', () => {
  const parsed = parseSimulationForm(
    form({ ...VALID, gender: '  Masculino  ', style: ' prince-albert ' })
  )

  assertEquals(parsed.gender, 'Masculino')
  assertEquals(parsed.style, 'prince-albert')
})

Deno.test('recusa genero fora da lista', () => {
  assertRejects({ ...VALID, gender: 'Outra coisa' }, 'gender')
})

Deno.test('recusa parte do corpo fora da lista', () => {
  assertRejects({ ...VALID, bodyPart: 'Orelha' }, 'bodyPart')
})

Deno.test('recusa estilo fora do catalogo', () => {
  assertRejects({ ...VALID, style: 'inventado' }, 'style')
})

Deno.test('recusa campo ausente como se fosse invalido', () => {
  assertRejects({ bodyPart: 'Glande', style: 'prince-albert', consent: 'true' }, 'gender')
})

Deno.test('recusa valor nao textual — um File no lugar do texto', () => {
  const data = form({ bodyPart: 'Glande', style: 'prince-albert', consent: 'true' })
  data.append('gender', new File(['x'], 'g.txt'))

  const error = assertThrows(() => parseSimulationForm(data), HttpError)
  assertEquals(error.message.includes('gender'), true)
})

// ---------------------------------------------------------------------------
// Estilo x parte do corpo — a regra que a tela aplica e a API repete
// ---------------------------------------------------------------------------

Deno.test('recusa estilo que nao pertence a parte do corpo escolhida', () => {
  assertRejects({ ...VALID, bodyPart: 'Clítoris', style: 'prince-albert' }, 'não se aplica')
})

Deno.test('a mensagem de estilo incompativel cita estilo e parte', () => {
  const error = assertThrows(
    () => parseSimulationForm(form({ ...VALID, bodyPart: 'Ânus', style: 'vch' })),
    HttpError
  )

  assertEquals(error.message.includes('vch'), true)
  assertEquals(error.message.includes('Ânus'), true)
})

Deno.test('Mamilo e Mamilos aceitam os mesmos estilos', () => {
  for (const bodyPart of ['Mamilo', 'Mamilos']) {
    for (const style of ['mamilo-padrao', 'areola']) {
      const parsed = parseSimulationForm(form({ ...VALID, bodyPart, style }))
      assertEquals(parsed.style, style)
    }
  }
})

Deno.test('"Outro" em bodyPart libera qualquer estilo do catalogo', () => {
  for (const style of PIERCING_STYLES) {
    const parsed = parseSimulationForm(
      form({ ...VALID, bodyPart: 'Outro', bodyPartOther: 'Umbigo', style })
    )
    assertEquals(parsed.style, style)
  }
})

// ---------------------------------------------------------------------------
// Texto livre do "Outro"
// ---------------------------------------------------------------------------

Deno.test('"Outro" sem texto livre e recusado', () => {
  assertRejects({ ...VALID, gender: 'Outro' }, 'Outro')
  assertRejects({ ...VALID, bodyPart: 'Outro', style: 'prince-albert' }, 'Outro')
})

Deno.test('"Outro" com texto livre so em espacos e recusado', () => {
  assertRejects({ ...VALID, gender: 'Outro', genderOther: '    ' }, 'Outro')
})

Deno.test('texto livre e devolvido quando o select e "Outro"', () => {
  const parsed = parseSimulationForm(
    form({ ...VALID, gender: 'Outro', genderOther: 'Nao binario' })
  )

  assertEquals(parsed.genderOther, 'Nao binario')
})

Deno.test('texto livre e cortado em 80 caracteres', () => {
  const parsed = parseSimulationForm(
    form({ ...VALID, gender: 'Outro', genderOther: 'a'.repeat(200) })
  )

  assertEquals(parsed.genderOther?.length, 80)
})

Deno.test('texto livre e descartado quando o select nao e "Outro"', () => {
  const parsed = parseSimulationForm(
    form({ ...VALID, genderOther: 'ignorado', bodyPartOther: 'ignorado' })
  )

  assertEquals(parsed.genderOther, null)
  assertEquals(parsed.bodyPartOther, null)
})

// ---------------------------------------------------------------------------
// Consentimento
// ---------------------------------------------------------------------------

Deno.test('recusa envio sem consentimento', () => {
  assertRejects({ ...VALID, consent: 'false' }, 'Consentimento')
  assertRejects({ gender: 'Masculino', bodyPart: 'Glande', style: 'prince-albert' }, 'Consentimento')
})

Deno.test('consentimento so vale com a string exata "true"', () => {
  assertRejects({ ...VALID, consent: 'True' }, 'Consentimento')
  assertRejects({ ...VALID, consent: '1' }, 'Consentimento')
})

// ---------------------------------------------------------------------------
// Listas exportadas
// ---------------------------------------------------------------------------

Deno.test('as listas exportadas nao tem duplicatas', () => {
  assertEquals(new Set(GENDERS).size, GENDERS.length)
  assertEquals(new Set(BODY_PARTS).size, BODY_PARTS.length)
  assertEquals(new Set(PIERCING_STYLES).size, PIERCING_STYLES.length)
})

Deno.test('PIERCING_STYLES cobre todos os estilos aceitos, sem repetir mamilo/areola', () => {
  // Mamilo e Mamilos apontam para a mesma dupla: o Set no modulo existe para
  // que ela apareca uma vez so.
  assertEquals(PIERCING_STYLES.filter((style) => style === 'areola').length, 1)
  assertEquals(PIERCING_STYLES.length, 12)
})
