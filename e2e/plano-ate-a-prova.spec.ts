import { expect, test, type Page } from '@playwright/test';
import { importCguEdital, openApp, routineColumn } from './helpers';

/**
 * Plano de estudo até a prova (spec 13, entrega 13b): "Dá tempo?", linha do tempo e reta final — com o edital real da
 * CGU 2026 (prova em 13/12/2026) e o relógio fixo.
 */

const SCREENS = 'e2e/.screens';

const column = routineColumn;
const outlook = (page: Page) => page.getByRole('region', { name: 'Dá tempo?' });

test('edital real: "Dá tempo?" até a véspera da reta final, linha do tempo e reta final ajustável', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T09:00:00') });
  await openApp(page);
  await importCguEdital(page);
  await page.getByRole('button', { name: 'Plano de estudo', exact: true }).click();

  // Prova em 13/12, reta final de 14 dias: começa em 29/11, então a conta vai até 28/11
  await expect(outlook(page)).toContainText('do edital visto até 28/11');
  const timeline = page.getByRole('region', { name: 'Linha do tempo até a prova' });
  await expect(timeline.getByRole('listitem')).toHaveCount(7);
  await expect(timeline).toContainText('Teoria + questões');
  await expect(timeline).toContainText('Últimos tópicos');
  await expect(timeline).toContainText('Reta final: revisão');
  await expect(page.locator('main')).not.toContainText(/\d+ ?min\b|NaN|undefined/);
  await page.screenshot({ path: `${SCREENS}/17-da-tempo-e-linha-do-tempo.png`, fullPage: true });

  // Reta final de 21 dias: começa em 22/11
  await page.locator('summary', { hasText: 'Ajustar' }).click();
  await page.getByLabel('Dias da reta final').selectOption('21');
  await expect(outlook(page)).toContainText('do edital visto até 21/11');

  await page.reload();
  await page.getByRole('button', { name: 'Plano de estudo', exact: true }).click();
  await expect(outlook(page)).toContainText('do edital visto até 21/11');
});

test('na reta final, o roteiro de hoje é só revisão e o "Dá tempo?" diz que é reta final', async ({ page }) => {
  // Exemplo inicial: prova em 15/03/2027, reta final de 14 dias a partir de 01/03; já há tópicos estudados
  await page.clock.install({ time: new Date('2027-03-05T09:00:00') });
  await openApp(page);
  await expect(column(page)).toContainText('Reta final: revisar');
  await page.getByRole('button', { name: 'Plano de estudo', exact: true }).click();
  await expect(outlook(page)).toContainText('Reta final: só revisão e questões até a prova.');
  await page.screenshot({ path: `${SCREENS}/18-reta-final.png`, fullPage: true });
});
