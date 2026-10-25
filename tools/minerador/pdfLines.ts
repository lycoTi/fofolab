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
/** Faixa (em pontos) do topo e do rodapé onde ficam cabeçalho e número da página. */
const HEADER_BAND = 45;

/** Texto fixo da banca no meio do caderno, que viraria texto-base das questões seguintes. */
const BOILERPLATE = /^Espa[çc]o livre$/i;

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
    .filter((l) => l.text !== '' && !BOILERPLATE.test(l.text));
  for (const column of ['L', 'R'] as const) {
    const inColumn = lines.filter((l) => l.column === column);
    if (inColumn.length === 0) continue;
    const margin = Math.min(...inColumn.map((l) => l.x));
    for (const line of inColumn) line.atMargin = line.x - margin <= MARGIN_TOLERANCE;
  }
  return lines;
}

/** Acima desta fração de linhas "à direita" que atravessam o meio, a página tem uma coluna só. */
const SINGLE_COLUMN_SHARE = 0.5;

/**
 * A prova da Cebraspe tem duas colunas, mas há linhas de largura total (instruções no topo da 1ª página) e páginas de
 * uma coluna só (a última da PM SC 2023). Linha que atravessa o meio é de largura total e fica inteira na coluna da
 * esquerda; se a maioria das linhas com texto à direita atravessa o meio, a página toda é uma coluna só.
 */
function assignColumns(raw: Omit<Piece, 'column'>[], half: number): Piece[] {
  const near = (rows: Set<number>, y: number) => [...rows].some((r) => Math.abs(r - y) <= SAME_LINE_TOLERANCE);
  const visible = raw.filter((p) => p.str.trim() !== '');
  const crossingRows = new Set(visible.filter((p) => p.x < half - 2 && p.x + p.width > half + 2).map((p) => p.y));
  const rightRows = new Set(visible.filter((p) => p.x >= half).map((p) => p.y));
  const singleColumn = rightRows.size > 0 && crossingRows.size / rightRows.size > SINGLE_COLUMN_SHARE;
  return raw.map((p) => {
    const fullWidth = singleColumn || near(crossingRows, p.y);
    const column: Piece['column'] = !fullWidth && p.x >= half ? 'R' : 'L';
    return { ...p, column };
  });
}

/**
 * Cabeçalho e rodapé: o que fica na faixa do topo ou do rodapé da página e se repete na maioria das páginas (código do
 * caderno, "CEBRASPE – SERPRO – Edital: 2023", número da página). Fora dessa faixa nada sai — uma linha comum como
 * "julgue os itens a seguir." pode se repetir em muitas páginas e faz parte do texto-base.
 */
function withoutRepeatedHeaders(lines: PdfLine[], band: Set<PdfLine>, pageCount: number): PdfLine[] {
  const pagesByText = new Map<string, Set<number>>();
  for (const line of band) {
    if (!pagesByText.has(line.text)) pagesByText.set(line.text, new Set());
    pagesByText.get(line.text)!.add(line.page);
  }
  const minPages = Math.max(2, Math.ceil(pageCount * REPEATED_SHARE));
  const repeated = [...pagesByText.entries()].filter(([, pages]) => pages.size >= minPages).map(([text]) => text);
  // Numa página de coluna só, os pedaços do cabeçalho (código à esquerda, banca à direita) caem na mesma linha, às
  // vezes com o número da página: a linha feita só de pedaços repetidos também é cabeçalho
  const isHeader = (line: PdfLine) => {
    if (!band.has(line)) return false;
    let rest = line.text;
    for (const piece of repeated) rest = rest.split(piece).join(' ');
    return /^\s*\d{0,3}\s*$/.test(rest);
  };
  return lines.filter((l) => !isHeader(l));
}

/** Diferença máxima para uma linha estar "no recuo de continuação". */
const INDENT_TOLERANCE = 3;

/**
 * Diz se uma linha fora da margem está no recuo de continuação (de item ou alternativa) da sua página/coluna — o `x`
 * mais comum entre as linhas fora da margem. O parágrafo do texto-base às vezes começa com recuo de primeira linha
 * MAIOR (ex.: margem 303, continuação 321, parágrafo 332): essa linha não continua o item anterior.
 */
export function continuationChecker(lines: PdfLine[], ignore: (line: PdfLine) => boolean = () => false): (line: PdfLine) => boolean {
  const counts = new Map<string, Map<number, number>>();
  for (const line of lines) {
    // Títulos centralizados ("Questão 78", nome da matéria) não são continuação e distorceriam a contagem
    if (line.atMargin || ignore(line)) continue;
    const key = `${line.page}${line.column}`;
    if (!counts.has(key)) counts.set(key, new Map());
    const x = Math.round(line.x);
    counts.get(key)!.set(x, (counts.get(key)!.get(x) ?? 0) + 1);
  }
  const indents = new Map<string, number>();
  for (const [key, byX] of counts) indents.set(key, [...byX.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  return (line) => {
    const indent = indents.get(`${line.page}${line.column}`);
    return indent !== undefined && Math.abs(Math.round(line.x) - indent) <= INDENT_TOLERANCE;
  };
}

export async function readPdfLines(data: Uint8Array): Promise<PdfLine[]> {
  // O pdf.js toma posse do buffer; a cópia preserva o arquivo de quem chamou
  const doc = await getDocument({ data: data.slice(), verbosity: 0 }).promise;
  const lines: PdfLine[] = [];
  const band = new Set<PdfLine>();
  for (let page = 1; page <= doc.numPages; page += 1) {
    const pdfPage = await doc.getPage(page);
    const half = pdfPage.getViewport({ scale: 1 }).width / 2;
    const content = await pdfPage.getTextContent();
    const raw: Omit<Piece, 'column'>[] = [];
    for (const item of content.items) {
      if (!('str' in item) || item.str === '') continue;
      raw.push({ x: item.transform[4], y: Math.round(item.transform[5]), width: item.width, str: item.str });
    }
    const height = pdfPage.getViewport({ scale: 1 }).height;
    for (const line of pageLines(assignColumns(raw, half), page)) {
      if (line.y >= height - HEADER_BAND || line.y <= HEADER_BAND) band.add(line);
      lines.push(line);
    }
  }
  await doc.destroy();
  return withoutRepeatedHeaders(lines, band, doc.numPages);
}
