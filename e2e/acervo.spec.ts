import { expect, test, type Page } from '@playwright/test';
import { importCguEdital, openApp } from './helpers';

/**
 * Acervo da Cebraspe no app (spec 12c): importar o pacote do minerador, ver os itens nos tópicos certos do plano da CGU,
 * responder, desfazer ligação e tirar item — e tudo sobrevive a recarregar. A fixture `acervo-pequeno.json` tem textos
 * escritos à mão (nada de prova) e os caminhos reais do vocabulário para o grupo "1 Arquiteturas de aplicações":
 * A = 1.1 Monolitos… (itens 1 e 2), B = 1.2 Distribuição… (itens 2 e 3, o 3 incerto), C = 1.3 Desempenho… (nenhum);
 * o item 4 depende de figura e fica de fora.
 */

const SCREENS = 'e2e/.screens';
const TOPIC_A = /^1\.1 Monolitos, microsserviços/;
const TOPIC_B = /^1\.2 Distribuição de responsabilidades/;
const TOPIC_C = /^1\.3 Desempenho, escalabilidade/;

async function openTopicQuestions(page: Page, topic: RegExp) {
  await page.getByRole('button', { name: 'Mapa de Calor', exact: true }).click();
  await page.getByRole('main').getByRole('button', { name: topic }).click();
  await page.getByRole('button', { name: /Estudar este tópico/ }).click();
  await page.getByRole('button', { name: 'Questões', exact: true }).click();
}

const position = (page: Page) => page.getByRole('main').getByText(/^Questão \d+ de \d+$/);

test('acervo da Cebraspe: importar, responder, desligar e tirar item, e tudo continua depois de recarregar', async ({ page }) => {
  test.setTimeout(120_000);
  await openApp(page);
  await importCguEdital(page);

  // 1. Importar o pacote pela tela de importação de questões
  await openTopicQuestions(page, TOPIC_A);
  await page.getByRole('button', { name: 'Importar Questões' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Importar questões' });
  await dialog.getByRole('button', { name: 'Acervo da Cebraspe (pacote do minerador)' }).click();
  await dialog.getByLabel('Escolher o arquivo do pacote').setInputFiles('e2e/fixtures/acervo-pequeno.json');
  await dialog.getByRole('button', { name: 'Importar acervo' }).click();
  await expect(dialog.getByRole('status')).toContainText('4 questões com assunto');
  await expect(dialog.getByRole('status')).toContainText('1 ficou de fora (figura ou fórmula que não dá para ler).');
  await page.screenshot({ path: `${SCREENS}/19-acervo-importado.png` });
  await dialog.getByRole('button', { name: 'Fechar importação' }).click();

  // 2. Tópico A: itens 1 e 2 (o 4, com figura, não aparece), com a procedência
  const main = page.getByRole('main');
  await expect(position(page)).toHaveText('Questão 1 de 2');
  await expect(main).toContainText('Do acervo: Arquiteturas de aplicações › Monolitos, microsserviços e arquiteturas orientadas a eventos');
  await expect(main).toContainText('Cebraspe · TESTE 2024 · item 1');
  await main.getByRole('button', { name: 'Sei', exact: true }).click();
  await main.getByRole('button', { name: 'Certo', exact: true }).click();
  await expect(main).toContainText('Você acertou.');
  await page.screenshot({ path: `${SCREENS}/20-acervo-respondido.png`, fullPage: true });

  // 3. Tópico C: vazio, e "Ver as do grupo" traz os itens de A e B (o 2, que está nos dois, uma vez só)
  await openTopicQuestions(page, TOPIC_C);
  await expect(main).toContainText('Ainda não há questões classificadas neste tópico.');
  await main.getByRole('button', { name: 'Ver as do grupo 1' }).click();
  await expect(position(page)).toHaveText('Questão 1 de 3');

  // 4. Tópico B: item 3 (incerto) e item 2; "Não é deste tópico" tira só o 2 daqui
  await openTopicQuestions(page, TOPIC_B);
  await expect(position(page)).toHaveText('Questão 1 de 2');
  await expect(main).toContainText('Classificação incerta');
  await main.getByRole('button', { name: 'Próxima questão' }).click();
  await expect(main).toContainText('Cebraspe · TESTE 2023 · item 2');
  await main.getByRole('button', { name: 'Não é deste tópico' }).click();
  await expect(position(page)).toHaveText('Questão 1 de 1');
  await expect(main.getByRole('button', { name: 'Tirados deste tópico (1)' })).toBeVisible();

  // 5. Tópico A: o item 2 continua; "Desligar este assunto" esvazia o tópico
  await openTopicQuestions(page, TOPIC_A);
  await expect(position(page)).toHaveText('Questão 1 de 2');
  await main.getByRole('button', { name: 'Desligar este assunto' }).click();
  await expect(main).toContainText('Ainda não há questões classificadas neste tópico.');

  // 6. Recarregar: a tentativa, a ligação desligada e o item tirado continuam
  await expect(page.getByText('Salvo', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Mapa de Calor', exact: true }).click();
  await main.getByRole('button', { name: TOPIC_A }).click();
  await expect(main).toContainText('1 questão');
  await openTopicQuestions(page, TOPIC_A);
  await expect(main).toContainText('Ainda não há questões classificadas neste tópico.');
  await openTopicQuestions(page, TOPIC_B);
  await expect(position(page)).toHaveText('Questão 1 de 1');
  await expect(main).toContainText('Cebraspe · TESTE 2024 · item 3');
  await expect(main.getByRole('button', { name: 'Tirados deste tópico (1)' })).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/21-acervo-depois-de-recarregar.png`, fullPage: true });
});
