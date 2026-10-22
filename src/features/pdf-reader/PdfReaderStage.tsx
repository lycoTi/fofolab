import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import type { PdfSource, Topic } from '../../types/database';
import { PdfDocumentViewer, type PageJumpRequest } from './PdfDocumentViewer';
import { PdfFilePicker, PdfReaderToolbar } from './PdfReaderToolbar';
import { parseReadPages, SECONDS_TO_COUNT_PAGE_AS_READ, usePageReadTimer, withPageRead } from './readProgress';

export interface PdfProgressUpdate {
  /** Registro exibido que deve ser atualizado (omitido ao abrir outro arquivo). */
  pdfSourceId?: string | null;
  title: string;
  filePath: string;
  currentPage: number;
  totalPages: number;
  readPages?: number[];
}

const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SAVE_PAGE_DELAY_MS = 800;

function emptyStateMessage(loadFailed: boolean, pdfSource: PdfSource | null) {
  if (loadFailed) return <p>Não consegui abrir este arquivo. Confira se ele é um PDF válido e tente outro.</p>;
  if (!pdfSource) return <p>Abra o PDF do seu material para ler aqui, com o caderno ao lado.</p>;
  return (
    <p>
      Você parou na página <strong>{pdfSource.current_page}</strong> de <strong>{pdfSource.title}</strong>. Abra o
      mesmo arquivo para continuar de onde parou.
    </p>
  );
}

/** Leitura do PDF no palco central, com progresso marcado sozinho e modos ampliados. */
export function PdfReaderStage({
  currentTopic,
  pdfSource,
  pdfFileUrl,
  pdfFileName,
  onOpenFile,
  onSaveProgress,
  maximized = false,
  onToggleMaximized,
  fullscreen = false,
  onToggleFullscreen,
  notebookVisible = false,
  onToggleNotebook,
}: {
  currentTopic: Topic | null;
  pdfSource: PdfSource | null;
  pdfFileUrl: string | null;
  pdfFileName: string | null;
  onOpenFile: (file: File) => void;
  onSaveProgress: (update: PdfProgressUpdate) => void;
  maximized?: boolean;
  onToggleMaximized?: () => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  notebookVisible?: boolean;
  onToggleNotebook?: () => void;
}) {
  const showingFile = pdfFileUrl !== null;
  const totalPages = pdfSource?.total_pages ?? 1;
  const readPages = pdfSource ? parseReadPages(pdfSource.read_pages_json, totalPages) : [];

  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [visiblePage, setVisiblePage] = useState(pdfSource?.current_page ?? 1);
  const [pageInput, setPageInput] = useState(String(visiblePage));
  const [zoom, setZoom] = useState(1);
  const [jumpRequest, setJumpRequest] = useState<PageJumpRequest | null>(null);

  const latest = useRef({ pdfSource, onSaveProgress });
  latest.current = { pdfSource, onSaveProgress };
  // Guarda de qual PDF é a página pendente: ao trocar de tópico ela não pode ir para o PDF novo
  const pendingPage = useRef<{ sourceId: string; page: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = (changes: Partial<Pick<PdfProgressUpdate, 'currentPage' | 'totalPages' | 'readPages'>>) => {
    const source = latest.current.pdfSource;
    if (!source) return;
    latest.current.onSaveProgress({
      pdfSourceId: source.id,
      title: source.title,
      filePath: source.file_path,
      currentPage: source.current_page,
      totalPages: source.total_pages,
      ...changes,
    });
  };

  const flushPageSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const pending = pendingPage.current;
    pendingPage.current = null;
    const source = latest.current.pdfSource;
    if (pending && source?.id === pending.sourceId && pending.page !== source.current_page) {
      save({ currentPage: pending.page });
    }
  };

  // Outro arquivo: recomeça do marcador salvo
  useEffect(() => {
    setLoaded(false);
    setLoadFailed(false);
    setVisiblePage(pdfSource?.current_page ?? 1);
  }, [pdfFileUrl]);

  useEffect(() => setPageInput(String(visiblePage)), [visiblePage]);

  // Grava a página onde parou ao trocar de aba/tópico
  useEffect(() => () => flushPageSave(), []);

  const readTimer = usePageReadTimer({
    enabled: showingFile && loaded,
    currentPage: visiblePage,
    readPages,
    onPageRead: (page) => save({ readPages: withPageRead(readPages, page, true) }),
  });

  const handleVisiblePageChange = (page: number) => {
    setVisiblePage(page);
    const sourceId = latest.current.pdfSource?.id;
    if (!sourceId) return;
    pendingPage.current = { sourceId, page };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushPageSave, SAVE_PAGE_DELAY_MS);
  };

  const handleLoaded = (numPages: number) => {
    setLoaded(true);
    if (latest.current.pdfSource && numPages !== latest.current.pdfSource.total_pages) save({ totalPages: numPages });
  };

  const jumpTo = (page: number) => setJumpRequest({ page, nonce: Date.now() });

  const commitPageInput = () => {
    const page = Math.max(1, Math.min(totalPages, Number(pageInput) || visiblePage));
    setPageInput(String(page));
    if (page !== visiblePage) jumpTo(page);
  };

  /** -1 diminui, 1 aumenta, 0 volta ao tamanho padrão. */
  const changeZoom = (direction: -1 | 0 | 1) => {
    const index = ZOOM_STEPS.findIndex((step) => step >= zoom - 0.001);
    const next = direction === 0 ? 1 : ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, index + direction))];
    setZoom(next);
    // Mantém a mesma página na tela depois de mudar o tamanho
    jumpTo(visiblePage);
  };

  const currentPageRead = readPages.includes(visiblePage);
  const toggleCurrentPageRead = () => {
    if (currentPageRead) readTimer.suppress(visiblePage);
    save({ readPages: withPageRead(readPages, visiblePage, !currentPageRead) });
  };

  return (
    <section aria-label="Leitura de PDF" className="h-full flex flex-col gap-3 min-h-0">
      <PdfReaderToolbar
        title={pdfSource?.title ?? pdfFileName ?? `PDF — ${currentTopic?.title ?? 'Tópico'}`}
        subtitle={currentTopic ? `Tópico ${currentTopic.code ?? ''} ${currentTopic.title}` : 'Selecione um tópico'}
        progress={pdfSource ? { readCount: readPages.length, totalPages } : null}
        navigation={
          showingFile && pdfSource
            ? {
                totalPages,
                pageInput,
                onPageInputChange: setPageInput,
                onCommitPageInput: commitPageInput,
                currentPageRead,
                onToggleCurrentPageRead: toggleCurrentPageRead,
                zoomPercent: Math.round(zoom * 100),
                canZoomOut: zoom > ZOOM_STEPS[0],
                canZoomIn: zoom < ZOOM_STEPS[ZOOM_STEPS.length - 1],
                onZoom: changeZoom,
              }
            : null
        }
        onOpenFile={showingFile ? onOpenFile : null}
        notebookVisible={notebookVisible}
        onToggleNotebook={onToggleNotebook}
        maximized={maximized}
        onToggleMaximized={onToggleMaximized}
        fullscreen={fullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />

      {showingFile && !loadFailed ? (
        <PdfDocumentViewer
          fileUrl={pdfFileUrl}
          initialPage={pdfSource?.current_page ?? 1}
          zoom={zoom}
          jumpRequest={jumpRequest}
          onLoaded={handleLoaded}
          onLoadError={() => setLoadFailed(true)}
          onVisiblePageChange={handleVisiblePageChange}
        />
      ) : (
        <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/60 p-8 flex flex-col items-center justify-center text-center text-xs text-slate-400 gap-3">
          <FileText size={28} className="text-slate-600" />
          {emptyStateMessage(loadFailed, pdfSource)}
          <p className="text-[11px] text-slate-500 max-w-md">
            O app acompanha sozinho a página em que você está e marca como lida cada página que fica{' '}
            {SECONDS_TO_COUNT_PAGE_AS_READ} segundos na tela.
          </p>
          <div className="w-72">
            <PdfFilePicker onOpenFile={onOpenFile} />
          </div>
        </div>
      )}
    </section>
  );
}
