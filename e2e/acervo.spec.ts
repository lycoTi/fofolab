import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { importCguEdital, openApp } from './helpers';

/**
 * Acervo da Cebraspe no app (specs 12c e 12d): sincroniza o pacote do minerador automaticamente em `/__acervo/*` sem
 * precisar clicar em importar, mostra os itens nos tópicos certos do plano da CGU, filtra por Inéditas / Todas,
 * responde, desfaz ligação e tira item — e tudo sobrevive a recarregar.
 */

const SCREENS = 'e2e/.screens';
const TOPIC_A = /^1\.1 Monolitos, microsserviços/;
const TOPIC_B = /^1\.2 Distribuição de responsabilidades/;
const TOPIC_C = /^1\.3 Desempenho, escalabilidade/;
const ACERVO_PEQUENO = readFileSync('e2e/fixtures/acervo-pequeno.json', 'utf8');

async function openTopicQuestions(page: Page, topic: RegExp) {
  await page.getByRole('button', { name: 'Mapa de Calor', exact: true }).click();
  await page.getByRole('main').getByRole('button', { name: topic }).click();
  await page.getByRole('button', { name: /Estudar este tópico/ }).click();
  await page.getByRole('button', { name: 'Questões', exact: true }).click();
}

const position = (page: Page) => page.getByRole('main').getByText(/^Questão \d+ de \d+$/);

test('acervo da Cebraspe: sincroniza sozinho, filtra inéditas e todas, responde, desliga e tira item, e tudo continua depois de recarregar', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('/__acervo/index.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        formato: 'fofolab-acervo-index',
        versao: 1,
        pacotes: [
          {
            id: 'cebraspe',
            banca: 'Cebraspe',
            arquivo: 'cebraspe.json',
            vocabVersion: 1,
            itensComAssunto: 4,
            atualizadoEm: '2026-10-27T12:00:00.000Z',
          },
        ],
      }),
    })
  );
  await page.route('/__acervo/cebraspe.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: ACERVO_PEQUENO })
  );

  await openApp(page);
  await importCguEdital(page);

  // 1. Sem clicar em "Importar Questões", o Tópico A já abre com os itens 1 e 2 (o 4, com figura, não aparece)
  const main = page.getByRole('main');
  await openTopicQuestions(page, TOPIC_A);
  await expect(position(page)).toHaveText('Questão 1 de 2');
  await expect(main).toContainText('Do acervo: Arquiteturas de aplicações › Monolitos, microsserviços e arquiteturas orientadas a eventos');
  await expect(main).toContainText('Cebraspe · TESTE 2024 · item 1');
  await page.screenshot({ path: `${SCREENS}/19-acervo-importado.png` });

  // 2. Responder na aba de Inéditas mantém a questão na tela nesta sessão para ler a correção
  await main.getByRole('button', { name: 'Sei', exact: true }).click();
  await main.getByRole('button', { name: 'Certo', exact: true }).click();
  await expect(main).toContainText('Você acertou.');
  await expect(position(page)).toHaveText('Questão 1 de 2');
  await page.screenshot({ path: `${SCREENS}/20-acervo-respondido.png`, fullPage: true });

  // 3. Tópico C: vazio, e "Ver do tópico 1 · Arquiteturas de aplicações" traz as inéditas de A e B (2 inéditas; 3 em Todas)
  await openTopicQuestions(page, TOPIC_C);
  await expect(main).toContainText('Ainda não há questões classificadas neste tópico.');
  await main.getByRole('button', { name: 'Ver do tópico 1 · Arquiteturas de aplicações' }).click();
  await expect(position(page)).toHaveText('Questão 1 de 2');
  await main.getByRole('button', { name: 'Filtros e busca' }).click();
  await main.getByLabel('Filtrar por situação').selectOption('ALL');
  await expect(position(page)).toHaveText('Questão 1 de 3');
  await main.getByLabel('Filtrar por situação').selectOption('UNSOLVED');

  // 4. Tópico B: item 3 (incerto) e item 2; "Não é deste tópico" tira só o 2 daqui
  await openTopicQuestions(page, TOPIC_B);
  await expect(position(page)).toHaveText('Questão 1 de 2');
  await expect(main).toContainText('Classificação incerta');
  await main.getByRole('button', { name: 'Próxima questão' }).click();
  await expect(main).toContainText('Cebraspe · TESTE 2023 · item 2');
  await main.getByRole('button', { name: 'Não é deste tópico' }).click();
  await expect(position(page)).toHaveText('Questão 1 de 1');
  await expect(main.getByRole('button', { name: 'Tirados deste tópico (1)' })).toBeVisible();

  // 5. Tópico A: ao voltar, Inéditas mostra só o item 2 (1 de 1) e Todas mostra os 2 com selo "Já respondida"; desligar esvazia o tópico
  await openTopicQuestions(page, TOPIC_A);
  await expect(position(page)).toHaveText('Questão 1 de 1');
  await main.getByRole('button', { name: 'Filtros e busca' }).click();
  await main.getByLabel('Filtrar por situação').selectOption('ALL');
  await expect(position(page)).toHaveText('Questão 1 de 2');
  await expect(main).toContainText('Já respondida · Acertou');
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
