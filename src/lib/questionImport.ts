import type { ImportQuestionItem, Topic } from '../types/database';
import { splitOptionPrefix } from './questionOptions';

/**
 * Importador de questões colando TEXTO (copiado do PDF da prova / site de questões) ou JSON.
 *
 * O JSON é o mesmo contrato que o futuro extrator "PDF da prova → IA" vai produzir
 * (docs/specs/06-importacao-e-persistencia.md), então os dois caminhos convergem na mesma
 * prévia + gravação. Formato de texto aceito (uma questão termina na linha "Gabarito:"):
 *
 *   1. (FGV/CGU/2022) [tópico 1.1] Enunciado da questão...
 *   A) primeira alternativa
 *   B) segunda alternativa
 *   Gabarito: B
 *
 *   2. (Cebraspe/BACEN/2024) Julgue o item: ...
 *   Gabarito: Certo
 */
export interface ParsedQuestion {
  statement: string;
  options: string[]; // Sempre "X) texto"
  answer: string;
  examBoard: string | null;
  examYear: number | null;
  organ: string | null;
  topicCode: string | null;
}

export interface ImportIssue {
  block: number;
  message: string;
  excerpt: string;
}

export interface QuestionParseResult {
  format: 'text' | 'json';
  questions: ParsedQuestion[];
  issues: ImportIssue[];
}

const BOARD_ALIASES: Record<string, string> = {
  FGV: 'FGV',
  CEBRASPE: 'Cebraspe',
  CESPE: 'Cebraspe',
  'CESPE/UNB': 'Cebraspe',
  FCC: 'FCC',
  CESGRANRIO: 'Cesgranrio',
  VUNESP: 'Vunesp',
  IBFC: 'IBFC',
  QUADRIX: 'Quadrix',
  IDECAN: 'Idecan',
  AOCP: 'AOCP',
  FUNDATEC: 'Fundatec',
  CONSULPLAN: 'Consulplan',
  IADES: 'IADES',
  ESAF: 'ESAF',
  FEPESE: 'FEPESE',
  COMPERVE: 'Comperve',
};

const ANSWER_LINE = /^\s*(?:gabarito|resposta|resp\.)(?:\s+(?:oficial|definitivo|final))?\s*[:–-](.*)$/i;
const NAMED_NUMBER_HEADER = /^\s*(?:quest[aã]o|q)\s*\d{1,4}\s*[.)–:-]?\s*/i;
const BARE_NUMBER_HEADER = /^\s*\d{1,3}(?:\s*[.)–:-]\s+|\s+(?=\())/;
const METADATA_PREFIX = /^\(([^()]{2,80})\)/;
const TOPIC_TAG = /\[\s*t[oó]pico\s*[:-]?\s*([\d.]+)\s*\]/i;
const ANNULLED = /^(anulad[ao]|x|\*)$/i;

function stripNumberHeader(line: string): string {
  return line.replace(NAMED_NUMBER_HEADER, '').replace(BARE_NUMBER_HEADER, '');
}

export function normalizeStatement(statement: string): string {
  return statement
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalBoardName(raw: string): string | null {
  const key = raw.trim().toUpperCase();
  return BOARD_ALIASES[key] ?? null;
}

function parseMetadata(inner: string): {
  examBoard: string | null;
  examYear: number | null;
  organ: string | null;
} | null {
  const tokens = inner
    .split(/[/|,;–-]+|\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  let examBoard: string | null = null;
  let examYear: number | null = null;
  let organ: string | null = null;

  for (const token of tokens) {
    if (!examYear && /^(19|20)\d{2}$/.test(token)) {
      examYear = Number(token);
      continue;
    }
    const board = canonicalBoardName(token);
    if (!examBoard && board) {
      examBoard = board;
      continue;
    }
    if (!organ && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,12}(?:-[A-Z]{2})?$/.test(token)) {
      organ = token;
    }
  }

  // Só é metadado se tiver ano ou banca reconhecida; senão o parêntese faz parte do enunciado
  if (!examBoard && !examYear) return null;
  return { examBoard, examYear, organ };
}

function excerptOf(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 90 ? `${flat.slice(0, 87)}...` : flat;
}

interface OptionStart {
  lineIndex: number;
  key: string;
  text: string;
}

/**
 * As alternativas são a ÚLTIMA sequência A, B, C… em ordem; listas internas do enunciado
 * ("a) … b) …" antes das alternativas) continuam fazendo parte do enunciado.
 */
function isAlphabeticRun(starts: OptionStart[], from: number): boolean {
  for (let j = from; j < starts.length; j++) {
    if (starts[j].key !== 'ABCDE'[j - from]) return false;
  }
  return true;
}

function findOptionBlockStart(starts: OptionStart[]): number {
  for (let i = starts.length - 1; i >= 0; i--) {
    if (starts[i].key === 'A' && starts.length - i >= 2 && isAlphabeticRun(starts, i)) return i;
  }
  return -1;
}

/** Resolve o gabarito; devolve a mensagem de problema quando não dá para importar. */
function resolveAnswer(
  options: string[],
  answerRaw: string
): { answer: string; options: string[] } | { problem: string } {
  const answerToken = answerRaw.trim().replace(/[.)]$/, '');
  if (ANNULLED.test(answerToken)) return { problem: 'Questão anulada — não importada.' };

  if (options.length === 0) {
    const certoErrado = /^(certo|errado|c|e)$/i.exec(answerToken);
    if (!certoErrado) {
      return { problem: 'Sem alternativas (A, B, C…) e o gabarito não é Certo/Errado.' };
    }
    // Item Certo/Errado (estilo Cebraspe)
    const answer = certoErrado[1].toUpperCase().startsWith('C') ? 'C' : 'E';
    return { answer, options: ['C) Certo', 'E) Errado'] };
  }

  const letter = /^\(?([A-Ea-e])\)?$/.exec(answerToken);
  const answer = letter ? letter[1].toUpperCase() : null;
  if (!answer || !options.some((opt) => opt.startsWith(`${answer})`))) {
    return { problem: `Gabarito "${answerRaw.trim()}" não corresponde a nenhuma alternativa.` };
  }
  return { answer, options };
}

function parseTextBlock(
  lines: string[],
  answerRaw: string,
  blockNumber: number,
  issues: ImportIssue[]
): ParsedQuestion | null {
  const nonEmpty = lines.map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  const fullText = nonEmpty.join(' ');
  if (nonEmpty.length === 0) {
    issues.push({ block: blockNumber, message: 'Gabarito sem enunciado antes dele.', excerpt: answerRaw });
    return null;
  }

  // Cabeçalho: número, (BANCA/ÓRGÃO/ANO) e [tópico X.Y]
  let header = stripNumberHeader(nonEmpty[0]).trimStart();
  let meta: ReturnType<typeof parseMetadata> = null;
  const metaMatch = METADATA_PREFIX.exec(header);
  if (metaMatch) {
    meta = parseMetadata(metaMatch[1]);
    if (meta) header = header.slice(metaMatch[0].length).trimStart();
  }
  let topicCode: string | null = null;
  const bodyLines = [header, ...nonEmpty.slice(1)].map((line) => {
    const tag = TOPIC_TAG.exec(line);
    if (tag && !topicCode) {
      topicCode = tag[1].replace(/\.$/, '');
      return line.replace(TOPIC_TAG, '').trim();
    }
    return line;
  });

  const optionStarts: OptionStart[] = [];
  bodyLines.forEach((line, lineIndex) => {
    const prefixed = splitOptionPrefix(line);
    if (prefixed) optionStarts.push({ lineIndex, ...prefixed });
  });
  const firstOption = findOptionBlockStart(optionStarts);

  const statementLines = firstOption >= 0 ? bodyLines.slice(0, optionStarts[firstOption].lineIndex) : bodyLines;
  const statement = statementLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const options: string[] = [];
  if (firstOption >= 0) {
    const starts = optionStarts.slice(firstOption);
    starts.forEach((start, idx) => {
      const endLine = idx + 1 < starts.length ? starts[idx + 1].lineIndex : bodyLines.length;
      const continuation = bodyLines.slice(start.lineIndex + 1, endLine).join(' ').trim();
      const text = [start.text, continuation].filter(Boolean).join(' ');
      options.push(`${start.key}) ${text}`);
    });
  }

  if (!statement) {
    issues.push({ block: blockNumber, message: 'Não encontramos o enunciado.', excerpt: excerptOf(fullText) });
    return null;
  }

  const resolved = resolveAnswer(options, answerRaw);
  if ('problem' in resolved) {
    issues.push({ block: blockNumber, message: resolved.problem, excerpt: excerptOf(statement) });
    return null;
  }

  return {
    statement,
    options: resolved.options,
    answer: resolved.answer,
    examBoard: meta?.examBoard ?? null,
    examYear: meta?.examYear ?? null,
    organ: meta?.organ ?? null,
    topicCode,
  };
}

export function parseQuestionsFromText(text: string): QuestionParseResult {
  const issues: ImportIssue[] = [];
  const questions: ParsedQuestion[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  let buffer: string[] = [];
  let blockNumber = 0;
  for (const line of lines) {
    const answerMatch = ANSWER_LINE.exec(line);
    if (answerMatch) {
      blockNumber++;
      const parsed = parseTextBlock(buffer, answerMatch[1].trim(), blockNumber, issues);
      if (parsed) questions.push(parsed);
      buffer = [];
    } else {
      buffer.push(line);
    }
  }

  const leftover = buffer.join(' ').trim();
  if (leftover) {
    issues.push({
      block: blockNumber + 1,
      message: 'Texto sem linha "Gabarito:" no final — não importado.',
      excerpt: excerptOf(leftover),
    });
  }

  return { format: 'text', questions, issues };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function normalizeJsonOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const fallbackKey = 'ABCDE'[index] ?? String(index + 1);
      if (typeof item === 'string') {
        const prefixed = splitOptionPrefix(item);
        return prefixed ? `${prefixed.key}) ${prefixed.text}` : `${fallbackKey}) ${item.trim()}`;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const key = (pickString(obj, ['letra', 'letter', 'key']) ?? fallbackKey).toUpperCase();
        const text = pickString(obj, ['texto', 'text']) ?? '';
        return `${key}) ${text}`;
      }
      return null;
    })
    .filter((opt): opt is string => Boolean(opt));
}

export function parseQuestionsFromJson(json: string): QuestionParseResult {
  const issues: ImportIssue[] = [];
  const questions: ParsedQuestion[] = [];

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return {
      format: 'json',
      questions,
      issues: [{ block: 0, message: 'O JSON não é válido (confira vírgulas e aspas).', excerpt: excerptOf(json) }],
    };
  }

  let list: unknown = data;
  if (!Array.isArray(data) && data && typeof data === 'object') {
    const wrapper = data as Record<string, unknown>;
    list = wrapper.questoes ?? wrapper.questions;
  }
  if (!Array.isArray(list)) {
    return {
      format: 'json',
      questions,
      issues: [{ block: 0, message: 'Esperávamos uma lista de questões (ou { "questoes": [...] }).', excerpt: excerptOf(json) }],
    };
  }

  list.forEach((entry, idx) => {
    const blockNumber = idx + 1;
    if (!entry || typeof entry !== 'object') {
      issues.push({ block: blockNumber, message: 'Item da lista não é uma questão.', excerpt: String(entry) });
      return;
    }
    const obj = entry as Record<string, unknown>;
    const statement = pickString(obj, ['enunciado', 'statement']);
    const answerRaw = pickString(obj, ['gabarito', 'answer', 'resposta', 'final_answer']);
    const yearRaw = pickString(obj, ['ano', 'year', 'exam_year']);
    const boardRaw = pickString(obj, ['banca', 'board', 'exam_board']);

    const asText = [
      statement ?? '',
      ...normalizeJsonOptions(obj.alternativas ?? obj.options),
    ];
    const parsed = parseTextBlock(asText, answerRaw ?? '', blockNumber, issues);
    if (!parsed) return;

    questions.push({
      ...parsed,
      examBoard: boardRaw ? (canonicalBoardName(boardRaw) ?? boardRaw) : parsed.examBoard,
      examYear: yearRaw && /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : parsed.examYear,
      organ: pickString(obj, ['orgao', 'órgão', 'organ']) ?? parsed.organ,
      topicCode: pickString(obj, ['topico', 'tópico', 'topic', 'topic_code']) ?? parsed.topicCode,
    });
  });

  return { format: 'json', questions, issues };
}

/** JSON começa com `{`, `[{`, `["` ou `[]` — "[tópico 1.2] Enunciado…" é texto. */
const JSON_START = /^(?:\{|\[\s*[{"\]])/;

export function parseQuestionImport(input: string): QuestionParseResult {
  const trimmed = input.trim();
  if (JSON_START.test(trimmed)) return parseQuestionsFromJson(trimmed);
  return parseQuestionsFromText(input);
}

/** Converte a prévia em itens graváveis, resolvendo o tópico pelo código quando houver. */
export function toImportItems(
  parsed: ParsedQuestion[],
  params: {
    subjectTopics: Topic[];
    defaultTopicId: string | null;
    defaults: { examBoard: string; examYear: number; organ: string | null };
  }
): ImportQuestionItem[] {
  const topicByCode = new Map(
    params.subjectTopics.filter((t) => t.code).map((t) => [String(t.code).trim(), t.id])
  );
  return parsed.map((q) => ({
    statement: q.statement,
    options: q.options,
    finalAnswer: q.answer,
    examBoard: q.examBoard ?? params.defaults.examBoard,
    examYear: q.examYear ?? params.defaults.examYear,
    organ: q.organ ?? params.defaults.organ,
    topicId: (q.topicCode && topicByCode.get(q.topicCode)) || params.defaultTopicId,
  }));
}
