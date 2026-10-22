import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Expand,
  FileText,
  FolderOpen,
  Maximize2,
  Minimize2,
  NotebookPen,
  Shrink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { PdfSource, Topic } from '../../types/database';
import { PdfDocumentViewer, type PageJumpRequest } from './PdfDocumentViewer';
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

/**
 * O arquivo é aberto do computador do estudante e NUNCA copiado para o banco
 * (política de direitos autorais, docs/specs/02): guardamos só o nome, a página e as páginas lidas.
 * O navegador não informa o caminho completo, então após reiniciar é preciso abrir o arquivo de novo.
 */
export function PdfFilePicker({ onOpenFile, compact = false }: { onOpenFile: (file: File) => void; compact?: boolean }) {
  return (
    <label
      className={`rounded-lg bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition ${
        compact ? 'px-2.5 py-1.5 text-[11px]' : 'w-full py-2 px-3 text-xs'
      }`}
    >
      <FolderOpen size={13} className="text-orange-400" />
      <span>{compact ? 'Abrir outro PDF' : 'Abrir arquivo .PDF do computador'}</span>
      <input
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        aria-label="Escolher arquivo PDF"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onOpenFile(file);
        }}
      />
    </label>
  );
}

function ReadProgressBar({ readCount, totalPages }: { readCount: number; totalPages: number }) {
  const percent = totalPages > 0 ? Math.round((readCount / totalPages) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-400" title={`Uma página conta como lida depois de ${SECONDS_TO_COUNT_PAGE_AS_READ} segundos na tela`}>
      <div
        role="progressbar"
        aria-label="Páginas lidas"
        aria-valuemin={0}
        aria-valuemax={totalPages}
        aria-valuenow={readCount}
        className="w-28 h-1.5 rounded-full bg-slate-800 overflow-hidden"
      >
        <div className="h-full bg-emerald-400" style={{ width: `${percent}%` }} />
      </div>
      <span>
        {readCount} de {totalPages} páginas lidas · {percent}%
      </span>
    </div>
  );
}

const toolButtonClass =
  'p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white disabled:opacity-40';

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

  const changeZoom = (direction: 1 | -1) => {
    const index = ZOOM_STEPS.findIndex((step) => step >= zoom - 0.001);
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, index + direction))];
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
      <div className="px-3 py-2.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
            <BookOpen size={14} className="text-orange-400 shrink-0" />
            {pdfSource?.title ?? pdfFileName ?? `PDF — ${currentTopic?.title ?? 'Tópico'}`}
          </div>
          {pdfSource ? (
            <ReadProgressBar readCount={readPages.length} totalPages={totalPages} />
          ) : (
            <p className="text-[11px] text-slate-400 truncate">
              {currentTopic ? `Tópico ${currentTopic.code ?? ''} ${currentTopic.title}` : 'Selecione um tópico'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {showingFile && pdfSource && (
            <>
              <span className="text-slate-400">Página</span>
              <input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
                onBlur={commitPageInput}
                onKeyDown={(e) => e.key === 'Enter' && commitPageInput()}
                inputMode="numeric"
                aria-label="Ir para a página"
                className="w-12 px-1.5 py-1 rounded bg-slate-950 border border-slate-800 text-white text-center focus:border-orange-500 outline-none"
              />
              <span className="text-slate-400">de {totalPages}</span>
              <button
                type="button"
                onClick={toggleCurrentPageRead}
                aria-pressed={currentPageRead}
                title={
                  currentPageRead
                    ? 'Desmarcar esta página como lida'
                    : `Marcar como lida agora (sozinha, ela conta depois de ${SECONDS_TO_COUNT_PAGE_AS_READ} s na tela)`
                }
                className={`ml-1 px-2 py-1 rounded-lg border flex items-center gap-1 ${
                  currentPageRead
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                {currentPageRead ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                {currentPageRead ? 'Página lida' : 'Marcar lida'}
              </button>

              <span className="w-px h-5 bg-slate-800 mx-1" />
              <button type="button" onClick={() => changeZoom(-1)} disabled={zoom <= ZOOM_STEPS[0]} className={toolButtonClass} aria-label="Diminuir zoom" title="Diminuir zoom">
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  jumpTo(visiblePage);
                }}
                className="w-12 text-center text-[11px] text-slate-300 hover:text-white"
                title="Voltar ao tamanho padrão"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" onClick={() => changeZoom(1)} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} className={toolButtonClass} aria-label="Aumentar zoom" title="Aumentar zoom">
                <ZoomIn size={13} />
              </button>
            </>
          )}

          <span className="w-px h-5 bg-slate-800 mx-1" />
          {onToggleNotebook && (
            <button
              type="button"
              onClick={onToggleNotebook}
              aria-pressed={notebookVisible}
              className={`px-2 py-1 rounded-lg border flex items-center gap-1 ${
                notebookVisible
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
              title="Mostrar ou esconder o caderno ao lado"
            >
              <NotebookPen size={12} />
              Caderno
            </button>
          )}
          {onToggleMaximized && (
            <button
              type="button"
              onClick={onToggleMaximized}
              className={toolButtonClass}
              aria-label={maximized ? 'Restaurar tamanho' : 'Maximizar leitura'}
              title={maximized ? 'Restaurar (Esc)' : 'Maximizar: esconde menus e painéis'}
            >
              {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className={toolButtonClass}
              aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              title={fullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
            >
              {fullscreen ? <Shrink size={13} /> : <Expand size={13} />}
            </button>
          )}
          {showingFile && <PdfFilePicker onOpenFile={onOpenFile} compact />}
        </div>
      </div>

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
          {loadFailed ? (
            <p>Não consegui abrir este arquivo. Confira se ele é um PDF válido e tente outro.</p>
          ) : pdfSource ? (
            <p>
              Você parou na página <strong>{pdfSource.current_page}</strong> de <strong>{pdfSource.title}</strong>. Abra o
              mesmo arquivo para continuar de onde parou.
            </p>
          ) : (
            <p>Abra o PDF do seu material para ler aqui, com o caderno ao lado.</p>
          )}
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
