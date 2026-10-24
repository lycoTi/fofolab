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

/** Meu Dia e Bancada viraram uma tela só (spec 09): a bancada já abre com o roteiro na coluna. */
async function openPro(page: Page) {
  await expect(page.getByRole('button', { name: 'Questões', exact: true })).toBeVisible();
}

const routineColumn = (page: Page) => page.getByLabel('Roteiro de hoje');

async function openCurriculum(page: Page) {
  await routineColumn(page).getByRole('button', { name: 'Edital', exact: true }).click();
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
  await page.getByText('02:00 por dia (14:00 por semana)').click();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByRole('button', { name: /Continuar/ }).click();
  // Autoavaliação: pular mantém o nível que já estava em cada matéria
  await expect(page.getByText('Quanto você já sabe de cada matéria?')).toBeVisible();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await expect(page.getByText('⚡ Alta Rentabilidade (Pós-Edital / Tempo Escasso)')).toBeVisible();
  await page.getByRole('button', { name: /Gerar Meu Roteiro de Hoje/ }).click();

  // O roteiro de hoje fica na coluna da bancada, refeito com o perfil recém-calibrado
  await expect(routineColumn(page).getByText('Hoje · 02:00')).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/01-meu-dia.png`, fullPage: true });

  // Recarregar logo após concluir o assistente não pode perder o plano (a gravação é imediata)
  await page.reload();
  await expect(routineColumn(page).getByText('Hoje · 02:00')).toBeVisible();
  await expect(page.getByText('Calibrar Meu Roteiro de Estudos')).toHaveCount(0);

  await openPro(page);
  await page.getByRole('button', { name: 'Ciclo', exact: true }).click();
  await expect(page.getByText(/Alta rentabilidade \(maior peso na prova\)/).first()).toBeVisible();
  // O assistente já aplicou ao ciclo a distribuição da estratégia: nada a rebalancear
  await expect(page.getByText(/Sugestão para o próximo ciclo/)).toHaveCount(0);
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

  // A lista de disciplinas saiu da coluna (spec 09): o tópico fora do roteiro abre pelo Mapa de Calor
  await page.getByRole('button', { name: 'Mapa de Calor', exact: true }).click();
  await page.getByRole('button', { name: /^1\.3 Amostragem em Auditoria/ }).click();
  await page.getByRole('button', { name: /Estudar este tópico/ }).click();

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
  await expect(page.getByText(/Enunciado E2E sobre amostragem/)).toBeVisible();

  // Confiança antes das alternativas (spec 11); errar grava na hora como "Não sabia" e o "Por quê?" corrige
  await page.getByRole('button', { name: 'Acho que sei', exact: true }).click();
  await page.getByRole('button', { name: /^A\) A amostragem elimina/ }).click();
  await expect(page.getByText(/^Gabarito: B/)).toBeVisible();
  await expect(page.getByText(/Não sabia registrado\. Domínio do tópico/)).toBeVisible();
  await page.getByRole('button', { name: /Confundi com outra coisa/ }).click();
  await expect(page.getByText(/Confundi com outra coisa registrado/)).toBeVisible();
  await expect(page.getByText('Esta questão ainda não tem explicação.')).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/03-questao-importada.png` });

  // Recarregar só depois da gravação em disco: senão a tentativa recém-registrada pode não estar lá
  await waitSaved(page);
  await page.reload();
  await openPro(page);
  await page.getByRole('button', { name: 'Mapa de Calor', exact: true }).click();
  await page.getByRole('button', { name: /^1\.3 Amostragem em Auditoria/ }).click();
  await expect(page.getByRole('main').getByText(/1 questão(?!\w)/)).toBeVisible();
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
  // Trocar o banco inteiro não pode deixar a bancada "olhando" outro tópico sem o estudante ter pedido
  await expect(page.getByLabel('Roteiro de hoje')).not.toContainText('fora do roteiro');
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
  await expect(page.getByRole('complementary', { name: 'Coluna do roteiro' })).toHaveCSS('width', '44px');
  await expect(page.getByRole('region', { name: 'FofoIA' })).toBeHidden();

  await page.getByLabel('Escolher arquivo PDF').first().setInputFiles(TEST_PDF);
  await expect(page.getByText('Pagina 1 do material')).toBeVisible();
  const scroll = page.getByTestId('pdf-scroll');
  const normalWidth = (await scroll.boundingBox())!.width;

  const handle = page.getByRole('separator', { name: 'Largura do painel direito' });
  await handle.focus();
  for (let i = 0; i < 5; i++) await handle.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '464');
  await page.getByLabel('Conteúdo do caderno do tópico').fill('Anotação feita lendo o PDF');
  await expect(page.getByText('Salvo automaticamente')).toBeVisible();
  await waitSaved(page);

  await page.getByRole('button', { name: 'Maximizar leitura' }).click();
  await expect(page.getByRole('button', { name: 'Recalibrar perfil' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Questões', exact: true })).toBeHidden();
  // O caderno continua ao lado até ser escondido pelo botão do próprio leitor
  await expect(page.getByLabel('Conteúdo do caderno do tópico')).toBeVisible();
  await page.getByTitle('Mostrar ou esconder o caderno ao lado').click();
  await expect(page.getByLabel('Conteúdo do caderno do tópico')).toBeHidden();
  expect((await scroll.boundingBox())!.width).toBeGreaterThan(normalWidth + 300);
  await page.screenshot({ path: `${SCREENS}/07-leitura-maximizada.png` });

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Recalibrar perfil' })).toBeVisible();

  // Saindo da leitura, os painéis voltam como estavam
  await page.getByRole('button', { name: 'Questões', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Coluna do roteiro' })).not.toHaveCSS('width', '44px');
  await expect(page.getByRole('region', { name: 'FofoIA' })).toBeVisible();

  await page.reload();
  await openPro(page);
  await page.getByRole('tab', { name: 'Caderno' }).click();
  await expect(page.getByRole('separator', { name: 'Largura do painel direito' })).toHaveAttribute('aria-valuenow', '464');
  await expect(page.getByLabel('Conteúdo do caderno do tópico')).toHaveValue('Anotação feita lendo o PDF');
  // Fora da leitura, o painel lateral leva de volta ao PDF do tópico
  await expect(page.getByRole('button', { name: /Continuar leitura/ })).toBeVisible();
});

test('edital real em PDF vira o plano: cargo, prévia, autoavaliação e Meu Dia pelo edital', async ({ page }) => {
  await skipWizard(page);
  await page.goto('/');
  await openPro(page);

  const curriculum = await openCurriculum(page);
  await curriculum.getByRole('button', { name: 'Importar edital (PDF)' }).click();
  const importDialog = page.getByRole('dialog', { name: 'Importar edital' });
  await importDialog.getByLabel('Escolher PDF do edital').setInputFiles('e2e/fixtures/cgu-2026-affc-edital.pdf');

  // Quatro cargos no edital: é preciso escolher antes da prévia
  await importDialog.getByRole('combobox').selectOption({ label: 'Cargo 4: Tecnologia da Informação – Desenvolvimento de Sistemas' });
  await expect(importDialog.getByText('Matérias (13)')).toBeVisible();
  await expect(importDialog.getByLabel('Nome do plano')).toHaveValue('CGU 2026 — Tecnologia da Informação – Desenvolvimento de Sistemas');
  await expect(importDialog.getByLabel('Data da prova')).toHaveValue('2026-12-13');
  await expect(importDialog.getByLabel('Último dia de inscrição')).toHaveValue('2026-11-04');
  await expect(importDialog.getByLabel('Nota mínima da P3')).toHaveValue('54');
  await expect(importDialog.getByLabel('Peso de Arquitetura e Integração de Sistemas')).toHaveValue('2.25');
  await page.screenshot({ path: `${SCREENS}/08-previa-do-edital.png` });
  await importDialog.getByRole('button', { name: 'Criar meu plano' }).click();

  // O assistente abre nas horas e segue para a autoavaliação do plano novo
  await expect(page.getByText('Passo 2 de 5')).toBeVisible();
  await page.getByText('03:00 por dia (21:00 por semana)').click();
  await page.getByRole('button', { name: /Continuar/ }).click();
  // O plano novo já vem escolhido no passo "Qual edital você quer focar agora?"
  await expect(page.getByRole('button', { name: /\[CGU\] CGU 2026 — Tecnologia da Informação/ })).toBeVisible();
  await page.getByRole('button', { name: /Continuar/ }).click();

  await expect(page.getByText('Quanto você já sabe de cada matéria?')).toBeVisible();
  const levelOf = (subject: string) => page.getByRole('radiogroup', { name: `Quanto você sabe de ${subject}` });
  await levelOf('Arquitetura e Integração de Sistemas').getByRole('radio', { name: 'Nunca vi' }).click();
  await levelOf('Fundamentos de Auditoria Governamental e Atuação Integrada da CGU').getByRole('radio', { name: 'Domino' }).click();
  await levelOf('Engenharia de Software e Programação').getByRole('radio', { name: 'Sei bem' }).click();
  // Ajuste fino por tópico dentro de Engenharia de Software
  await page.getByRole('dialog').getByRole('button', { name: 'Engenharia de Software e Programação', exact: true }).click();
  await levelOf('Concorrência e processamento').getByRole('radio', { name: 'Nunca vi' }).click();
  await page.screenshot({ path: `${SCREENS}/09-autoavaliacao.png` });
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByRole('button', { name: /Gerar Meu Roteiro de Hoje/ }).click();

  // O Meu Dia passa a mandar estudar pelo edital: primeiro a matéria fraca que vale o dobro
  const firstBlock = routineColumn(page).getByText('Arquitetura e Integração de Sistemas').first();
  await expect(firstBlock).toBeVisible();

  // Árvore do grupo: sem bloco rodando, abrir um tópico irmão é navegar à vontade (sem faixa de olhada)
  const blockTopic = routineColumn(page).getByRole('button', { name: /\(tópico do bloco\)$/ });
  await expect(blockTopic).toBeVisible();
  const tree = routineColumn(page).getByRole('list', { name: 'Tópicos do grupo' });
  const siblingButton = tree.locator('button:not([aria-label$="(tópico do bloco)"])').first();
  await siblingButton.click();
  await expect(siblingButton).toHaveAttribute('aria-current', 'true');
  await expect(routineColumn(page)).not.toContainText('não conta para o bloco de hoje');
  await blockTopic.click();
  await expect(routineColumn(page)).not.toContainText('não conta para o bloco de hoje');
  await page.screenshot({ path: `${SCREENS}/10-meu-dia-do-edital.png`, fullPage: true });

  // Recarregar não perde o plano nem a autoavaliação
  await waitSaved(page);
  await page.reload();
  await expect(page.getByText(/CGU 2026 — Tecnologia da Informação/).first()).toBeVisible();
  await page.locator('header').getByRole('button', { name: 'Recalibrar perfil' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /Continuar/ }).click();
  await expect(
    levelOf('Arquitetura e Integração de Sistemas').getByRole('radio', { name: 'Nunca vi' })
  ).toHaveAttribute('aria-checked', 'true');
});

test('bloco em pomodoros grava o estudo; ciclo por prova em HH:mm; mapa de calor em grade', async ({ page }) => {
  await page.clock.install();
  await skipWizard(page);
  await page.goto('/');

  // FofoDoro (spec 10): fica no bloco atual da coluna; pomodoros de 30 min e play
  await routineColumn(page).getByRole('radio', { name: '00:30' }).click();
  await routineColumn(page).getByRole('button', { name: 'Iniciar bloco' }).click();
  const fofodoro = routineColumn(page).getByRole('group', { name: 'FofoDoro' });
  await expect(fofodoro.getByRole('img', { name: /^Foco:/ })).toBeVisible();
  await expect(fofodoro.getByText(/^Pomodoro 1 de \d+$/)).toBeVisible();
  // O relógio do cabeçalho mostra o mesmo bloco
  await expect(page.getByLabel('Relógio do bloco')).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/11-bloco-em-pomodoros.png` });

  // Salto direto, como uma janela minimizada: o bloco se acerta pelo horário real
  await page.clock.fastForward(30 * 60_000);
  await page.clock.runFor(1_000);
  await expect(fofodoro.getByRole('img', { name: /^Pausa:/ })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Parabéns' })).toContainText('Parabéns: 30 minutos de foco!');
  await waitSaved(page);

  // Ciclo: a semana mostra os 30 min gravados, tudo em HH:mm; a coluna conta o tempo no bloco
  await expect(routineColumn(page)).toContainText('00:30 de');
  await page.getByRole('button', { name: 'Ciclo', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Semana de estudo' })).toContainText('00:30');
  await expect(page.locator('main')).not.toContainText(/\d+ ?min\b|\d+\.\d+h\b/);
  await page.screenshot({ path: `${SCREENS}/12-ciclo-por-prova.png`, fullPage: true });

  // Mapa de Calor: grade com um quadradinho por tópico; clicar fixa o detalhe e leva à bancada
  await page.getByRole('button', { name: 'Mapa de Calor', exact: true }).click();
  await expect(page.getByLabel('Legenda do calor')).toContainText('Muito quente');
  const squares = page.getByRole('main').getByRole('button', { name: /: (Frio|Morno|Atenção|Quente|Muito quente)$/ });
  expect(await squares.count()).toBeGreaterThan(5);
  await squares.first().click();
  await page.screenshot({ path: `${SCREENS}/13-mapa-de-calor.png`, fullPage: true });
  await page.getByRole('button', { name: /Estudar este tópico/ }).click();
  await expect(page.getByRole('button', { name: 'Questões', exact: true })).toBeVisible();
});
