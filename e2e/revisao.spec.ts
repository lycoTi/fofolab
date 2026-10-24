import { expect, test, type Page } from '@playwright/test';

/**
 * Revisão do dia e aba Início (spec 09 §5.3 + spec 07 §5.5). O relógio fica em 24/10/2026 de manhã: os tópicos do
 * exemplo inicial foram estudados entre 15 e 20/10, então a revisão sorteada é sempre a mesma.
 */

const SCREENS = 'e2e/.screens';

async function openApp(page: Page) {
  await page.clock.install({ time: new Date(2026, 9, 24, 8, 0) });
  await page.addInitScript(() => window.localStorage.setItem('fofolab_onboarding_completed_v1', 'true'));
  await page.goto('/');
}

const review = (page: Page) => page.getByRole('region', { name: 'Revisão do dia' });
const column = (page: Page) => page.getByLabel('Roteiro de hoje');

async function waitSaved(page: Page) {
  await expect(page.getByText('Salvo', { exact: true })).toBeVisible();
}

/** Faz o item da vez, seja questão (confiança → primeira alternativa → Próxima) ou pergunta aberta. */
async function doCurrentItem(page: Page) {
  const card = review(page);
  if (await card.getByRole('button', { name: 'Tenho certeza' }).isVisible()) {
    await card.getByRole('button', { name: 'Tenho certeza' }).click();
    await card.locator('button[class*="text-left"]').first().click();
    await expect(card.getByText(/^Gabarito:/)).toBeVisible();
    await card.getByRole('button', { name: 'Próxima' }).click();
    return;
  }
  await card.getByRole('textbox').fill('O que eu lembro, sem consultar.');
  await card.getByRole('button', { name: 'Ver minhas anotações' }).click();
  await card.getByRole('button', { name: 'Lembrei bem' }).click();
}

async function totalItems(page: Page): Promise<number> {
  const title = await review(page).getByRole('heading', { name: /^Revisão do dia · / }).textContent();
  return Number(/de (\d+)$/.exec(title ?? '')?.[1]);
}

test('revisão do dia: responde, autoavalia, sobrevive a recarregar e não volta depois de feita', async ({ page }) => {
  await openApp(page);

  // Abre no Início: saudação, revisão e situação
  await expect(page.getByRole('heading', { name: 'Bom dia' })).toBeVisible();
  await expect(review(page).getByRole('heading', { name: /^Revisão do dia · 1 de \d$/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Situação' })).toBeVisible();
  const total = await totalItems(page);
  expect(total).toBeGreaterThanOrEqual(3);
  expect(total).toBeLessThanOrEqual(5);
  const firstTopic = await review(page).locator('p.text-orange-200').textContent();
  await page.screenshot({ path: `${SCREENS}/30-inicio-revisao.png` });

  // Primeiro item feito; recarregar mantém a posição e a seleção do dia
  await doCurrentItem(page);
  await expect(review(page).getByRole('heading', { name: `Revisão do dia · 2 de ${total}` })).toBeVisible();
  const secondTopic = await review(page).locator('p.text-orange-200').textContent();
  expect(secondTopic).not.toBe(firstTopic);
  await waitSaved(page);
  await page.reload();
  await expect(review(page).getByRole('heading', { name: `Revisão do dia · 2 de ${total}` })).toBeVisible();
  await expect(review(page).locator('p.text-orange-200')).toHaveText(secondTopic ?? '');

  // O resto da revisão
  for (let i = 2; i <= total; i++) await doCurrentItem(page);
  await expect(review(page).getByText(`Revisão de hoje feita: ${total} tópicos revisados.`)).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/31-revisao-feita.png` });

  // Feita, continua feita depois de fechar e abrir
  await waitSaved(page);
  await page.reload();
  await expect(review(page).getByText(`Revisão de hoje feita: ${total} tópicos revisados.`)).toBeVisible();
});

test('fazer questões fora do app conclui o item pelo registro rápido', async ({ page }) => {
  await openApp(page);
  const total = await totalItems(page);
  const topic = (await review(page).locator('p.text-orange-200').textContent()) ?? '';
  const topicLabel = topic.split(' · ').slice(1).join(' · ');

  await review(page).getByRole('button', { name: 'Fiz questões fora do app' }).click();
  await expect(column(page).getByText('Resolveu questões em outro lugar? Registre seu desempenho.')).toBeVisible();
  await expect(column(page).getByRole('combobox')).toHaveValue(/.+/);
  await expect(column(page).getByRole('combobox').locator('option:checked')).toHaveText(topicLabel);
  const [totalInput, correctInput] = await column(page).getByRole('spinbutton').all();
  await totalInput.fill('10');
  await correctInput.fill('7');
  await column(page).getByRole('button', { name: 'Registrar' }).click();

  await expect(review(page).getByRole('heading', { name: `Revisão do dia · 2 de ${total}` })).toBeVisible();
});

test('revisão desligada no Wizard não aparece no Início', async ({ page }) => {
  await openApp(page);
  await expect(review(page)).toBeVisible();

  await page.locator('header').getByRole('button', { name: 'Recalibrar perfil' }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByRole('checkbox', { name: /Revisão do dia ao abrir o app/ }).uncheck();
  await page.getByRole('button', { name: /Gerar Meu Roteiro de Hoje/ }).click();

  await page.getByRole('button', { name: 'Início' }).click();
  await expect(page.getByRole('region', { name: 'Situação' })).toBeVisible();
  await expect(review(page)).toHaveCount(0);

  await waitSaved(page);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Situação' })).toBeVisible();
  await expect(review(page)).toHaveCount(0);
});
