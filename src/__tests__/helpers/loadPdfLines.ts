import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { textItemsToLines, type PdfTextItem } from '../../lib/pdfText';

/** Extrai as linhas de um PDF de `e2e/fixtures/` no Node, com a mesma montagem de linhas do app. */
export async function loadFixturePdfLines(fileName: string): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(readFileSync(resolve(import.meta.dirname, '../../../e2e/fixtures', fileName)));
  const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  const lines: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    lines.push(...textItemsToLines(content.items.filter((item) => 'str' in item) as PdfTextItem[]));
  }
  await doc.destroy();
  return lines;
}
