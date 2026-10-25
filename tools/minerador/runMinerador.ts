import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeDuplicates, readConcurso, writeConcurso } from './acervoStore';
import { parseAnswerKey } from './answerKey';
import { assembleExam } from './assembleExam';
import { eventDetailUrl, fileUrl, parseEventDetail } from './cebraspeApi';
import { selectExamPairs } from './examFiles';
import { readPdfLines } from './pdfLines';
import { FalhaDeRede, type PoliteClient } from './politeClient';
import { emptyReport, type RunReport } from './report';
import { segmentMultipleChoice } from './segmentMultipleChoice';
import { segmentTrueFalse } from './segmentTrueFalse';
import type { AcervoItem, CebraspeEventDetail, CebraspeFile, PdfLine } from './types';

/**
 * Uma rodada do minerador (spec 12 §6.3) sobre a lista de concursos do lote. Falha de rede num caderno vai para o
 * relatório e a rodada segue; formato inesperado da API (`FormatoCebraspeMudou`) interrompe tudo.
 */
const MULTIPLE_CHOICE_HEADER = /^Quest[ãa]o\s+\d{1,3}$/i;
/** Com 3+ títulos "Questão N", a prova é de múltipla escolha; senão, Certo/Errado. */
function segment(lines: PdfLine[]) {
  const headers = lines.filter((l) => MULTIPLE_CHOICE_HEADER.test(l.text)).length;
  return headers >= 3 ? segmentMultipleChoice(lines) : segmentTrueFalse(lines);
}

async function fetchFile(client: PoliteClient, cacheDir: string, detail: CebraspeEventDetail, file: CebraspeFile, report: RunReport) {
  const result = await client.download(
    fileUrl(detail.tipo, detail.identificador, file.nomeArquivo),
    join(cacheDir, detail.identificador, file.nomeArquivo)
  );
  if (result.fromCache) report.doCache += 1;
  else report.baixados += 1;
  return new Uint8Array(readFileSync(result.path));
}

export async function runMinerador(opts: { client: PoliteClient; acervoDir: string; cacheDir: string; lote: string[] }): Promise<RunReport> {
  const report = emptyReport();
  const concursosDir = join(opts.acervoDir, 'cebraspe');

  for (const identificador of opts.lote) {
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
      let provaBytes: Uint8Array;
      let gabaritoBytes: Uint8Array;
      try {
        provaBytes = await fetchFile(opts.client, opts.cacheDir, detail, pair.prova, report);
        gabaritoBytes = await fetchFile(opts.client, opts.cacheDir, detail, pair.gabarito, report);
      } catch (err) {
        if (!(err instanceof FalhaDeRede)) throw err;
        report.falhas.push({ identificador: `${identificador}/${pair.caderno}`, erro: err.message });
        continue;
      }
      const outcome = assembleExam(
        segment(await readPdfLines(provaBytes)),
        parseAnswerKey(await readPdfLines(gabaritoBytes, { singleColumn: true })),
        { banca: 'Cebraspe', identificador, concurso: detail.nome, ano: detail.ano, areas: detail.areas, prova: pair.prova.descricao, caderno: pair.caderno }
      );
      processed.add(pair.caderno);
      if (outcome.kind === 'quarentena') {
        report.quarentena.push({ caderno: `${identificador}/${pair.caderno}`, motivo: outcome.motivo });
        continue;
      }
      report.provas += 1;
      novos.push(...outcome.itens);
    }

    if (novos.length === 0) continue;
    // Caderno que falhou agora (rede) mantém o que já estava no acervo; só os processados são substituídos
    const mantidos = readConcurso(concursosDir, identificador).filter((i) => !processed.has(i.procedencias[0].caderno));
    writeConcurso(concursosDir, identificador, mergeDuplicates([...mantidos, ...novos]));
    report.concursos += 1;
    report.itens += novos.length;
    report.anulados += novos.filter((i) => i.anulado).length;
    report.comCodigo += novos.filter((i) => i.temCodigo).length;
    report.comFigura += novos.filter((i) => i.dependeDeFigura).length;
  }
  return report;
}
