import { memo, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdfDocument, readPageSizes, renderPdfPage, type PageSize } from './pdfDocument';

const PAGE_GAP_PX = 16;
const SIDE_PADDING_PX = 16;
// Em 100%, a página ocupa a largura do leitor até este limite (maximizado, mais largo fica cansativo)
const MAX_FIT_WIDTH_PX = 1000;

export interface PageJumpRequest {
  page: number;
  /** Muda a cada pedido, para repetir o salto para a mesma página. */
  nonce: number;
}

const PdfPage = memo(function PdfPage({
  doc,
  pageNumber,
  size,
  scale,
  shouldRender,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  size: PageSize;
  scale: number;
  shouldRender: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const textLayer = textLayerRef.current;
    if (!shouldRender || !canvas || !textLayer) return;
    let cancelRender: (() => void) | null = null;
    let disposed = false;
    void doc.getPage(pageNumber).then((page) => {
      if (!disposed) cancelRender = renderPdfPage(page, canvas, textLayer, scale);
    });
    return () => {
      disposed = true;
      cancelRender?.();
      // Libera a memória do desenho quando a página sai de perto da tela
      canvas.width = 0;
      canvas.height = 0;
      textLayer.replaceChildren();
    };
  }, [doc, pageNumber, scale, shouldRender]);

  return (
    <div
      data-page-number={pageNumber}
      aria-label={`Página ${pageNumber}`}
      className="relative mx-auto bg-white shadow-lg shadow-black/40"
      style={
        {
          width: size.width * scale,
          height: size.height * scale,
          '--total-scale-factor': scale,
        } as React.CSSProperties
      }
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div ref={textLayerRef} className="textLayer" />
    </div>
  );
});

/**
 * Leitor de PDF desenhado pelo próprio app (pdf.js), em rolagem contínua. Diferente do leitor
 * embutido do navegador, ele sabe o total de páginas e qual página está na tela, o que permite
 * marcar o progresso sozinho.
 */
export function PdfDocumentViewer({
  fileUrl,
  initialPage,
  zoom,
  jumpRequest,
  onLoaded,
  onLoadError,
  onVisiblePageChange,
}: {
  fileUrl: string;
  initialPage: number;
  /** 1 = página na largura do leitor (até {@link MAX_FIT_WIDTH_PX}). */
  zoom: number;
  jumpRequest: PageJumpRequest | null;
  onLoaded: (numPages: number) => void;
  onLoadError: () => void;
  onVisiblePageChange: (page: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [nearPages, setNearPages] = useState<Set<number>>(new Set());
  const initialScrollDone = useRef(false);
  const callbacks = useRef({ onLoaded, onLoadError, onVisiblePageChange });
  callbacks.current = { onLoaded, onLoadError, onVisiblePageChange };

  useEffect(() => {
    let disposed = false;
    let loaded: PDFDocumentProxy | null = null;
    initialScrollDone.current = false;
    setDoc(null);
    setSizes([]);
    loadPdfDocument(fileUrl)
      .then(async (pdf) => {
        loaded = pdf;
        const pageSizes = await readPageSizes(pdf);
        if (disposed) return;
        setSizes(pageSizes);
        setDoc(pdf);
        callbacks.current.onLoaded(pdf.numPages);
      })
      .catch(() => {
        if (!disposed) callbacks.current.onLoadError();
      });
    return () => {
      disposed = true;
      void loaded?.destroy();
    };
  }, [fileUrl]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const widestPage = sizes.reduce((max, s) => Math.max(max, s.width), 0);
  const fitWidth = Math.min(availableWidth - SIDE_PADDING_PX * 2, MAX_FIT_WIDTH_PX);
  const scale = widestPage && fitWidth > 0 ? (fitWidth / widestPage) * zoom : 0;
  const ready = doc !== null && scale > 0;

  const pageElement = (page: number) =>
    scrollRef.current?.querySelector<HTMLElement>(`[data-page-number="${page}"]`) ?? null;

  // Volta para onde o estudante parou, uma vez por arquivo
  useEffect(() => {
    if (!ready || initialScrollDone.current) return;
    const target = pageElement(Math.min(initialPage, sizes.length));
    if (target && scrollRef.current) scrollRef.current.scrollTop = target.offsetTop - PAGE_GAP_PX;
    initialScrollDone.current = true;
  }, [ready, initialPage, sizes.length]);

  useEffect(() => {
    if (!ready || !jumpRequest) return;
    const target = pageElement(Math.min(Math.max(1, jumpRequest.page), sizes.length));
    if (target && scrollRef.current) scrollRef.current.scrollTop = target.offsetTop - PAGE_GAP_PX;
  }, [ready, jumpRequest, sizes.length]);

  // Página atual = a que ocupa mais altura na tela; páginas próximas são desenhadas antes de aparecer
  useEffect(() => {
    const root = scrollRef.current;
    if (!ready || !root) return;
    const pages = [...root.querySelectorAll<HTMLElement>('[data-page-number]')];
    const visibleHeight = new Map<number, number>();
    let lastReported = 0;

    const visibility = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.pageNumber);
          visibleHeight.set(page, entry.isIntersecting ? entry.intersectionRect.height : 0);
        }
        if (!initialScrollDone.current) return;
        let best = 0;
        let bestHeight = 0;
        for (const [page, height] of visibleHeight) {
          if (height > bestHeight || (height === bestHeight && height > 0 && page < best)) {
            best = page;
            bestHeight = height;
          }
        }
        if (best && best !== lastReported) {
          lastReported = best;
          callbacks.current.onVisiblePageChange(best);
        }
      },
      { root, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );

    const nearby = new IntersectionObserver(
      (entries) => {
        setNearPages((previous) => {
          const next = new Set(previous);
          for (const entry of entries) {
            const page = Number((entry.target as HTMLElement).dataset.pageNumber);
            if (entry.isIntersecting) next.add(page);
            else next.delete(page);
          }
          return next;
        });
      },
      { root, rootMargin: '150% 0px' }
    );

    for (const el of pages) {
      visibility.observe(el);
      nearby.observe(el);
    }
    return () => {
      visibility.disconnect();
      nearby.disconnect();
    };
  }, [ready, scale]);

  return (
    <div
      ref={scrollRef}
      data-testid="pdf-scroll"
      className="relative flex-1 min-h-0 overflow-auto rounded-xl border border-slate-800 bg-slate-950"
      style={{ padding: `${PAGE_GAP_PX}px ${SIDE_PADDING_PX}px` }}
    >
      {ready ? (
        <div className="flex flex-col items-center" style={{ gap: PAGE_GAP_PX }}>
          {sizes.map((size, index) => (
            <PdfPage
              key={index + 1}
              doc={doc}
              pageNumber={index + 1}
              size={size}
              scale={scale}
              shouldRender={nearPages.has(index + 1)}
            />
          ))}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin" />
          Abrindo o PDF…
        </div>
      )}
    </div>
  );
}
