import { continuationChecker } from './pdfLines';
import type { ExtractedItem, PdfLine } from './types';

/**
 * Prova Certo/Errado da Cebraspe → itens (spec 12 §4). Na diagramação da banca, o número do item e o texto-base começam
 * na margem da coluna e a continuação do item vem recuada. Só o PRÓXIMO número esperado abre item: uma frase que começa
 * com "2023" ou "10 anos" não vira item. As quebras de linha do PDF são preservadas (`\n`) para a montagem reconhecer
 * blocos de código.
 */
const SECTION_HEADER = /^-+\s*(.+?)\s*-+$/;
/** Número de 1 a 3 dígitos colado ou não ao texto: "51 A integridade", "51A integridade". */
const ITEM_START = /^(\d{1,3})(?=\s|[A-ZÀ-Ý“"(])\s*(.*)$/;
/**
 * Linha de código recuada: começa como código (minúscula, símbolo ou `Nome(`) e tem pontuação de código. Parágrafo de
 * prosa recuado ("SPA (single-page app), ou…") começa com palavra maiúscula seguida de espaço e não entra.
 */
const CODE_START = /^([a-z_$)}\]'"“‘]|[A-Z]\w*\()/;
const CODE_PUNCTUATION = /[(){};=[\]]|^['"“‘]|^\w+:\s?\S/;
const isIndentedCode = (text: string) => CODE_START.test(text.trim()) && CODE_PUNCTUATION.test(text.trim());

export function segmentTrueFalse(lines: PdfLine[]): ExtractedItem[] {
  const continuesItem = continuationChecker(lines, () => false, (l) => l.atMargin && ITEM_START.test(l.text));
  const items: ExtractedItem[] = [];
  let current: ExtractedItem | null = null;
  let expected: number | null = null;
  let materia: string | null = null;
  let textoBase: string | null = null;
  let pendingBase: string[] = [];

  for (const line of lines) {
    const header = SECTION_HEADER.exec(line.text);
    if (header) {
      // Troca de seção: o que vinha antes (instruções, outra matéria) não é texto-base dos próximos itens
      materia = header[1].trim();
      current = null;
      pendingBase = [];
      textoBase = null;
      continue;
    }

    if (!line.atMargin) {
      // Código tem recuo próprio (mais fundo que a continuação): com pontuação de código, ainda é o item
      if (current && (continuesItem(line) || isIndentedCode(line.text))) {
        current.enunciado += `\n${line.text}`;
        continue;
      }
      if (current) {
        // Recuo diferente do da continuação: é o começo de um parágrafo de texto-base
        current = null;
        pendingBase.push(line.text);
        continue;
      }
      if (pendingBase.length > 0) pendingBase.push(line.text);
      continue;
    }

    const start = ITEM_START.exec(line.text);
    const numero = start ? Number(start[1]) : null;
    const opensItem = numero !== null && (expected === null || numero === expected);
    if (!opensItem) {
      // Linha na margem sem o número esperado: começa (ou continua) um texto-base novo
      current = null;
      pendingBase.push(line.text);
      continue;
    }

    if (pendingBase.length > 0) {
      textoBase = pendingBase.join('\n');
      pendingBase = [];
    }
    current = {
      numero: numero as number,
      formato: 'CERTO_ERRADO',
      textoBase,
      enunciado: start![2],
      alternativas: null,
      materiaOrigem: materia,
    };
    items.push(current);
    expected = (numero as number) + 1;
  }
  return items;
}
