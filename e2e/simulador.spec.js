import { expect, test } from '@playwright/test'
import { PNG_1X1, interceptarSimulacao } from './fixtures/api.js'

/**
 * Fluxo publico num navegador de verdade.
 *
 * O que so aqui aparece: o `inert` realmente impedindo o clique atras do
 * portao de idade, o input de arquivo aceitando um arquivo do disco e a barra
 * de progresso correndo em tempo real.
 */

const passarPeloPortao = (page) => page.getByRole('button', { name: 'Sim, tenho 18+' }).click()

async function anexarFoto(page) {
  // Os inputs sao sr-only e acionados por botao; setInputFiles nao precisa que
  // o elemento esteja visivel.
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'minha-foto.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
  })
}

/**
 * Escolhe um estilo clicando no card.
 *
 * O <input type="radio"> e sr-only e o <label> cobre a area clicavel — que e
 * justamente o desenho: o card e o alvo do mouse, o input carrega a semantica
 * para teclado e leitor de tela. Clicar no label e o que uma pessoa faz.
 */
function escolherEstilo(page, rotulo) {
  return page.locator('label').filter({ hasText: rotulo }).click()
}

async function preencher(page) {
  await page.getByLabel('Gênero').selectOption('Feminino')
  await page.getByLabel('Parte do corpo').selectOption('Mamilos')
  await escolherEstilo(page, 'Piercing de Aréola')
  await anexarFoto(page)
  await page.getByRole('checkbox').check()
}

test.describe('portao de idade', () => {
  test('bloqueia a interacao com o formulario atras dele', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.locator('[inert]')).toBeAttached()

    // `inert` tira o elemento da ordem de foco. E o que impede a interacao de
    // verdade — o blur sozinho so esconderia.
    const select = page.getByLabel('Gênero')
    await select.focus().catch(() => {})
    await expect(select).not.toBeFocused()
  })

  test('confirmar libera o formulario', async ({ page }) => {
    await page.goto('/')

    await passarPeloPortao(page)

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.locator('[inert]')).toHaveCount(0)

    const select = page.getByLabel('Gênero')
    await select.focus()
    await expect(select).toBeFocused()
  })

  test('recusar tira a pessoa do site', async ({ page }) => {
    await page.route('https://www.google.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>saiu</h1>' })
    )

    await page.goto('/')
    await page.getByRole('button', { name: 'Não' }).click()

    await expect(page).toHaveURL(/google\.com/)
  })
})

test.describe('envio da simulacao', () => {
  test('percorre formulario, barra de progresso e tela de erro', async ({ page }) => {
    const enviadas = await interceptarSimulacao(page)

    await page.goto('/')
    await passarPeloPortao(page)
    await preencher(page)

    await page.getByRole('button', { name: 'Criar simulação' }).click()

    const barra = page.getByRole('progressbar')
    await expect(barra).toBeVisible()

    // A barra roda 4s reais; o desfecho e a tela de erro cenografica.
    await expect(barra).toBeHidden({ timeout: 10_000 })
    await expect(page.getByText(/SIGSEGV|Segmentation fault|500/).first()).toBeVisible()

    expect(enviadas).toHaveLength(1)
    expect(enviadas[0]).toMatchObject({
      gender: 'Feminino',
      bodyPart: 'Mamilos',
      style: 'areola',
      consent: 'true',
      temImagem: true,
    })
  })

  test('o botao so habilita com o consentimento marcado', async ({ page }) => {
    await page.goto('/')
    await passarPeloPortao(page)

    const botao = page.getByRole('button', { name: 'Criar simulação' })
    await expect(botao).toBeDisabled()

    await page.getByRole('checkbox').check()
    await expect(botao).toBeEnabled()
  })

  test('formulario incompleto mostra as pendencias e nao envia', async ({ page }) => {
    const enviadas = await interceptarSimulacao(page)

    await page.goto('/')
    await passarPeloPortao(page)

    await page.getByLabel('Gênero').selectOption('Feminino')
    await page.getByLabel('Parte do corpo').selectOption('Mamilos')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Criar simulação' }).click()

    await expect(page.getByText('Escolha um estilo de piercing.')).toBeVisible()
    await expect(page.getByText('Envie uma foto para gerar a simulação.')).toBeVisible()
    expect(enviadas).toHaveLength(0)
  })

  test('a foto escolhida aparece na pre-visualizacao', async ({ page }) => {
    await page.goto('/')
    await passarPeloPortao(page)

    await anexarFoto(page)

    await expect(page.getByRole('img', { name: /Pré-visualização/ })).toBeVisible()
    await expect(page.getByText('minha-foto.png')).toBeVisible()
  })

  test('falha da API nao muda o que a pessoa ve', async ({ page }) => {
    await interceptarSimulacao(page, { falhando: true })

    await page.goto('/')
    await passarPeloPortao(page)
    await preencher(page)
    await page.getByRole('button', { name: 'Criar simulação' }).click()

    await expect(page.getByRole('progressbar')).toBeHidden({ timeout: 10_000 })
    await expect(page.getByText(/SIGSEGV|Segmentation fault|500/).first()).toBeVisible()
  })
})

test.describe('estilos por parte do corpo', () => {
  test('a lista se ajusta a parte escolhida', async ({ page }) => {
    await page.goto('/')
    await passarPeloPortao(page)

    await page.getByLabel('Parte do corpo').selectOption('Ânus')
    await expect(page.getByRole('radio')).toHaveCount(1)

    await page.getByLabel('Parte do corpo').selectOption('Glande')
    await expect(page.getByRole('radio')).toHaveCount(5)
  })

  test('Clitoris mostra o aviso de seguranca', async ({ page }) => {
    await page.goto('/')
    await passarPeloPortao(page)

    await page.getByLabel('Parte do corpo').selectOption('Clítoris')

    await expect(page.getByRole('note')).toContainText('danos nervosos')
  })

  test('"Outro" revela o campo de texto livre', async ({ page }) => {
    await page.goto('/')
    await passarPeloPortao(page)

    await page.getByLabel('Gênero').selectOption('Outro')

    await expect(page.getByLabel('Qual?')).toBeVisible()
  })
})
