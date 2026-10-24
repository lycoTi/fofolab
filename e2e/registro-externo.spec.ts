import { expect, test, type Page } from '@playwright/test';

/**
 * Registro rápido de questões feitas fora do app (spec 07 §5.4): só os números viram evidência de domínio.
 */

const SCREENS = 'e2e/.screens';

async function openApp(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('fofolab_onboarding_completed_v1', 'true'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Questões', exact: true })).toBeVisible();
}

const column = (page: Page) => page.getByLabel('Roteiro de hoje');

/** Conclui um bloco para o convite aparecer e devolve o rótulo do tópico sugerido. */
async function finishBlockAndOpenInvite(page: Page): Promise<string> {
  await column(page).getByRole('button', { name: 'Iniciar bloco' }).click();
  await page.locator('header').getByRole('button', { name: 'Concluir bloco' }).click();
  await expect(column(page)).toContainText('Resolveu questões em outro lugar? Registre seu desempenho.');
  const select = column(page).getByLabel('Tópico');
  return (await select.locator('option:checked').innerText()).trim();
}

async function register(page: Page, total: string, correct: string, blank: string) {
  await column(page).getByLabel('Total').fill(total);
  await column(page).getByLabel('Certas').fill(correct);
  await column(page).getByLabel('Em branco').fill(blank);
  await column(page).getByRole('button', { name: 'Registrar', exact: true }).click();
}

async function questionsShownInHeatmap(page: Page, topicLabel: string): Promise<string> {
  await page.getByRole('button', { name: 'Mapa de Calor', exact: true }).click();
  await page.getByRole('main').getByRole('button', { name: new RegExp(`^${topicLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`) }).click();
  return page.getByRole('main').locator('.h-\\[5\\.25rem\\]').innerText();
}

test('registrar questões feitas fora do app vira evidência e sobrevive a fechar e abrir', async ({ page }) => {
  await openApp(page);
  const topicLabel = await finishBlockAndOpenInvite(page);
  await register(page, '20', '14', '2');
  await expect(column(page)).toContainText('Registrado: 14 de 20 (70%)');
  await page.screenshot({ path: `${SCREENS}/11-registro-externo.png` });

  await page.reload();
  await expect(page.getByRole('button', { name: 'Questões', exact: true })).toBeVisible();
  expect(await questionsShownInHeatmap(page, topicLabel)).toContain('20 questões');
});

test('desfazer o registro pede confirmação e apaga a evidência', async ({ page }) => {
  await openApp(page);
  const topicLabel = await finishBlockAndOpenInvite(page);
  await register(page, '20', '14', '2');
  await column(page).getByRole('button', { name: 'Desfazer' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Desfazer' }).click();
  await expect(column(page)).not.toContainText('Registrado:');
  expect(await questionsShownInHeatmap(page, topicLabel)).not.toContain('20 questões');
});
