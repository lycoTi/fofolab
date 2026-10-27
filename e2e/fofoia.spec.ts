import { expect, test, type Page } from '@playwright/test';

/**
 * FofoIA (spec 11): um só professor na coluna direita, pistas sem gabarito antes de responder, aula completa que alarga a
 * coluna, resumo de revisão e "Cai no meu edital?" — tudo em modo demonstração (sem chave de IA nos testes).
 */

const SCREENS = 'e2e/.screens';

async function openQuestions(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('fofolab_onboarding_completed_v1', 'true'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Questões', exact: true }).click();
  await page.getByLabel('Escopo das questões').selectOption('all');
}

const fofo = (page: Page) => page.getByRole('region', { name: 'FofoIA' });
const rightColumn = (page: Page) => page.getByRole('complementary', { name: 'FofoIA e Caderno' });

test('questão: confiança antes, pista da FofoIA sem gabarito, depois diagnóstico deduzido e "Por quê?"', async ({ page }) => {
  await openQuestions(page);
  await expect(page.getByRole('button', { name: /^A\)/ })).toHaveCount(0);

  await page.getByRole('button', { name: /Pedir pista à FofoIA/ }).click();
  const hint = fofo(page).getByText('🐹🔎 Pista');
  await expect(hint).toBeVisible();
  await expect(fofo(page).getByText('Exemplo simulado — a IA ainda não está configurada').first()).toBeVisible();
  await expect(fofo(page)).not.toContainText('Gabarito');

  await page.getByRole('button', { name: 'Sei', exact: true }).click();
  await page.getByRole('main').getByRole('button', { name: /^[A-E]\)/ }).first().click();
  await expect(page.getByText(/^Gabarito: /)).toBeVisible();
  const wrong = await page.getByText('Por quê?').isVisible();
  if (wrong) {
    await expect(page.getByText('Você tinha certeza. Vale entender de onde veio essa ideia.')).toBeVisible();
    await page.getByRole('button', { name: /Confundi com outra coisa/ }).click();
    await expect(page.getByText(/Confundi com outra coisa registrado/)).toBeVisible();
  } else {
    await expect(page.getByRole('button', { name: /Dominei/ })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.screenshot({ path: `${SCREENS}/40-questao-e-fofoia.png` });

  await page.getByRole('button', { name: /Aprofundar com a FofoIA/ }).click();
  await expect(fofo(page).getByText(/Me explique esta questão/).first()).toBeVisible();
});

test('pista de questão Certo/Errado vem do próprio app (sem IA), em níveis, e nunca julga a afirmação', async ({ page }) => {
  await openQuestions(page);
  await page.getByRole('button', { name: 'Importar Questões' }).first().click();
  await page.getByLabel('Texto das questões').fill(`1. (Cebraspe/CGU/2024) [tópico 1.3] Item E2E Certo/Errado: a amostragem estatística elimina o risco de detecção.
Gabarito: Errado`);
  await page.getByRole('button', { name: 'Analisar' }).click();
  await page.getByRole('button', { name: /Importar 1 questão/ }).click();
  await expect(page.getByText(/1 importada/)).toBeVisible();
  await page.getByRole('button', { name: 'Fechar importação' }).click();
  await page.getByPlaceholder('Buscar termo no enunciado...').fill('Item E2E Certo/Errado');
  await expect(page.getByText(/Item E2E Certo\/Errado/)).toBeVisible();

  await page.getByRole('button', { name: /Pedir pista à FofoIA/ }).click();
  await expect(fofo(page).getByText(/Esta questão testa/)).toBeVisible();
  await expect(fofo(page).getByText('Exemplo simulado — a IA ainda não está configurada')).toHaveCount(0);
  await fofo(page).getByRole('button', { name: 'Outra pista' }).last().click();
  await expect(fofo(page).getByText(/Julgue por partes/)).toBeVisible();
  await expect(fofo(page)).not.toContainText(/Gabarito|é falsa|é verdadeira/);
  await page.screenshot({ path: `${SCREENS}/41-pista-certo-errado.png` });
});

test('ver a explicação antes de responder é primeiro contato, sem cobrança', async ({ page }) => {
  await openQuestions(page);
  await page.getByRole('button', { name: /Ver explicação antes de responder/ }).click();
  await expect(page.getByText('Em mapeamento inicial: primeiro contato com esta questão.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sei', exact: true })).toHaveCount(0);
});

test('aula completa alarga a coluna; resumo de exemplo não vai para o caderno; "Cai no meu edital?" responde pelo plano', async ({ page }) => {
  await openQuestions(page);
  const before = (await rightColumn(page).boundingBox())!.width;
  expect(before).toBeLessThan(560);

  await fofo(page).getByRole('button', { name: 'Aula completa' }).click();
  const warmup = fofo(page).getByRole('button', { name: 'Ver a aula agora' });
  if (await warmup.isVisible()) await warmup.click();
  await expect(fofo(page).getByText('🐹📚 Aula completa')).toBeVisible();
  await expect.poll(async () => (await rightColumn(page).boundingBox())!.width).toBeGreaterThanOrEqual(560);
  await expect(fofo(page).getByRole('button', { name: /Continuar \(Parte 2 de 2\)/ })).toBeVisible();

  await fofo(page).getByRole('button', { name: 'Salvar resumo de revisão' }).first().click();
  await expect(fofo(page).getByText('🐹📝 Resumo')).toBeVisible();
  await expect(fofo(page).getByRole('button', { name: 'Salvar no caderno' })).toBeDisabled();
  await page.screenshot({ path: `${SCREENS}/41-fofoia-aula-e-resumo.png` });

  await fofo(page).getByRole('button', { name: 'Cai no meu edital?' }).click();
  await fofo(page).getByLabel('Pergunte à FofoIA').fill('auditoria');
  await fofo(page).getByRole('button', { name: 'Enviar pergunta' }).click();
  await expect(fofo(page).getByText('🐹🧭 Cai no meu edital?')).toBeVisible();
  await expect(fofo(page).getByText(/^Sim: aparece em /)).toBeVisible();
});

test('a conversa com a FofoIA volta depois de recarregar a página (F5)', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('fofolab_onboarding_completed_v1', 'true'));
  await page.goto('/');
  const input = fofo(page).getByPlaceholder(/Pergunte sobre o tópico/);
  await input.fill('o que é service mesh?');
  await input.press('Enter');
  await expect(fofo(page).getByText('Exemplo simulado — a IA ainda não está configurada').first()).toBeVisible();

  await page.reload();
  await expect(fofo(page).getByText('o que é service mesh?')).toBeVisible();
  await expect(fofo(page).getByText('Exemplo simulado — a IA ainda não está configurada').first()).toBeVisible();
});
