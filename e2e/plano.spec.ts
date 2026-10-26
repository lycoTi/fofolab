import { expect, test, type Page } from '@playwright/test';

/**
 * Plano de estudo (spec 13, entrega 13a): dias de estudo e horas de cada dia, a semana dia a dia e
 * "mudar o tempo de hoje" — tudo sobrevive a recarregar a página.
 */

const SCREENS = 'e2e/.screens';

async function openApp(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('fofolab_onboarding_completed_v1', 'true'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Questões', exact: true })).toBeVisible();
}

const column = (page: Page) => page.getByLabel('Roteiro de hoje');
const week = (page: Page) => page.getByRole('region', { name: 'Sua semana' });

test('dias de estudo, Sua semana e "mudar o tempo de hoje" ficam gravados depois de recarregar', async ({ page }) => {
  // Terça-feira: há dia que passou, hoje e dias de previsão
  await page.clock.install({ time: new Date('2026-10-27T09:00:00') });
  await openApp(page);
  await page.getByRole('button', { name: 'Plano de estudo', exact: true }).click();
  await expect(week(page).getByRole('listitem', { name: /^Ter 27/ })).toHaveAttribute('aria-current', 'date');

  // Ajustar: domingo de folga e sábado com 05:00
  await page.locator('summary', { hasText: 'Ajustar' }).click();
  await page.getByRole('button', { name: 'Dom', exact: true }).click();
  await page.getByLabel('Tempo de sábado').selectOption('300');
  await expect(week(page).getByRole('listitem', { name: /^Dom 1, folga/ })).toContainText('Folga');
  await expect(week(page).getByRole('listitem', { name: /^Sáb 31/ })).toContainText('05:00');
  await expect(week(page).getByRole('listitem', { name: /^Qua 28/ })).toContainText('previsão');
  await expect(page.locator('main')).not.toContainText(/\d+ ?min\b|\d+\.\d+h\b/);
  await page.screenshot({ path: `${SCREENS}/14-plano-sua-semana.png`, fullPage: true });

  // Coluna: hoje só 01:00
  await column(page).getByRole('button', { name: 'Mudar o tempo de hoje' }).click();
  await column(page).getByLabel('Tempo de hoje').selectOption('60');
  await expect(column(page).getByText('Hoje · 01:00')).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/15-tempo-de-hoje.png` });

  await page.reload();
  await expect(column(page).getByText('Hoje · 01:00')).toBeVisible();
  await page.getByRole('button', { name: 'Plano de estudo', exact: true }).click();
  await expect(week(page).getByRole('listitem', { name: /^Dom 1, folga/ })).toContainText('Folga');
  await expect(week(page).getByRole('listitem', { name: /^Ter 27/ })).toContainText('01:00');

  // "Hoje não vou estudar": a coluna fica neutra, sem cobrança
  await column(page).getByRole('button', { name: 'Mudar o tempo de hoje' }).click();
  await column(page).getByRole('button', { name: 'Hoje não vou estudar' }).click();
  await expect(column(page).getByText(/Hoje é dia de folga/)).toBeVisible();
});
