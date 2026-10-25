import type { AnswerMark, PdfLine } from './types';

/**
 * Gabarito definitivo da Cebraspe (spec 12 §4): grade com uma linha de números (`51 52 … 70`) e, logo abaixo, a linha
 * de respostas do mesmo tamanho (`E C E … X`). `X` = item anulado; `0` = posição vazia da grade, que não é item.
 * Ler o PDF com `readPdfLines(data, { singleColumn: true })`: a grade ocupa a página inteira.
 *
 * Grade fora do padrão nunca é ignorada em silêncio: na prova com línguas estrangeiras (INPI 2023), a linha
 * "1 … 10 1 … 10" (espanhol e francês) era descartada e o espanhol ficava com as respostas do inglês. Agora a prova
 * inteira vai para a quarentena (`GabaritoInvalido`).
 */
const MARKS = new Set(['C', 'E', 'A', 'B', 'D', 'X', '0']);
/** Rótulo à esquerda da grade: "Item 51 52 …", "Questão 1 2 …", "Gabarito E C …". */
const ROW_LABEL = /^(Item|Itens|Quest[ãa]o|Quest[õo]es|Gabarito)\s+/i;

export class GabaritoInvalido extends Error {
  constructor(motivo: string) {
    super(`gabarito fora do padrão: ${motivo}`);
    this.name = 'GabaritoInvalido';
  }
}

const tokensOf = (text: string) => text.trim().replace(ROW_LABEL, '').split(/\s+/);

/** Só inteiros (2+), sem ser a grade toda de zeros do preenchimento. */
function numericTokens(text: string): number[] | null {
  const tokens = tokensOf(text);
  if (tokens.length < 2 || !tokens.every((t) => /^\d{1,3}$/.test(t))) return null;
  const numbers = tokens.map(Number);
  return numbers.every((n) => n === 0) ? null : numbers;
}

/** Linha de números válida: crescente, com zeros só no fim ("111 … 120 0 0 0"). */
function isValidNumberRow(numbers: number[]): boolean {
  const firstZero = numbers.indexOf(0);
  const used = numbers.slice(0, firstZero === -1 ? numbers.length : firstZero);
  const onlyPaddingAfter = numbers.slice(used.length).every((n) => n === 0);
  const ascending = used.every((n, i) => i === 0 || n > used[i - 1]);
  return used.length > 0 && ascending && onlyPaddingAfter;
}

function marksRow(text: string, size: number): string[] | null {
  const tokens = tokensOf(text);
  if (tokens.length !== size || !tokens.every((t) => MARKS.has(t))) return null;
  return tokens;
}

export function parseAnswerKey(lines: PdfLine[]): Map<number, AnswerMark> {
  const key = new Map<number, AnswerMark>();
  for (let i = 0; i < lines.length - 1; i += 1) {
    const numbers = numericTokens(lines[i].text);
    if (!numbers) continue;
    if (!isValidNumberRow(numbers)) throw new GabaritoInvalido(`linha de números fora de ordem ("${lines[i].text.slice(0, 60)}")`);
    const marks = marksRow(lines[i + 1].text, numbers.length);
    if (!marks) continue;
    numbers.forEach((numero, k) => {
      if (numero === 0 || marks[k] === '0') return;
      if (key.has(numero)) throw new GabaritoInvalido(`o item ${numero} aparece duas vezes na grade`);
      key.set(numero, marks[k] as AnswerMark);
    });
    i += 1;
  }
  return key;
}
