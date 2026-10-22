import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Casca da bancada (spec 09, entrega 9a): cabeçalho fixo de ponta a ponta e painéis que recolhem
 * para um trilho em vez de sumir.
 */

const SCREENS = 'e2e/.screens';
const TRANSITION_MS = 300;

async function openPro(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('fofolab_onboarding_completed_v1', 'true'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Bancada Pro' }).click();
  await expect(page.getByRole('button', { name: /Questões & Estudo Reverso/ })).toBeVisible();
}

const leftColumn = (page: Page) => page.getByRole('complementary', { name: 'Coluna de tópicos' });
const rightColumn = (page: Page) => page.getByRole('complementary', { name: 'Copiloto e Caderno' });

async function boxes(controls: Locator[]) {
  return Promise.all(controls.map(async (control) => control.boundingBox()));
}

test('recolher e reabrir painéis não move nenhum controle do cabeçalho', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await openPro(page);
  const header = page.locator('header');
  const controls = [
    header.getByRole('button', { name: 'Recalibrar perfil' }),
    header.getByRole('button', { name: 'Começar bloco de estudo' }),
    header.getByRole('button', { name: 'Bancada Pro' }),
  ];
  const before = await boxes(controls);
  expect((await header.boundingBox())!.height).toBeLessThanOrEqual(64);

  await page.getByRole('button', { name: 'Recolher tópicos' }).click();
  await page.getByRole('button', { name: 'Recolher Copiloto e Caderno' }).click();
  await page.waitForTimeout(TRANSITION_MS);
  await expect(leftColumn(page)).toHaveCSS('width', '44px');
  await expect(rightColumn(page)).toHaveCSS('width', '44px');
  expect(await boxes(controls)).toEqual(before);
  await page.screenshot({ path: `${SCREENS}/08-casca-recolhida.png` });

  await page.getByRole('button', { name: 'Abrir tópicos' }).click();
  await page.getByRole('button', { name: 'Abrir Copiloto IA' }).click();
  await page.waitForTimeout(TRANSITION_MS);
  await expect(page.getByRole('complementary', { name: 'Painel de Tópicos e Edital' })).toBeVisible();
  expect(await boxes(controls)).toEqual(before);
});

test('recolhido continua recolhido depois de fechar e abrir o app', async ({ page }) => {
  await openPro(page);
  await page.getByRole('button', { name: 'Recolher tópicos' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Bancada Pro' }).click();
  await expect(leftColumn(page)).toHaveCSS('width', '44px');
  await expect(page.getByRole('button', { name: 'Abrir tópicos' })).toBeVisible();
});

test('o rascunho do caderno sobrevive a trocar de aba e a recolher a coluna', async ({ page }) => {
  await openPro(page);
  await page.getByRole('tab', { name: 'Caderno' }).click();
  const draft = page.getByLabel('Conteúdo do caderno do tópico');
  await draft.fill('Rascunho que não pode sumir');
  await page.getByRole('tab', { name: 'Copiloto' }).click();
  await expect(draft).toBeHidden();
  await page.getByRole('button', { name: 'Recolher Copiloto e Caderno' }).click();
  await page.getByRole('button', { name: 'Abrir Caderno' }).click();
  await expect(draft).toBeVisible();
  await expect(draft).toHaveValue('Rascunho que não pode sumir');
});

test('quem pediu menos movimento não vê animação', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPro(page);
  const duration = await leftColumn(page).evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration).toBe('0s');
});
