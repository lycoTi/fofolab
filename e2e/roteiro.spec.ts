import { expect, test, type Page } from '@playwright/test';

/**
 * Roteiro do dia na coluna (spec 09, entrega 9b): congelado no dia, olhada com pausa automática e dica.
 */

const SCREENS = 'e2e/.screens';

async function openApp(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('fofolab_onboarding_completed_v1', 'true'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Questões & Estudo Reverso/ })).toBeVisible();
}

const column = (page: Page) => page.getByLabel('Roteiro de hoje');
const items = (page: Page) => column(page).locator('[data-testid^="routine-item-"]');
const currentSubject = (page: Page) => column(page).locator('[data-status="current"] .font-semibold').first();

test('roteiro congelado: recarregar no mesmo dia mantém os blocos, e estudar não troca o bloco', async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  await expect(items(page).first()).toBeVisible();
  const before = await items(page).allInnerTexts();
  const subject = await currentSubject(page).innerText();

  await page.reload();
  await expect(items(page).first()).toBeVisible();
  expect(await items(page).allInnerTexts()).toEqual(before);

  // 30 min de estudo no bloco: ele continua sendo o atual e mostra o tempo feito
  await column(page).getByRole('button', { name: 'Iniciar bloco' }).click();
  await page.clock.fastForward(30 * 60_000);
  await page.clock.runFor(1_000);
  await page.reload();
  await expect(currentSubject(page)).toHaveText(subject);
  await expect(column(page).locator('[data-status="current"]')).toContainText('00:30 de');
  await page.screenshot({ path: `${SCREENS}/09-roteiro-na-coluna.png` });
});

test('olhar outra matéria pausa o bloco, a dica aparece depois de 3 min e "Voltar ao bloco" retoma', async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  await column(page).getByRole('button', { name: 'Iniciar bloco' }).click();
  await expect(page.getByRole('button', { name: 'Pausar bloco' })).toBeVisible();
  const subject = await currentSubject(page).innerText();

  // Abre pelo Ciclo uma matéria que não é a do bloco
  await page.getByRole('button', { name: 'Ciclo', exact: true }).click();
  await page.getByRole('button', { name: /^Abrir .* na bancada$/ }).filter({ hasNotText: subject }).first().click();
  await expect(column(page)).toContainText('fora do roteiro de hoje');
  await expect(page.getByRole('button', { name: 'Continuar bloco' })).toBeVisible();

  await page.clock.runFor(180_000);
  await expect(column(page)).toContainText('está esperando');

  await column(page).getByRole('button', { name: 'Voltar ao bloco' }).click();
  await expect(page.getByRole('button', { name: 'Pausar bloco' })).toBeVisible();
  await expect(column(page)).not.toContainText('fora do roteiro');
});

test('a barrinha do bloco anda com o tempo e o relógio do cabeçalho leva ao Ciclo', async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  await column(page).getByRole('button', { name: 'Iniciar bloco' }).click();
  const blockBar = column(page).getByRole('progressbar', { name: 'Progresso do bloco' });
  const pomodoroBar = page.locator('header').getByRole('progressbar', { name: 'Progresso do pomodoro' });
  await expect(blockBar).toBeVisible();
  await expect(pomodoroBar).toBeVisible();
  const before = Number(await blockBar.getAttribute('aria-valuenow'));

  await page.clock.fastForward(15 * 60_000);
  await page.clock.runFor(1_000);
  await expect.poll(async () => Number(await blockBar.getAttribute('aria-valuenow'))).toBeGreaterThan(before);
  await expect.poll(async () => Number(await pomodoroBar.getAttribute('aria-valuenow'))).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Ver o bloco no Ciclo' }).click();
  await expect(page.getByRole('region', { name: 'Bloco de estudo' })).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/10-barras-de-progresso.png` });
});
