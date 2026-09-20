import { expect, test } from '@playwright/test'
import { interceptarPainel, simulacao } from './fixtures/api.js'

/**
 * Painel administrativo num navegador de verdade.
 *
 * O que so aqui aparece: o overlay da imagem em tamanho real travando a
 * rolagem da pagina e respondendo ao Escape, e o ciclo de sessao acontecendo
 * na rota /secret/adm de verdade, com o router montado.
 */

async function entrar(page, usuario = 'admin', senha = 'segredo') {
  await page.getByLabel('Usuário').fill(usuario)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test.describe('sessao', () => {
  test('sem sessao, a rota mostra o login sem mudar a URL', async ({ page }) => {
    await interceptarPainel(page)

    await page.goto('/secret/adm')

    await expect(page.getByRole('heading', { name: 'Painel administrativo' })).toBeVisible()
    // Renderizar no lugar, em vez de redirecionar, mantem o caminho fora do
    // historico de navegacao.
    await expect(page).toHaveURL(/\/secret\/adm$/)
  })

  test('credencial errada mostra o alerta e limpa a senha', async ({ page }) => {
    await interceptarPainel(page)
    await page.goto('/secret/adm')

    await entrar(page, 'admin', 'errada')

    await expect(page.getByRole('alert')).toContainText('Usuário ou senha inválidos.')
    await expect(page.getByLabel('Senha')).toHaveValue('')
    await expect(page.getByLabel('Usuário')).toHaveValue('admin')
  })

  test('credencial correta abre o painel', async ({ page }) => {
    await interceptarPainel(page, { itens: [simulacao()] })
    await page.goto('/secret/adm')

    await entrar(page)

    await expect(page.getByRole('heading', { name: 'Simulações' })).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(1)
  })

  test('sair volta ao login', async ({ page }) => {
    await interceptarPainel(page, { itens: [simulacao()], autenticada: true })
    await page.goto('/secret/adm')

    await page.getByRole('button', { name: 'Sair' }).click()

    await expect(page.getByRole('heading', { name: 'Painel administrativo' })).toBeVisible()
  })

  test('sessao que expira no meio da navegacao volta ao login', async ({ page }) => {
    const estado = await interceptarPainel(page, { itens: [simulacao()], autenticada: true })
    await page.goto('/secret/adm')
    await expect(page.getByRole('article')).toHaveCount(1)

    estado.autenticada = false
    await page.getByRole('button', { name: 'Atualizar' }).click()

    await expect(page.getByRole('heading', { name: 'Painel administrativo' })).toBeVisible()
  })
})

test.describe('listagem', () => {
  test('mostra o estado vazio', async ({ page }) => {
    await interceptarPainel(page, { autenticada: true })

    await page.goto('/secret/adm')

    await expect(page.getByText('Nenhuma simulação cadastrada ainda.')).toBeVisible()
  })

  test('mostra os dados de cada simulacao com o rotulo do estilo', async ({ page }) => {
    await interceptarPainel(page, {
      autenticada: true,
      itens: [simulacao({ gender: 'Outro', genderOther: 'Agênero', style: 'vch' })],
    })

    await page.goto('/secret/adm')

    await expect(page.getByText('Outro — Agênero')).toBeVisible()
    await expect(page.getByText('VCH (Vertical Clitoral Hood)')).toBeVisible()
  })

  test('avisa quando a listagem esta cortada pelo limite', async ({ page }) => {
    await interceptarPainel(page, {
      autenticada: true,
      total: 137,
      itens: [simulacao({ id: 'a' }), simulacao({ id: 'b' })],
    })

    await page.goto('/secret/adm')

    await expect(page.getByText(/exibindo as 2 mais recentes/)).toBeVisible()
  })

  test('imagem indisponivel no storage nao quebra o card', async ({ page }) => {
    await interceptarPainel(page, { autenticada: true, itens: [simulacao({ imageUrl: null })] })

    await page.goto('/secret/adm')

    await expect(page.getByText('Imagem indisponível no storage')).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(1)
  })
})

test.describe('imagem em tamanho real', () => {
  test('abre em overlay e trava a rolagem da pagina', async ({ page }) => {
    await interceptarPainel(page, { autenticada: true, itens: [simulacao()] })
    await page.goto('/secret/adm')

    await page.getByRole('button', { name: /Simulação enviada em/ }).click()

    await expect(page.getByRole('dialog', { name: /tamanho real/ })).toBeVisible()
    // Sem isto a lista continuaria rolando atras do overlay.
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  })

  test('fecha com Escape e devolve a rolagem', async ({ page }) => {
    await interceptarPainel(page, { autenticada: true, itens: [simulacao()] })
    await page.goto('/secret/adm')
    await page.getByRole('button', { name: /Simulação enviada em/ }).click()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  })

  test('clicar fora fecha, clicar na imagem nao', async ({ page }) => {
    await interceptarPainel(page, { autenticada: true, itens: [simulacao()] })
    await page.goto('/secret/adm')
    await page.getByRole('button', { name: /Simulação enviada em/ }).click()

    const overlay = page.getByRole('dialog', { name: /tamanho real/ })
    await overlay.getByRole('img').click()
    await expect(overlay).toBeVisible()

    await overlay.click({ position: { x: 5, y: 5 } })
    await expect(overlay).toBeHidden()
  })
})
