import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PdfLine } from './types';

/**
 * PDF da Cebraspe → linhas em ordem de leitura (spec 12 §4): página a página, coluna da esquerda antes da direita, de
 * cima para baixo. `atMargin` marca a linha que começa na margem da coluna — é o que separa item (número na margem,
 * continuação recuada) de texto-base (na margem, sem número).
 */
const SAME_LINE_TOLERANCE = 2;
const MARGIN_TOLERANCE = 3;
/** Distância mínima entre dois pedaços de texto para valer um espaço que o PDF não escreveu. */
const MISSING_SPACE_GAP = 1;
/** Texto idêntico em pelo menos esta fração das páginas é cabeçalho ou rodapé. */
const REPEATED_SHARE = 0.6;

interface Piece {
  x: number;
  y: number;
  width: number;
  str: string;
  column: 'L' | 'R';
}

function joinPieces(pieces: Piece[]): string {
  let text = '';
  let prev: Piece | null = null;
  for (const piece of pieces) {
    const gap = prev ? piece.x - (prev.x + prev.width) : 0;
    const needsSpace = prev !== null && gap > MISSING_SPACE_GAP && !text.endsWith(' ') && !piece.str.startsWith(' ');
    text += needsSpace ? ` ${piece.str}` : piece.str;
    prev = piece;
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** Agrupa os pedaços de uma página em linhas, já na ordem de leitura. */
function pageLines(pieces: Piece[], page: number): PdfLine[] {
  const sorted = [...pieces].sort((a, b) => {
    if (a.column !== b.column) return a.column === 'L' ? -1 : 1;
    if (Math.abs(a.y - b.y) > SAME_LINE_TOLERANCE) return b.y - a.y;
    return a.x - b.x;
  });
  const groups: Piece[][] = [];
  for (const piece of sorted) {
    const current = groups[groups.length - 1];
    const sameLine = current && current[0].column === piece.column && Math.abs(current[0].y - piece.y) <= SAME_LINE_TOLERANCE;
    if (sameLine) current.push(piece);
    else groups.push([piece]);
  }
  const lines = groups
    .map((g) => ({ page, column: g[0].column, x: Math.min(...g.map((p) => p.x)), y: g[0].y, text: joinPieces(g), atMargin: false }))
    .filter((l) => l.text !== '');
  for (const column of ['L', 'R'] as const) {
    const inColumn = lines.filter((l) => l.column === column);
    if (inColumn.length === 0) continue;
    const margin = Math.min(...inColumn.map((l) => l.x));
    for (const line of inColumn) line.atMargin = line.x - margin <= MARGIN_TOLERANCE;
  }
  return lines;
}

function withoutRepeatedHeaders(lines: PdfLine[], pageCount: number): PdfLine[] {
  if (pageCount < 2) return lines;
  const pagesByText = new Map<string, Set<number>>();
  for (const line of lines) {
    if (!pagesByText.has(line.text)) pagesByText.set(line.text, new Set());
    pagesByText.get(line.text)!.add(line.page);
  }
  const minPages = Math.max(2, Math.ceil(pageCount * REPEATED_SHARE));
  return lines.filter((l) => pagesByText.get(l.text)!.size < minPages);
}

export async function readPdfLines(data: Uint8Array): Promise<PdfLine[]> {
  // O pdf.js toma posse do buffer; a cópia preserva o arquivo de quem chamou
  const doc = await getDocument({ data: data.slice(), verbosity: 0 }).promise;
  const lines: PdfLine[] = [];
  for (let page = 1; page <= doc.numPages; page += 1) {
    const pdfPage = await doc.getPage(page);
    const half = pdfPage.getViewport({ scale: 1 }).width / 2;
    const content = await pdfPage.getTextContent();
    const pieces: Piece[] = [];
    for (const item of content.items) {
      if (!('str' in item) || item.str === '') continue;
      const x = item.transform[4];
      pieces.push({ x, y: Math.round(item.transform[5]), width: item.width, str: item.str, column: x < half ? 'L' : 'R' });
    }
    lines.push(...pageLines(pieces, page));
  }
  await doc.destroy();
  return withoutRepeatedHeaders(lines, doc.numPages);
}
