import { expect, test, type Page } from '@playwright/test';

/**
 * Fofo no app (regra .agents/rules/identidade-fofolab.md): a roupa do cabeçalho segue o sol, as festas e o
 * guarda-roupa (clicar no Fofo), que fica guardado depois de recarregar.
 */

const SCREENS = 'e2e/.screens';
// Fuso fixo: o pôr do sol vem do fuso do computador, e o teste não pode depender de onde roda
test.use({ timezoneId: 'America/Sao_Paulo' });

async function openAt(page: Page, isoWithOffset: string) {
  await page.clock.setFixedTime(new Date(isoWithOffset));
  await page.addInitScript(() => window.localStorage.setItem('fofolab_onboarding_completed_v1', 'true'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Questões', exact: true })).toBeVisible();
}

const wardrobe = (page: Page) => page.locator('header').getByRole('button', { name: /Guarda-roupa do Fofo/ });

test('a roupa do cabeçalho segue o sol: fazendeiro de dia, explorador ao anoitecer, madrugada depois das 22:00', async ({ page }) => {
  await openAt(page, '2026-08-12T14:00:00-03:00');
  await expect(wardrobe(page)).toHaveAccessibleName(/^Fofo de fazendeiro/);
});

test('ao anoitecer é o explorador com a lanterna', async ({ page }) => {
  await openAt(page, '2026-08-12T19:30:00-03:00');
  await expect(wardrobe(page)).toHaveAccessibleName(/^Fofo de explorador/);
});

test('depois das 22:00 é o estudante da madrugada', async ({ page }) => {
  await openAt(page, '2026-08-12T23:00:00-03:00');
  await expect(wardrobe(page)).toHaveAccessibleName(/^Fofo estudando de madrugada/);
});

test('em outubro o Fofo fica de fantasma', async ({ page }) => {
  await openAt(page, '2026-10-20T14:00:00-03:00');
  await expect(wardrobe(page)).toHaveAccessibleName(/^Fofo fantasiado de fantasma/);
  await page.screenshot({ path: `${SCREENS}/fofo-halloween.png` });
});

test('guarda-roupa: roupa fixa e "Fui nomeado!" ficam guardados depois de recarregar', async ({ page }) => {
  await openAt(page, '2026-08-12T14:00:00-03:00');
  await wardrobe(page).click();
  const dialog = page.getByRole('dialog', { name: 'Guarda-roupa do Fofo' });
  await dialog.getByRole('button', { name: 'Fofo de Natal', exact: true }).click();
  await expect(wardrobe(page)).toHaveAccessibleName(/^Fofo de Natal/);
  await page.screenshot({ path: `${SCREENS}/fofo-guarda-roupa.png` });

  await page.reload();
  await expect(wardrobe(page)).toHaveAccessibleName(/^Fofo de Natal/);

  // Volta para a automática e marca o nomeado
  await wardrobe(page).click();
  await dialog.getByRole('button', { name: /^Automática/ }).click();
  await dialog.getByRole('button', { name: 'Fui nomeado!' }).click();
  await expect(wardrobe(page)).toHaveAccessibleName(/^Fofo nomeado/);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.reload();
  await expect(wardrobe(page)).toHaveAccessibleName(/^Fofo nomeado/);
});
