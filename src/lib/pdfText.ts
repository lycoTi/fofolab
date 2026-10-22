/** Pedaço de texto como o pdf.js entrega (`getTextContent().items`). */
export interface PdfTextItem {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

/**
 * Remonta as linhas de uma página: o pdf.js entrega o texto em pedaços; uma linha nova começa
 * quando a altura (y) muda ou o pedaço avisa fim de linha. Colunas de uma tabela na mesma altura
 * ficam na mesma linha ("Prova objetiva (P1) Conhecimentos básicos 40").
 */
export function textItemsToLines(items: PdfTextItem[]): string[] {
  const lines: string[] = [];
  let current = '';
  let lastY: number | null = null;

  for (const item of items) {
    const y = Math.round(item.transform[5]);
    if (lastY !== null && Math.abs(y - lastY) > 2 && current.trim()) {
      lines.push(current.trim());
      current = '';
    }
    current += item.str;
    lastY = y;
    if (item.hasEOL && current.trim()) {
      lines.push(current.trim());
      current = '';
      lastY = null;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.map((line) => line.replace(/\s+/g, ' '));
}
