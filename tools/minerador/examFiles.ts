import type { CebraspeEventDetail, CebraspeFile, ExamPair } from './types';

/**
 * Escolhe, entre os arquivos de um concurso, a prova objetiva de cada caderno e o gabarito DEFINITIVO dela
 * (spec 12 §6.3, passo 2). Prova e gabarito se reconhecem pelo código do caderno no nome do arquivo
 * (`846_SERPRO_23_001_01.PDF` ↔ `GAB_DEFINITIVO_846_SERPRO_23_001_01.PDF`).
 */
const DEFINITIVO_PREFIX = /^GAB_DEFINITIVO_/i;

/** Arquivos que interessam ao relatório (prova, gabarito, caderno); editais e comunicados nem são listados. */
const isExamRelated = (f: CebraspeFile) => /PROVA|GABARITO|CADERNO|PADR[ÃA]O DE RESPOSTA/i.test(f.descricao);
const isCombined = (f: CebraspeFile) => /PROVA OBJETIVA E GABARITO/i.test(f.descricao);
/** Começa com "PROVA OBJETIVA": "Edital nº 4 – Resultado final na prova objetiva" não é prova. */
const isObjectiveExam = (f: CebraspeFile) =>
  /^\s*PROVA OBJETIVA/i.test(f.descricao) && !/GABARITO/i.test(f.descricao) && !isCombined(f);
const isDefinitiveKey = (f: CebraspeFile) =>
  /GABARITO DEFINITIVO/i.test(f.descricao) && !/SEM EFEITO/i.test(f.descricao) && !isCombined(f);
const isJustification = (f: CebraspeFile) => /JUSTIFICATIVA/i.test(f.descricao);

const baseName = (nomeArquivo: string) => nomeArquivo.replace(/\.[^.]+$/, '');
const keyCode = (f: CebraspeFile) => baseName(f.nomeArquivo).replace(DEFINITIVO_PREFIX, '').toUpperCase();

/**
 * O que a descrição diz depois do tipo do arquivo, sem "ATUALIZADO": "PROVA OBJETIVA – PROCAP – 2ª TURMA" e
 * "GABARITO DEFINITIVO – PROCAP – 2ª TURMA" dão o mesmo resto. Serve quando a Cebraspe publica com nome em hash.
 */
const descriptionTail = (descricao: string) =>
  descricao
    .replace(/^\s*(PROVA OBJETIVA|GABARITO DEFINITIVO)/i, '')
    .replace(/[-–—]\s*ATUALIZADO\s*$/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toUpperCase();

function keysFor(prova: CebraspeFile, keys: CebraspeFile[]): CebraspeFile[] {
  const code = baseName(prova.nomeArquivo).toUpperCase();
  const byName = keys.filter((k) => keyCode(k) === code || keyCode(k).startsWith(`${code}_`));
  if (byName.length > 0) return byName;
  const tail = descriptionTail(prova.descricao);
  return keys.filter((k) => descriptionTail(k.descricao) === tail);
}

/** Mais de um definitivo para o mesmo caderno: vale o ATUALIZADO; senão o mais recente. */
function bestKey(candidates: CebraspeFile[]): CebraspeFile | null {
  if (candidates.length === 0) return null;
  const updated = candidates.find((f) => /ATUALIZADO/i.test(f.descricao));
  if (updated) return updated;
  return [...candidates].sort((a, b) => b.data.localeCompare(a.data))[0];
}

export function selectExamPairs(detail: CebraspeEventDetail): {
  pares: ExamPair[];
  pendentes: string[];
  ignorados: string[];
  justificativas: CebraspeFile[];
} {
  const keys = detail.arquivos.filter(isDefinitiveKey);
  const pares: ExamPair[] = [];
  const pendentes: string[] = [];
  const used = new Set<CebraspeFile>();

  for (const prova of detail.arquivos.filter(isObjectiveExam)) {
    const caderno = baseName(prova.nomeArquivo);
    const gabarito = bestKey(keysFor(prova, keys));
    used.add(prova);
    if (!gabarito) {
      pendentes.push(caderno);
      continue;
    }
    pares.push({ prova, gabarito, caderno });
  }
  for (const k of keys) used.add(k);

  const justificativas = detail.arquivos.filter(isJustification);
  const ignorados = detail.arquivos
    .filter((f) => isExamRelated(f) && !used.has(f) && !isJustification(f) && !/SEM EFEITO|PRELIMINAR/i.test(f.descricao))
    .map((f) => f.nomeArquivo);
  return { pares, pendentes, ignorados, justificativas };
}
