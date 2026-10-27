import { expect, type Page } from '@playwright/test';

/** Abre o app sem o Wizard do primeiro acesso. */
export async function openApp(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('fofolab_onboarding_completed_v1', 'true'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Questões', exact: true })).toBeVisible();
}

export const routineColumn = (page: Page) => page.getByLabel('Roteiro de hoje');

/** Plano a partir do edital real da CGU 2026 (cargo 4), com 03:00 em todos os dias e o resto do Wizard no padrão. */
export async function importCguEdital(page: Page) {
  await routineColumn(page).getByRole('button', { name: 'Edital', exact: true }).click();
  const curriculum = page.getByRole('dialog', { name: 'Organizar edital' });
  await curriculum.getByRole('button', { name: 'Importar edital (PDF)' }).click();
  const importDialog = page.getByRole('dialog', { name: 'Importar edital' });
  await importDialog.getByLabel('Escolher PDF do edital').setInputFiles('e2e/fixtures/cgu-2026-affc-edital.pdf');
  await importDialog.getByRole('combobox').selectOption({ label: 'Cargo 4: Tecnologia da Informação – Desenvolvimento de Sistemas' });
  await importDialog.getByRole('button', { name: 'Criar meu plano' }).click();
  // O assistente abre nas horas: 03:00 em todos os dias
  await expect(page.getByText('Passo 2 de 5')).toBeVisible();
  await page.getByRole('button', { name: '03:00 nos dias de estudo' }).click();
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByRole('button', { name: /Gerar Meu Roteiro de Hoje/ }).click();
}
