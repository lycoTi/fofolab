import type { AnswerMark, PdfLine } from './types';

/**
 * Gabarito definitivo da Cebraspe (spec 12 §4): grade com uma linha de números (`51 52 … 70`) e, logo abaixo, a linha
 * de respostas do mesmo tamanho (`E C E … X`). `X` = item anulado; `0` = posição vazia da grade, que não é item.
 * Ler o PDF com `readPdfLines(data, { singleColumn: true })`: a grade ocupa a página inteira.
 */
const MARKS = new Set(['C', 'E', 'A', 'B', 'D', 'X', '0']);
/** Rótulo à esquerda da grade: "Item 51 52 …", "Questão 1 2 …", "Gabarito E C …". */
const ROW_LABEL = /^(Item|Itens|Quest[ãa]o|Quest[õo]es|Gabarito)\s+/i;

const tokensOf = (text: string) => text.trim().replace(ROW_LABEL, '').split(/\s+/);

function numberRow(text: string): number[] | null {
  const tokens = tokensOf(text);
  if (tokens.length < 2 || !tokens.every((t) => /^\d{1,3}$/.test(t))) return null;
  const numbers = tokens.map(Number);
  // Linha de números de verdade é crescente, com zeros só no fim (preenchimento da grade: "111 … 120 0 0 0");
  // a linha toda de zeros não é de números
  const used = numbers.slice(0, numbers.indexOf(0) === -1 ? numbers.length : numbers.indexOf(0));
  const onlyPaddingAfter = numbers.slice(used.length).every((n) => n === 0);
  const ascending = used.every((n, i) => i === 0 || n > used[i - 1]);
  return used.length > 0 && ascending && onlyPaddingAfter ? numbers : null;
}

function marksRow(text: string, size: number): string[] | null {
  const tokens = tokensOf(text);
  if (tokens.length !== size || !tokens.every((t) => MARKS.has(t))) return null;
  return tokens;
}

export function parseAnswerKey(lines: PdfLine[]): Map<number, AnswerMark> {
  const key = new Map<number, AnswerMark>();
  for (let i = 0; i < lines.length - 1; i += 1) {
    const numbers = numberRow(lines[i].text);
    if (!numbers) continue;
    const marks = marksRow(lines[i + 1].text, numbers.length);
    if (!marks) continue;
    numbers.forEach((numero, k) => {
      if (numero === 0 || marks[k] === '0') return;
      key.set(numero, marks[k] as AnswerMark);
    });
    i += 1;
  }
  return key;
}
