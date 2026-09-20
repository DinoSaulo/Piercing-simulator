/**
 * Contrato entre as tres copias das mesmas regras.
 *
 * O catalogo de estilos e as listas de genero e parte do corpo existem em tres
 * lugares que precisam concordar:
 *
 *   1. frontend/src/data/piercingStyles.js e frontend/src/constants.js
 *   2. supabase/functions/api/validation.ts
 *   3. o CHECK de supabase/schema.sql
 *
 * Os comentarios do codigo avisam que "mexer aqui exige mexer nos tres
 * lugares". Este arquivo e esse aviso virando falha de CI.
 *
 * O lado do backend nao e lido como texto: STYLES_BY_BODY_PART e privado, entao
 * o mapa e reconstruido perguntando ao proprio parseSimulationForm o que ele
 * aceita. E o comportamento que vale, nao a declaracao.
 */
import { assertEquals } from 'jsr:@std/assert@1'
import {
  BODY_PARTS as BODY_PARTS_API,
  GENDERS as GENDERS_API,
  PIERCING_STYLES as ESTILOS_API,
  parseSimulationForm,
} from '../api/validation.ts'
import {
  BODY_PARTS as BODY_PARTS_WEB,
  GENDERS as GENDERS_WEB,
} from '../../../frontend/src/constants.js'
import {
  STYLE_IDS as ESTILOS_WEB,
  stylesForBodyPart,
} from '../../../frontend/src/data/piercingStyles.js'

const schema = await Deno.readTextFile(new URL('../../schema.sql', import.meta.url))

const ordenado = (valores: string[]) => [...valores].sort()

// ---------------------------------------------------------------------------
// Leitura do schema.sql
// ---------------------------------------------------------------------------

function literais(trecho: string): string[] {
  return [...trecho.matchAll(/'([^']*)'/g)].map((m) => m[1])
}

function listaDoCheck(coluna: string): string[] {
  const encontrado = schema.match(new RegExp(`${coluna} in \\(([\\s\\S]*?)\\)`))
  if (!encontrado) throw new Error(`nao achei o check de ${coluna} em schema.sql`)
  return literais(encontrado[1])
}

/** O mapa parte -> estilos declarado na constraint style_matches_body_part. */
function mapaDoSchema(): Map<string, string[]> {
  const bloco = schema.match(/constraint style_matches_body_part check \(([\s\S]*?)\n  \)/)
  if (!bloco) throw new Error('nao achei style_matches_body_part em schema.sql')

  const mapa = new Map<string, string[]>()
  for (const caso of bloco[1].matchAll(/when\s+'([^']+)'\s+then piercing_style in \(([\s\S]*?)\)/g)) {
    mapa.set(caso[1], literais(caso[2]))
  }
  return mapa
}

// ---------------------------------------------------------------------------
// Leitura do backend, pelo comportamento
// ---------------------------------------------------------------------------

function aceitaNaApi(bodyPart: string, style: string): boolean {
  const form = new FormData()
  form.append('gender', 'Masculino')
  form.append('bodyPart', bodyPart)
  form.append('style', style)
  form.append('consent', 'true')
  if (bodyPart === 'Outro') form.append('bodyPartOther', 'qualquer')

  try {
    parseSimulationForm(form)
    return true
  } catch {
    return false
  }
}

function mapaDaApi(): Map<string, string[]> {
  const mapa = new Map<string, string[]>()
  for (const bodyPart of BODY_PARTS_API) {
    mapa.set(bodyPart, ESTILOS_API.filter((style) => aceitaNaApi(bodyPart, style)))
  }
  return mapa
}

function mapaDaTela(): Map<string, string[]> {
  const mapa = new Map<string, string[]>()
  for (const bodyPart of BODY_PARTS_WEB) {
    mapa.set(bodyPart, stylesForBodyPart(bodyPart).map((estilo: { id: string }) => estilo.id))
  }
  return mapa
}

// ---------------------------------------------------------------------------
// Generos
// ---------------------------------------------------------------------------

Deno.test('contrato: a lista de generos e a mesma na tela e na API', () => {
  assertEquals(GENDERS_WEB, GENDERS_API)
})

Deno.test('contrato: a lista de generos bate com o CHECK do banco', () => {
  assertEquals(ordenado(listaDoCheck('gender')), ordenado(GENDERS_API))
})

// ---------------------------------------------------------------------------
// Partes do corpo
// ---------------------------------------------------------------------------

Deno.test('contrato: a lista de partes do corpo e a mesma na tela e na API', () => {
  assertEquals(BODY_PARTS_WEB, BODY_PARTS_API)
})

Deno.test('contrato: a lista de partes do corpo bate com o CHECK do banco', () => {
  assertEquals(ordenado(listaDoCheck('body_part')), ordenado(BODY_PARTS_API))
})

// ---------------------------------------------------------------------------
// Catalogo de estilos
// ---------------------------------------------------------------------------

Deno.test('contrato: o catalogo de estilos e o mesmo na tela e na API', () => {
  assertEquals(ordenado(ESTILOS_WEB), ordenado(ESTILOS_API))
})

Deno.test('contrato: o catalogo de estilos bate com o CHECK do banco', () => {
  assertEquals(ordenado(listaDoCheck('piercing_style')), ordenado(ESTILOS_API))
})

Deno.test('contrato: nenhum estilo do catalogo esta orfao de parte do corpo', () => {
  // Um estilo que nenhuma parte oferece seria inalcancavel pela tela.
  const oferecidos = new Set([...mapaDoSchema().values()].flat())

  assertEquals(ordenado([...oferecidos]), ordenado(ESTILOS_API))
})

// ---------------------------------------------------------------------------
// Mapa parte do corpo -> estilos
// ---------------------------------------------------------------------------

Deno.test('contrato: o mapa parte -> estilos e o mesmo na API e no banco', () => {
  const api = mapaDaApi()
  const banco = mapaDoSchema()

  for (const [parte, estilosDoBanco] of banco) {
    assertEquals(
      ordenado(api.get(parte) ?? []),
      ordenado(estilosDoBanco),
      `divergencia em "${parte}"`
    )
  }
})

Deno.test('contrato: o mapa parte -> estilos e o mesmo na tela e na API', () => {
  const tela = mapaDaTela()
  const api = mapaDaApi()

  for (const parte of BODY_PARTS_API) {
    assertEquals(ordenado(tela.get(parte) ?? []), ordenado(api.get(parte) ?? []), `divergencia em "${parte}"`)
  }
})

Deno.test('contrato: "Outro" aceita o catalogo inteiro nos tres lugares', () => {
  // Sem parte do corpo conhecida nao ha como restringir: a tela mostra tudo, a
  // API aceita tudo, e o CASE do banco cai no `else true`.
  assertEquals(ordenado(mapaDaTela().get('Outro') ?? []), ordenado(ESTILOS_API))
  assertEquals(ordenado(mapaDaApi().get('Outro') ?? []), ordenado(ESTILOS_API))
  assertEquals(mapaDoSchema().has('Outro'), false)
  assertEquals(/else true/.test(schema), true)
})

Deno.test('contrato: Mamilo e Mamilos oferecem exatamente os mesmos estilos', () => {
  const banco = mapaDoSchema()
  const api = mapaDaApi()
  const tela = mapaDaTela()

  assertEquals(ordenado(banco.get('Mamilo') ?? []), ordenado(banco.get('Mamilos') ?? []))
  assertEquals(ordenado(api.get('Mamilo') ?? []), ordenado(api.get('Mamilos') ?? []))
  assertEquals(ordenado(tela.get('Mamilo') ?? []), ordenado(tela.get('Mamilos') ?? []))
})

Deno.test('contrato: toda parte do corpo do CASE existe na lista de partes', () => {
  for (const parte of mapaDoSchema().keys()) {
    assertEquals(BODY_PARTS_API.includes(parte), true, `"${parte}" nao esta em BODY_PARTS`)
  }
})

Deno.test('contrato: o limite de 80 caracteres do texto livre bate com o banco', () => {
  // validation.ts corta em 80; o banco recusa acima de 80. Se o corte fosse
  // maior, o insert quebraria em vez de truncar.
  assertEquals(/char_length\(gender_other\) <= 80/.test(schema), true)
  assertEquals(/char_length\(body_part_other\) <= 80/.test(schema), true)

  const form = new FormData()
  form.append('gender', 'Outro')
  form.append('genderOther', 'a'.repeat(500))
  form.append('bodyPart', 'Glande')
  form.append('style', 'prince-albert')
  form.append('consent', 'true')

  assertEquals(parseSimulationForm(form).genderOther?.length, 80)
})
