import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeDuplicates, readConcurso, removeConcurso, writeConcurso } from './acervoStore';
import { GabaritoInvalido, parseAnswerKey } from './answerKey';
import { assembleExam } from './assembleExam';
import { eventDetailUrl, fileUrl, isSafeIdentifier, parseEventDetail } from './cebraspeApi';
import { selectExamPairs } from './examFiles';
import { readPdfLines } from './pdfLines';
import { FalhaDeRede, type PoliteClient } from './politeClient';
import { emptyReport, type RunReport } from './report';
import { segmentMultipleChoice } from './segmentMultipleChoice';
import { segmentTrueFalse } from './segmentTrueFalse';
import type { AcervoItem, CebraspeEventDetail, CebraspeFile, ExamOutcome, ExamPair, PdfLine } from './types';

/**
 * Uma rodada do minerador (spec 12 §6.3) sobre a lista de concursos do lote. Falha de rede num caderno vai para o
 * relatório e a rodada segue; PDF ilegível ou gabarito fora do padrão vão para a quarentena; formato inesperado da API
 * (`FormatoCebraspeMudou`) interrompe tudo.
 */
const MULTIPLE_CHOICE_HEADER = /^Quest[ãa]o\s+\d{1,3}$/i;
/** Com 3+ títulos "Questão N", a prova é de múltipla escolha; senão, Certo/Errado. */
function segment(lines: PdfLine[]) {
  const headers = lines.filter((l) => MULTIPLE_CHOICE_HEADER.test(l.text)).length;
  return headers >= 3 ? segmentMultipleChoice(lines) : segmentTrueFalse(lines);
}

/** O nome do arquivo vem da API (entrada não confiável): no caminho do cache, só caracteres seguros. */
export const safeFileName = (nome: string) => nome.replace(/[^\w.\- ]/g, '_').replace(/^\.+/, '_');

async function fetchFile(client: PoliteClient, cacheDir: string, detail: CebraspeEventDetail, file: CebraspeFile, report: RunReport) {
  const result = await client.download(
    fileUrl(detail.tipo, detail.identificador, file.nomeArquivo),
    join(cacheDir, detail.identificador, safeFileName(file.nomeArquivo))
  );
  if (result.fromCache) report.doCache += 1;
  else report.baixados += 1;
  return new Uint8Array(readFileSync(result.path));
}

/** Lê e monta um caderno; PDF que o leitor não abre ou gabarito fora do padrão viram quarentena, não erro da rodada. */
async function extractExam(provaBytes: Uint8Array, gabaritoBytes: Uint8Array, origem: Parameters<typeof assembleExam>[2]): Promise<ExamOutcome> {
  try {
    const items = segment(await readPdfLines(provaBytes));
    const key = parseAnswerKey(await readPdfLines(gabaritoBytes, { singleColumn: true }));
    return assembleExam(items, key, origem);
  } catch (err) {
    if (err instanceof GabaritoInvalido) return { kind: 'quarentena', motivo: err.message };
    return { kind: 'quarentena', motivo: `PDF ilegível: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Regrava o concurso: dos itens que já estavam no acervo saem só as procedências dos cadernos processados agora (ok ou
 * quarentena) — um item que também veio de um caderno que hoje falhou por rede continua, com essa procedência. Caderno
 * em quarentena perde os itens antigos (podiam estar errados), também quando nenhum caderno deu certo.
 */
function rewriteConcurso(dir: string, detail: CebraspeEventDetail, processed: Set<string>, novos: AcervoItem[]): void {
  const mantidos = readConcurso(dir, detail.identificador)
    .map((item) => ({ ...item, procedencias: item.procedencias.filter((p) => !processed.has(p.caderno)) }))
    .filter((item) => item.procedencias.length > 0);
  const itens = mergeDuplicates([...mantidos, ...novos]);
  if (itens.length === 0) {
    removeConcurso(dir, detail.identificador);
    return;
  }
  writeConcurso(dir, { identificador: detail.identificador, concurso: detail.nome, ano: detail.ano, areas: detail.areas }, itens);
}

export async function runMinerador(opts: { client: PoliteClient; acervoDir: string; cacheDir: string; lote: string[] }): Promise<RunReport> {
  const report = emptyReport();
  const concursosDir = join(opts.acervoDir, 'cebraspe');

  for (const identificador of opts.lote) {
    // O lote é editado à mão e o identificador vira nome de arquivo: nada de "../" ou ":"
    if (!isSafeIdentifier(identificador)) {
      report.falhas.push({ identificador, erro: 'identificador inválido no lote (use só letras, números, "_" e "-")' });
      continue;
    }
    let detail: CebraspeEventDetail;
    try {
      detail = parseEventDetail(await opts.client.getJson(eventDetailUrl(identificador)));
    } catch (err) {
      if (!(err instanceof FalhaDeRede)) throw err;
      report.falhas.push({ identificador, erro: err.message });
      continue;
    }

    const selection = selectExamPairs(detail);
    report.pendentes.push(...selection.pendentes.map((c) => `${identificador}/${c}`));
    for (const justificativa of selection.justificativas) {
      try {
        await fetchFile(opts.client, opts.cacheDir, detail, justificativa, report);
      } catch (err) {
        if (!(err instanceof FalhaDeRede)) throw err;
        report.falhas.push({ identificador: `${identificador}/${justificativa.nomeArquivo}`, erro: err.message });
      }
    }

    const novos: AcervoItem[] = [];
    const processed = new Set<string>();
    for (const pair of selection.pares) {
      const outcome = await processPair(opts, detail, pair, report);
      if (!outcome) continue;
      processed.add(pair.caderno);
      if (outcome.kind === 'quarentena') {
        report.quarentena.push({ caderno: `${identificador}/${pair.caderno}`, motivo: outcome.motivo });
        continue;
      }
      report.provas += 1;
      novos.push(...outcome.itens);
    }

    if (processed.size === 0) continue;
    rewriteConcurso(concursosDir, detail, processed, novos);
    if (novos.length === 0) continue;
    report.concursos += 1;
    report.itens += novos.length;
    report.anulados += novos.filter((i) => i.anulado).length;
    report.comCodigo += novos.filter((i) => i.temCodigo).length;
    report.comFigura += novos.filter((i) => i.dependeDeFigura).length;
  }
  return report;
}

/** Baixa prova e gabarito e extrai; `null` quando a rede falhou (o caderno não conta como processado). */
async function processPair(
  opts: { client: PoliteClient; cacheDir: string },
  detail: CebraspeEventDetail,
  pair: ExamPair,
  report: RunReport
): Promise<ExamOutcome | null> {
  let provaBytes: Uint8Array;
  let gabaritoBytes: Uint8Array;
  try {
    provaBytes = await fetchFile(opts.client, opts.cacheDir, detail, pair.prova, report);
    gabaritoBytes = await fetchFile(opts.client, opts.cacheDir, detail, pair.gabarito, report);
  } catch (err) {
    if (!(err instanceof FalhaDeRede)) throw err;
    report.falhas.push({ identificador: `${detail.identificador}/${pair.caderno}`, erro: err.message });
    return null;
  }
  return extractExam(provaBytes, gabaritoBytes, {
    banca: 'Cebraspe',
    identificador: detail.identificador,
    concurso: detail.nome,
    ano: detail.ano,
    prova: pair.prova.descricao,
    caderno: pair.caderno,
  });
}
