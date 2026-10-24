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
  await expect(page.getByRole('button', { name: 'Questões', exact: true })).toBeVisible();
}

const leftColumn = (page: Page) => page.getByRole('complementary', { name: 'Coluna do roteiro' });
const rightColumn = (page: Page) => page.getByRole('complementary', { name: 'FofoIA e Caderno' });

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
  ];
  const before = await boxes(controls);
  expect((await header.boundingBox())!.height).toBeLessThanOrEqual(64);

  await page.getByRole('button', { name: 'Recolher roteiro' }).click();
  await page.getByRole('button', { name: 'Recolher FofoIA e Caderno' }).click();
  await page.waitForTimeout(TRANSITION_MS);
  await expect(leftColumn(page)).toHaveCSS('width', '44px');
  await expect(rightColumn(page)).toHaveCSS('width', '44px');
  expect(await boxes(controls)).toEqual(before);
  await page.screenshot({ path: `${SCREENS}/08-casca-recolhida.png` });

  await page.getByRole('button', { name: 'Abrir roteiro' }).click();
  await page.getByRole('button', { name: 'Abrir FofoIA' }).click();
  await page.waitForTimeout(TRANSITION_MS);
  await expect(page.getByLabel('Roteiro de hoje')).toBeVisible();
  expect(await boxes(controls)).toEqual(before);
});

test('recolhido continua recolhido depois de fechar e abrir o app', async ({ page }) => {
  await openPro(page);
  await page.getByRole('button', { name: 'Recolher roteiro' }).click();
  await page.reload();
  await expect(leftColumn(page)).toHaveCSS('width', '44px');
  await expect(page.getByRole('button', { name: 'Abrir roteiro' })).toBeVisible();
});

test('o rascunho do caderno sobrevive a trocar de aba e a recolher a coluna', async ({ page }) => {
  await openPro(page);
  await page.getByRole('tab', { name: 'Caderno' }).click();
  const draft = page.getByLabel('Conteúdo do caderno do tópico');
  await draft.fill('Rascunho que não pode sumir');
  await page.getByRole('tab', { name: 'FofoIA' }).click();
  await expect(draft).toBeHidden();
  await page.getByRole('button', { name: 'Recolher FofoIA e Caderno' }).click();
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

test('a seta de recolher não cobre o título do roteiro', async ({ page }) => {
  await openPro(page);
  const arrow = (await page.getByRole('button', { name: 'Recolher roteiro' }).boundingBox())!;
  const modeButton = (await page.getByLabel('Roteiro de hoje').getByRole('heading').boundingBox())!;
  const overlaps =
    arrow.x < modeButton.x + modeButton.width &&
    modeButton.x < arrow.x + arrow.width &&
    arrow.y < modeButton.y + modeButton.height &&
    modeButton.y < arrow.y + arrow.height;
  expect(overlaps).toBe(false);
});

test('na leitura ampliada, trocar para o Copiloto não some com a coluna', async ({ page }) => {
  await openPro(page);
  await page.getByRole('button', { name: /Leitura de PDF/ }).click();
  await page.getByRole('button', { name: 'Maximizar leitura' }).click();
  await page.getByRole('tab', { name: 'FofoIA' }).click();
  await expect(rightColumn(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'FofoIA' })).toHaveAttribute('aria-selected', 'true');
});

test('mexer nos painéis durante a leitura não deixa a preferência diferente da tela', async ({ page }) => {
  await openPro(page);
  await page.getByRole('button', { name: /Leitura de PDF/ }).click();
  await page.getByRole('button', { name: 'Recolher FofoIA e Caderno' }).click();
  await page.getByRole('button', { name: 'Questões', exact: true }).click();
  await expect(rightColumn(page)).not.toHaveCSS('width', '44px');
  await page.reload();
  await expect(rightColumn(page)).not.toHaveCSS('width', '44px');
  await expect(page.getByRole('region', { name: 'FofoIA' })).toBeVisible();
});

test('passar o mouse no Mapa de Calor não faz a grade pular', async ({ page }) => {
  await openPro(page);
  await page.getByRole('button', { name: 'Mapa de Calor', exact: true }).click();
  const squares = page.getByRole('main').getByRole('button', { name: /: (Frio|Morno|Atenção|Quente|Muito quente)$/ });
  const lastSquare = squares.last();
  const before = await lastSquare.boundingBox();
  const count = await squares.count();
  for (let i = 0; i < Math.min(count, 12); i++) await squares.nth(i).hover();
  // O quadrado sob o mouse cresce (hover); medir só com o mouse fora e a animação terminada
  await page.mouse.move(0, 0);
  await page.waitForTimeout(TRANSITION_MS);
  expect(await lastSquare.boundingBox()).toEqual(before);
});
