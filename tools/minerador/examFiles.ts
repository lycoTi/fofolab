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

const provaCode = (f: CebraspeFile) => baseName(f.nomeArquivo).toUpperCase();
const nameMatches = (kc: string, code: string) => kc === code || kc.startsWith(`${code}_`);

/**
 * Gabarito pelo nome: o código do caderno, às vezes com uma versão no fim ("…_001_01_3_1_12_22", SEFAZ SE 2021). O
 * gabarito só vale para a prova de código MAIS específico que casa com ele: o de "100_X_001_02" não serve a "100_X_001"
 * quando a prova "100_X_001_02" existe. Sem casamento pelo nome, tenta pela descrição.
 */
function keysFor(prova: CebraspeFile, keys: CebraspeFile[], allCodes: string[]): CebraspeFile[] {
  const code = provaCode(prova);
  const byName = keys.filter((k) => {
    const kc = keyCode(k);
    if (!nameMatches(kc, code)) return false;
    return !allCodes.some((other) => other.length > code.length && nameMatches(kc, other));
  });
  if (byName.length > 0) return byName;
  const tail = descriptionTail(prova.descricao);
  return keys.filter((k) => descriptionTail(k.descricao) === tail);
}

const isUpdated = (f: CebraspeFile) => /ATUALIZADO/i.test(f.descricao);
const newestFirst = (a: CebraspeFile, b: CebraspeFile) => b.data.localeCompare(a.data);

/** Mais de um definitivo para o mesmo caderno: vale o ATUALIZADO (o mais recente, se houver vários); senão o mais recente. */
function bestKey(candidates: CebraspeFile[]): CebraspeFile | null {
  if (candidates.length === 0) return null;
  const updated = candidates.filter(isUpdated);
  const pool = updated.length > 0 ? updated : candidates;
  return [...pool].sort(newestFirst)[0];
}

/**
 * Um gabarito serve a UMA prova. Se duas provas apontam para o mesmo (prova republicada como ATUALIZADO, nomes em
 * hash), vence a ATUALIZADO, senão a mais recente; empate sem critério → nenhuma (pendente), para não casar item com
 * a resposta de outro caderno.
 */
function winnerFor(provas: CebraspeFile[]): CebraspeFile | null {
  if (provas.length === 1) return provas[0];
  const updated = provas.filter(isUpdated);
  if (updated.length === 1) return updated[0];
  const sorted = [...provas].sort(newestFirst);
  return sorted[0].data !== sorted[1].data ? sorted[0] : null;
}

/**
 * "Edital nº 1 – Abertura": traz o conteúdo programático, fonte da semente do vocabulário. Retificação e a versão em
 * Libras ficam de fora; havendo mais de um, o mais antigo (o original).
 */
export function selectOpeningEdital(detail: CebraspeEventDetail): CebraspeFile | null {
  const candidates = detail.arquivos.filter(
    (f) => /^\s*Edital\s+n\S*\s*1\b/i.test(f.descricao) && !/retifica|libras/i.test(f.descricao)
  );
  return [...candidates].sort((a, b) => a.data.localeCompare(b.data))[0] ?? null;
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
  const used = new Set<CebraspeFile>(keys);

  const provas = detail.arquivos.filter(isObjectiveExam);
  const allCodes = provas.map(provaCode);
  const provasByKey = new Map<CebraspeFile, CebraspeFile[]>();
  for (const prova of provas) {
    const gabarito = bestKey(keysFor(prova, keys, allCodes));
    if (!gabarito) {
      pendentes.push(baseName(prova.nomeArquivo));
      used.add(prova);
      continue;
    }
    provasByKey.set(gabarito, [...(provasByKey.get(gabarito) ?? []), prova]);
  }
  for (const [gabarito, provas] of provasByKey) {
    const prova = winnerFor(provas);
    if (!prova) {
      for (const p of provas) {
        pendentes.push(baseName(p.nomeArquivo));
        used.add(p);
      }
      continue;
    }
    used.add(prova);
    pares.push({ prova, gabarito, caderno: baseName(prova.nomeArquivo) });
  }

  const justificativas = detail.arquivos.filter(isJustification);
  const ignorados = detail.arquivos
    .filter((f) => isExamRelated(f) && !used.has(f) && !isJustification(f) && !/SEM EFEITO|PRELIMINAR/i.test(f.descricao))
    .map((f) => f.nomeArquivo);
  return { pares, pendentes, ignorados, justificativas };
}
