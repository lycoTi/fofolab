import { expect, test, type Page } from '@playwright/test';

/**
 * Fofo no app (regra .agents/rules/identidade-fofolab.md): o mascote do cabeçalho troca de roupa conforme a aba,
 * a hora e as datas especiais.
 */

const SCREENS = 'e2e/.screens';

async function openAt(page: Page, when: Date) {
  await page.clock.setFixedTime(when);
  await page.addInitScript(() => window.localStorage.setItem('fofolab_onboarding_completed_v1', 'true'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Questões', exact: true })).toBeVisible();
}

const headerFofo = (page: Page, name: string) => page.locator('header').getByRole('img', { name, exact: true });

test('num dia comum, o Fofo do cabeçalho veste a roupa de cada aba', async ({ page }) => {
  await openAt(page, new Date(2026, 7, 12, 14, 0));
  await expect(headerFofo(page, 'Fofo')).toBeVisible();

  await page.getByRole('button', { name: 'Plano de estudo', exact: true }).click();
  await expect(headerFofo(page, 'Fofo de fazendeiro')).toBeVisible();

  await page.getByRole('button', { name: 'Questões', exact: true }).click();
  await expect(headerFofo(page, 'Fofo de explorador')).toBeVisible();
  await page.locator('header').screenshot({ path: `${SCREENS}/fofo-cabecalho-explorador.png` });
});

test('em outubro o Fofo fica de fantasma em qualquer aba', async ({ page }) => {
  await openAt(page, new Date(2026, 9, 20, 14, 0));
  await expect(headerFofo(page, 'Fofo fantasiado de fantasma')).toBeVisible();

  await page.getByRole('button', { name: 'Questões', exact: true }).click();
  await expect(headerFofo(page, 'Fofo fantasiado de fantasma')).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/fofo-halloween.png` });
});
