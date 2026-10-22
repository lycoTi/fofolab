import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { textItemsToLines } from '../../lib/pdfText';

/**
 * Ponte com o pdf.js. A biblioteca e o worker são importados só quando um PDF é aberto,
 * para não pesar no carregamento inicial da bancada.
 */
async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

export async function loadPdfDocument(url: string): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({ url }).promise;
}

/** Texto do PDF inteiro, uma linha por elemento (as páginas em sequência). */
export async function extractPdfLines(data: ArrayBuffer): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  try {
    const lines: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      lines.push(...textItemsToLines(content.items.filter((item) => 'str' in item)));
    }
    return lines;
  } finally {
    void doc.destroy();
  }
}

export interface PageSize {
  width: number;
  height: number;
}

/** Tamanho de cada página em escala 1 (para reservar o espaço antes de desenhar). */
export async function readPageSizes(doc: PDFDocumentProxy): Promise<PageSize[]> {
  const sizes: PageSize[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const viewport = (await doc.getPage(n)).getViewport({ scale: 1 });
    sizes.push({ width: viewport.width, height: viewport.height });
  }
  return sizes;
}

/**
 * Desenha a página no canvas e monta a camada de texto por cima (permite selecionar e copiar
 * trechos para o caderno). Devolve uma função que cancela o desenho em andamento.
 */
export function renderPdfPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  textLayerDiv: HTMLDivElement,
  scale: number
): () => void {
  let cancelled = false;
  let renderTask: RenderTask | null = null;
  let textLayer: { cancel: () => void } | null = null;

  void (async () => {
    const { TextLayer } = await loadPdfJs();
    if (cancelled) return;

    const viewport = page.getViewport({ scale });
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    renderTask = page.render({
      canvas,
      viewport,
      transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
    });

    textLayerDiv.replaceChildren();
    const layer = new TextLayer({ textContentSource: page.streamTextContent(), container: textLayerDiv, viewport });
    textLayer = layer;

    try {
      await Promise.all([renderTask.promise, layer.render()]);
    } catch {
      // Cancelado por troca de zoom ou porque a página saiu da tela
    }
  })();

  return () => {
    cancelled = true;
    renderTask?.cancel();
    textLayer?.cancel();
  };
}
