import { continuationChecker } from './pdfLines';
import type { ExtractedItem, PdfLine } from './types';

/**
 * Prova de múltipla escolha da Cebraspe → questões (spec 12 §4). "Questão N" abre a questão; a primeira linha depois
 * dela é sempre enunciado; uma linha na margem com a PRÓXIMA letra esperada e espaço ("A ", depois "B "…) abre a
 * alternativa — "A prática de racismo…" dentro da alternativa B não abre outra A. Depois da última alternativa, o que
 * vem antes da próxima "Questão" é texto-base (ex.: "Texto 1A9-I") das questões seguintes. Quebras de linha preservadas.
 */
const QUESTION_HEADER = /^Quest[ãa]o\s+(\d{1,3})\s*$/i;
/** Nome da matéria: centralizado (fora da margem) e todo em maiúsculas, como "DIREITO CONSTITUCIONAL". */
const SUBJECT_HEADER = /^[A-ZÀ-Ý][A-ZÀ-Ý ,()–-]{5,}$/;
/** Título de seção da Cebraspe: "-- CONHECIMENTOS ESPECÍFICOS --". */
const SECTION_HEADER = /^-+\s*(.+?)\s*-+$/;
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

type Part = 'enunciado' | 'alternativa' | 'depois';

export function segmentMultipleChoice(lines: PdfLine[]): ExtractedItem[] {
  const continues = continuationChecker(
    lines,
    (l) => QUESTION_HEADER.test(l.text) || SUBJECT_HEADER.test(l.text) || SECTION_HEADER.test(l.text),
    (l) => l.atMargin && /^[A-E] /.test(l.text)
  );
  const items: ExtractedItem[] = [];
  let current: ExtractedItem | null = null;
  let part: Part = 'depois';
  let firstStatementLine = false;
  let materia: string | null = null;
  let textoBase: string | null = null;
  let pendingBase: string[] = [];

  const appendToCurrent = (text: string) => {
    if (!current) return;
    if (part === 'enunciado') {
      current.enunciado = current.enunciado ? `${current.enunciado}\n${text}` : text;
      return;
    }
    const alternatives = current.alternativas!;
    alternatives[alternatives.length - 1] += `\n${text}`;
  };

  for (const line of lines) {
    const header = QUESTION_HEADER.exec(line.text);
    if (header) {
      if (pendingBase.length > 0) {
        textoBase = pendingBase.join('\n');
        pendingBase = [];
      }
      current = { numero: Number(header[1]), formato: 'MULTIPLA_ESCOLHA', textoBase, enunciado: '', alternativas: [], materiaOrigem: materia };
      items.push(current);
      part = 'enunciado';
      firstStatementLine = true;
      continue;
    }

    const section = SECTION_HEADER.exec(line.text);
    if (section || (!line.atMargin && SUBJECT_HEADER.test(line.text))) {
      // Matéria ou seção nova ("DIREITO CONSTITUCIONAL", "-- CONHECIMENTOS ESPECÍFICOS --"): o texto-base da anterior não vale
      materia = section ? section[1].trim() : line.text;
      current = null;
      part = 'depois';
      textoBase = null;
      pendingBase = [];
      continue;
    }

    if (!current || part === 'depois') {
      if (current && !line.atMargin && continues(line)) {
        appendToCurrent(line.text);
        continue;
      }
      // Fim das alternativas: daqui até a próxima "Questão" é texto-base
      part = 'depois';
      pendingBase.push(line.text);
      continue;
    }

    const alternatives = current.alternativas!;
    const nextLetter = LETTERS[alternatives.length];
    const opensAlternative =
      line.atMargin && !firstStatementLine && nextLetter !== undefined && line.text.startsWith(`${nextLetter} `);
    firstStatementLine = false;
    if (opensAlternative) {
      alternatives.push(`${nextLetter}) ${line.text.slice(2).trim()}`);
      part = 'alternativa';
      continue;
    }

    const afterLastAlternative = part === 'alternativa' && alternatives.length === LETTERS.length;
    if (afterLastAlternative && (line.atMargin || !continues(line))) {
      part = 'depois';
      pendingBase.push(line.text);
      continue;
    }
    appendToCurrent(line.text);
  }
  return items;
}
