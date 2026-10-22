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

/** PDF válido (com tabela xref) e uma linha de texto por página: "Pagina N do material". */
function textPdf(pages: number): Buffer {
  const objects: string[] = [];
  const pageIds = Array.from({ length: pages }, (_, i) => 4 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pageIds.forEach((id, i) => {
    const stream = `BT /F1 28 Tf 72 700 Td (Pagina ${i + 1} do material) Tj ET`;
    objects[id] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`;
    objects[id + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let n = 1; n < objects.length; n++) {
    offsets.push(out.length);
    out += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xrefOffset = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
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

const TEST_PDF = { name: 'material-teste.pdf', mimeType: 'application/pdf', buffer: textPdf(6) };

async function openReaderTab(page: Page) {
  await page.getByRole('button', { name: /Leitura de PDF/ }).click();
  await expect(page.getByRole('region', { name: 'Leitura de PDF' })).toBeVisible();
}

test('leitor de PDF: acha o total de páginas, segue a página na tela e marca as lidas sozinho', async ({ page }) => {
  // Relógio controlado pelo teste, para "esperar" os 15 s sem esperar de verdade
  await page.clock.install();
  await skipWizard(page);
  await page.goto('/');
  await openPro(page);
  await openReaderTab(page);

  // Um leitor só: o painel lateral não tem mais a aba "PDF"
  await expect(page.getByRole('button', { name: /^PDF/ })).toHaveCount(0);

  await page.getByLabel('Escolher arquivo PDF').first().setInputFiles(TEST_PDF);
  const progress = page.getByRole('progressbar', { name: 'Páginas lidas' });
  await expect(progress).toHaveAttribute('aria-valuemax', '6');
  await expect(page.getByText('Pagina 1 do material')).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '0');

  await page.clock.runFor(16_000);
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(page.getByRole('button', { name: 'Página lida' })).toHaveAttribute('aria-pressed', 'true');

  const pageInput = page.getByLabel('Ir para a página');
  await pageInput.fill('4');
  await pageInput.press('Enter');
  await expect(page.getByText('Pagina 4 do material')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Marcar lida' })).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/06-leitor-pdf.png` });

  // A página onde parou é gravada; ao reabrir o arquivo, volta nela com o progresso
  await page.clock.runFor(2_000);
  await waitSaved(page);
  await page.reload();
  await openPro(page);
  await openReaderTab(page);
  await expect(page.getByText(/Você parou na página 4/)).toBeVisible();
  await page.getByLabel('Escolher arquivo PDF').first().setInputFiles(TEST_PDF);
  await expect(page.getByText('Pagina 4 do material')).toBeInViewport();
  await expect(page.getByLabel('Ir para a página')).toHaveValue('4');
  await expect(progress).toHaveAttribute('aria-valuenow', '1');

  // Desmarcar à mão vale (e o leitor não remarca sozinho)
  await pageInput.fill('1');
  await pageInput.press('Enter');
  await page.getByRole('button', { name: 'Página lida' }).click();
  await page.clock.runFor(30_000);
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
});

test('leitura maximizada esconde menus e painéis, Esc restaura, e a largura do caderno fica salva', async ({ page }) => {
  await skipWizard(page);
  await page.goto('/');
  await openPro(page);
  await openReaderTab(page);
  // Para sobrar espaço ao PDF, a árvore de tópicos e o copiloto se recolhem
  await expect(page.getByRole('complementary', { name: 'Painel de Tópicos e Edital' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Painel Copiloto IA Contextual' })).toHaveCount(0);

  await page.getByLabel('Escolher arquivo PDF').first().setInputFiles(TEST_PDF);
  await expect(page.getByText('Pagina 1 do material')).toBeVisible();
  const scroll = page.getByTestId('pdf-scroll');
  const normalWidth = (await scroll.boundingBox())!.width;

  const handle = page.getByRole('separator', { name: 'Largura do caderno' });
  await handle.focus();
  for (let i = 0; i < 5; i++) await handle.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '464');
  await page.getByLabel('Conteúdo do caderno do tópico').fill('Anotação feita lendo o PDF');
  await expect(page.getByText('Salvo automaticamente')).toBeVisible();
  await waitSaved(page);

  await page.getByRole('button', { name: 'Maximizar leitura' }).click();
  await expect(page.getByRole('button', { name: 'Bancada Pro' })).toBeHidden();
  await expect(page.getByRole('button', { name: /Questões & Estudo Reverso/ })).toBeHidden();
  // O caderno continua ao lado até ser escondido pelo botão do próprio leitor
  await expect(page.getByLabel('Conteúdo do caderno do tópico')).toBeVisible();
  await page.getByTitle('Mostrar ou esconder o caderno ao lado').click();
  await expect(page.getByLabel('Conteúdo do caderno do tópico')).toHaveCount(0);
  expect((await scroll.boundingBox())!.width).toBeGreaterThan(normalWidth + 300);
  await page.screenshot({ path: `${SCREENS}/07-leitura-maximizada.png` });

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Bancada Pro' })).toBeVisible();

  // Saindo da leitura, os painéis voltam como estavam
  await page.getByRole('button', { name: /Questões & Estudo Reverso/ }).click();
  await expect(page.getByRole('complementary', { name: 'Painel de Tópicos e Edital' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Painel Copiloto IA Contextual' })).toBeVisible();

  await page.reload();
  await openPro(page);
  await page.locator('header').getByRole('button', { name: 'Caderno', exact: true }).click();
  await expect(page.getByRole('separator', { name: 'Largura do caderno' })).toHaveAttribute('aria-valuenow', '464');
  await expect(page.getByLabel('Conteúdo do caderno do tópico')).toHaveValue('Anotação feita lendo o PDF');
  // Fora da leitura, o painel lateral leva de volta ao PDF do tópico
  await expect(page.getByRole('button', { name: /Continuar leitura/ })).toBeVisible();
});
