import { expect, test, type Page } from '@playwright/test';

/**
 * Fluxos de ponta a ponta da Fatia 5.5, no navegador real (Edge), com o banco gravado de verdade
 * (IndexedDB) — cada teste começa num navegador limpo, com o exemplo inicial.
 * Capturas de tela vão para e2e/.screens/ (ignorado pelo git) para revisão visual.
 */

const SCREENS = 'e2e/.screens';

async function skipWizard(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('fofolab_onboarding_completed_v1', 'true'));
}

async function openPro(page: Page) {
  await page.getByRole('button', { name: 'Bancada Pro' }).click();
  await expect(page.getByRole('button', { name: /Questões & Estudo Reverso/ })).toBeVisible();
}

async function openCurriculum(page: Page) {
  await page.getByRole('button', { name: /Edital Verticalizado/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Organizar edital' });
  await expect(dialog.getByText('Organizar Edital, Disciplinas e Tópicos')).toBeVisible();
  return dialog;
}

/** O indicador do cabeçalho só mostra "Salvo" depois que a gravação em disco terminou. */
async function waitSaved(page: Page) {
  await expect(page.getByText('Salvo', { exact: true })).toBeVisible();
}

function minimalPdf(pages: number): Buffer {
  const kids = Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`).join(' ');
  const pageObjects = Array.from(
    { length: pages },
    (_, i) => `${i + 3} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj`
  ).join('\n');
  return Buffer.from(
    `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pages} >> endobj\n${pageObjects}\ntrailer << /Root 1 0 R >>\n%%EOF\n`,
    'latin1'
  );
}

test('primeiro acesso: o assistente grava horas e estratégia no plano e o Meu Dia usa isso', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Calibrar Meu Roteiro de Estudos')).toBeVisible();

  await page.getByText('🔥 Modo Pós-Edital (Edital Publicado)').click();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByText('2h por dia (14h/sem)').click();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await expect(page.getByText('⚡ Alta Rentabilidade (Pós-Edital / Tempo Escasso)')).toBeVisible();
  await page.getByRole('button', { name: /Gerar Meu Roteiro de Hoje/ }).click();

  await expect(page.getByText('Roteiro de Hoje • Modo Essencial')).toBeVisible();
  await expect(page.getByText('2h de estudo planejado para hoje')).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/01-meu-dia.png`, fullPage: true });

  // Recarregar logo após concluir o assistente não pode perder o plano (a gravação é imediata)
  await page.reload();
  await expect(page.getByText('2h de estudo planejado para hoje')).toBeVisible();
  await expect(page.getByText('Calibrar Meu Roteiro de Estudos')).toHaveCount(0);

  await openPro(page);
  await page.getByRole('button', { name: /Ciclo & Mapa de Calor/ }).click();
  await expect(page.getByText('Alta rentabilidade (maior peso na prova)').first()).toBeVisible();
  // O assistente já aplicou ao ciclo a distribuição da estratégia: nada a rebalancear
  await expect(page.getByText(/Rebalancear/)).toHaveCount(0);
});

test('tópicos colados do conteúdo programático ficam salvos depois de recarregar', async ({ page }) => {
  await skipWizard(page);
  await page.goto('/');
  await openPro(page);
  const dialog = await openCurriculum(page);

  await dialog.getByText(/Colar o conteúdo programático do edital/).click();
  await dialog
    .getByLabel('Conteúdo programático do edital')
    .fill('AUDITORIA: 9 Tópico importado no teste. 9.1 Subtópico importado no teste.');
  await dialog.getByRole('button', { name: 'Analisar' }).click();
  await dialog.getByRole('button', { name: /Adicionar 2 tópico/ }).click();
  await expect(dialog.getByText(/2 tópico\(s\) adicionado/)).toBeVisible();
  await expect(dialog.getByText('Subtópico importado no teste')).toBeVisible();

  await dialog.getByRole('button', { name: 'Fechar organização do edital' }).click();
  await waitSaved(page);

  await page.reload();
  await openPro(page);
  const reopened = await openCurriculum(page);
  await expect(reopened.getByText('Subtópico importado no teste')).toBeVisible();
});

test('importa questão colada da prova, responde e o diagnóstico coerente fica registrado', async ({ page }) => {
  await skipWizard(page);
  await page.goto('/');
  await openPro(page);
  await page.screenshot({ path: `${SCREENS}/02-bancada-pro.png` });

  await page.getByRole('button', { name: 'Importar Questões' }).first().click();
  await page.getByLabel('Texto das questões').fill(`1. (FGV/CGU/2025) [tópico 1.3] Enunciado E2E sobre amostragem em auditoria: qual afirmação está correta?
A) A amostragem elimina o risco de detecção.
B) A amostragem estatística permite medir o risco de amostragem.
C) Amostragem dispensa julgamento profissional.
Gabarito: B`);
  await page.getByRole('button', { name: 'Analisar' }).click();
  await expect(page.getByText(/questão\(ões\) prontas/)).toContainText('1');
  await page.getByRole('button', { name: /Importar 1 questão/ }).click();
  await expect(page.getByText(/1 importada/)).toBeVisible();
  await page.getByRole('button', { name: 'Fechar importação' }).click();

  await page.getByRole('button', { name: /1\.3\s*Amostragem em Auditoria/ }).click();
  await expect(page.getByText(/Enunciado E2E sobre amostragem/)).toBeVisible();

  await page.getByRole('button', { name: /^A\) A amostragem elimina/ }).click();
  await expect(page.getByText(/Gabarito oficial: Letra B/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Dominei/ })).toBeDisabled();
  await page.getByRole('button', { name: /1º Contato \/ Lacuna/ }).click();
  await expect(page.getByText(/registrado! Domínio/)).toBeVisible();
  await expect(page.getByText('Esta questão ainda não tem explicação.')).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/03-questao-importada.png` });

  await page.reload();
  await openPro(page);
  await page.getByRole('button', { name: /Ciclo & Mapa de Calor/ }).click();
  await expect(page.getByText(/Questões: 1(?!\d)/)).toHaveCount(1);
  await page.screenshot({ path: `${SCREENS}/04-ciclo.png`, fullPage: true });
});

test('excluir e restaurar o exemplo pedem confirmação; a cópia automática permite desfazer', async ({ page }) => {
  await skipWizard(page);
  await page.goto('/');
  await openPro(page);
  const dialog = await openCurriculum(page);
  const confirmDialog = page.getByRole('alertdialog');

  // Excluir disciplina: a confirmação mostra o que vai junto, e cancelar não apaga nada
  await dialog.getByRole('button', { name: /2\. Disciplinas/ }).click();
  const contab = dialog.locator('div.rounded-xl', { hasText: 'Contabilidade Pública (CASP)' }).last();
  await contab.getByTitle('Excluir disciplina').click();
  await expect(confirmDialog).toContainText('tópico(s)');
  await expect(confirmDialog).toContainText('cópia automática');
  await confirmDialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog.getByText('Contabilidade Pública (CASP)').first()).toBeVisible();

  // Plano pessoal que deve sumir ao restaurar o exemplo e voltar ao restaurar a cópia
  await dialog.getByRole('button', { name: /1\. Planos/ }).click();
  await dialog.getByPlaceholder('Ex: TCU — Auditor Federal de Controle Externo').fill('Plano Pessoal E2E');
  await dialog.getByRole('button', { name: /Criar Plano de Estudo/ }).click();
  // O nome aparece na lista e no cabeçalho "Plano ativo"
  await expect(dialog.getByText('Plano Pessoal E2E').first()).toBeVisible();

  await dialog.getByRole('button', { name: /4\. Backup/ }).click();
  await page.screenshot({ path: `${SCREENS}/05-backup.png` });
  await dialog.getByRole('button', { name: /Restaurar Exemplo Inicial/ }).click();
  await confirmDialog.getByRole('button', { name: 'Cancelar' }).click();
  await dialog.getByRole('button', { name: /1\. Planos/ }).click();
  await expect(dialog.getByText('Plano Pessoal E2E').first()).toBeVisible();

  await dialog.getByRole('button', { name: /4\. Backup/ }).click();
  await dialog.getByRole('button', { name: /Restaurar Exemplo Inicial/ }).click();
  await confirmDialog.getByRole('button', { name: 'Restaurar exemplo' }).click();
  await expect(dialog.getByText(/Exemplo inicial restaurado/)).toBeVisible();
  const copyRow = dialog.locator('div.rounded-lg', { hasText: 'Antes de restaurar o exemplo inicial' });
  await expect(copyRow).toBeVisible();

  await dialog.getByRole('button', { name: /1\. Planos/ }).click();
  await expect(dialog.getByText('Plano Pessoal E2E')).toHaveCount(0);

  await dialog.getByRole('button', { name: /4\. Backup/ }).click();
  await copyRow.getByRole('button', { name: 'Restaurar' }).click();
  await confirmDialog.getByRole('button', { name: 'Restaurar cópia' }).click();
  await expect(dialog.getByText(/Cópia restaurada com sucesso/)).toBeVisible();
  await dialog.getByRole('button', { name: /1\. Planos/ }).click();
  await expect(dialog.getByText('Plano Pessoal E2E').first()).toBeVisible();
});

test('lê PDF em tela grande com o caderno ao lado, e a largura das colunas fica salva', async ({ page }) => {
  await skipWizard(page);
  await page.goto('/');
  await openPro(page);

  await page.getByRole('button', { name: /Caderno & PDF/ }).click();
  await page.getByRole('button', { name: /^PDF/ }).click();
  await page
    .getByLabel('Escolher arquivo PDF')
    .first()
    .setInputFiles({ name: 'material-teste.pdf', mimeType: 'application/pdf', buffer: minimalPdf(3) });
  await expect(page.getByLabel('Total de páginas').first()).toHaveValue('3');

  await page.getByRole('button', { name: 'Ler em tela grande' }).click();
  const reader = page.getByTitle('Leitor de PDF em tela grande');
  await expect(reader).toBeVisible();
  // Para sobrar espaço ao PDF, a árvore de tópicos e o copiloto se recolhem
  await expect(page.getByRole('complementary', { name: 'Painel de Tópicos e Edital' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Painel Copiloto IA Contextual' })).toHaveCount(0);
  expect((await reader.boundingBox())!.width).toBeGreaterThan(800);

  const handle = page.getByRole('separator', { name: 'Largura do caderno e PDF' });
  await handle.focus();
  for (let i = 0; i < 5; i++) await handle.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '464');

  // Caderno com salvamento automático ao lado do PDF
  await page.getByRole('button', { name: /^Caderno$/ }).click();
  await page.getByLabel('Conteúdo do caderno do tópico').fill('Anotação feita lendo o PDF em tela grande');
  await expect(page.getByText('Salvo automaticamente')).toBeVisible();
  await waitSaved(page);
  await page.screenshot({ path: `${SCREENS}/06-leitura-tela-grande.png` });

  // Saindo da leitura, os painéis voltam como estavam
  await page.getByRole('button', { name: /Questões & Estudo Reverso/ }).click();
  await expect(page.getByRole('complementary', { name: 'Painel de Tópicos e Edital' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Painel Copiloto IA Contextual' })).toBeVisible();

  await page.reload();
  await openPro(page);
  await page.getByRole('button', { name: /Caderno & PDF/ }).click();
  await expect(page.getByRole('separator', { name: 'Largura do caderno e PDF' })).toHaveAttribute('aria-valuenow', '464');
  await expect(page.getByLabel('Conteúdo do caderno do tópico')).toHaveValue('Anotação feita lendo o PDF em tela grande');
});
