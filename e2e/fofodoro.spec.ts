import { expect, test, type Page } from '@playwright/test';

/**
 * FofoDoro (spec 10): o pomodoro no bloco atual da coluna Hoje — prévia, pausa curta e longa, avisos e o foco que
 * nunca recomeça sozinho depois da pausa.
 */

const SCREENS = 'e2e/.screens';
const MIN = 60_000;

async function openApp(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('fofolab_onboarding_completed_v1', 'true'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Questões & Estudo Reverso/ })).toBeVisible();
}

const column = (page: Page) => page.getByLabel('Roteiro de hoje');
const toast = (page: Page) => page.getByRole('status').filter({ hasText: '🐹' });

/** Avança o relógio como uma janela minimizada: o FofoDoro se acerta pelo horário real. */
async function advance(page: Page, ms: number) {
  await page.clock.fastForward(ms);
  await page.clock.runFor(1_000);
}

test('FofoDoro: prévia, pausa curta com aviso, espera o estudante e pausa longa no fim do ciclo', async ({ page }) => {
  await page.clock.install();
  await openApp(page);

  // Antes do play: pomodoros de 20 e pausa longa a cada 2, pelos ajustes; a prévia mostra o plano
  await column(page).getByRole('radio', { name: '00:20' }).click();
  await column(page).getByRole('button', { name: 'Ajustes do FofoDoro' }).click();
  await column(page).getByLabel('Pausa longa a cada').selectOption('2');
  await expect(column(page).getByText(/pomodoros de 20 min \+ .*pausas? de 5 min \+ .*pausas? longas? de 20 min →/)).toBeVisible();

  await column(page).getByRole('button', { name: 'Iniciar bloco' }).click();
  const fofodoro = column(page).getByRole('group', { name: 'FofoDoro' });
  await expect(fofodoro.getByText('Depois: pausa de 05:00')).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/14-fofodoro-foco.png` });

  // Fim do 1º foco: aviso acolhedor e pausa curta
  await advance(page, 20 * MIN);
  await expect(toast(page)).toContainText('Parabéns: 20 minutos de foco! Que tal 5 minutos de pausa?');
  await expect(fofodoro.getByRole('img', { name: /^Pausa:/ })).toBeVisible();

  // Fim da pausa: espera o estudante — o foco não volta sozinho, nem 10 minutos depois
  await advance(page, 5 * MIN);
  await expect(fofodoro.getByText('Pronto quando você estiver')).toBeVisible();
  await advance(page, 10 * MIN);
  await expect(fofodoro.getByRole('img', { name: /^Pronto:/ })).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/15-fofodoro-pronto.png` });

  // 2º pomodoro fecha o ciclo: pausa longa, com o aviso
  await fofodoro.getByRole('button', { name: 'Começar o próximo pomodoro' }).click();
  await advance(page, 20 * MIN);
  await expect(toast(page)).toContainText('2 pomodoros seguidos! Pausa longa de 20 minutos — você mereceu.');
  await expect(fofodoro.getByRole('img', { name: /^Pausa longa:/ })).toBeVisible();

  // O aviso fecha no botão
  await toast(page).getByRole('button', { name: 'Fechar aviso' }).click();
  await expect(toast(page)).toHaveCount(0);

  // Os ajustes ficam lembrados neste computador
  await page.reload();
  await column(page).getByRole('button', { name: 'Ajustes do FofoDoro' }).click();
  await expect(column(page).getByLabel('Pausa longa a cada')).toHaveValue('2');
});
