import {
  BookOpen,
  CheckCircle2,
  Circle,
  Expand,
  FolderOpen,
  Maximize2,
  Minimize2,
  NotebookPen,
  Shrink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { SECONDS_TO_COUNT_PAGE_AS_READ } from './readProgress';

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
    <div
      className="flex items-center gap-2 text-[11px] text-slate-400"
      title={`Uma página conta como lida depois de ${SECONDS_TO_COUNT_PAGE_AS_READ} segundos na tela`}
    >
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

function toggleClass(active: boolean, activeColors: string): string {
  const colors = active ? activeColors : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600';
  return `px-2 py-1 rounded-lg border flex items-center gap-1 ${colors}`;
}

export interface PdfPageNavigation {
  totalPages: number;
  pageInput: string;
  onPageInputChange: (value: string) => void;
  onCommitPageInput: () => void;
  currentPageRead: boolean;
  onToggleCurrentPageRead: () => void;
  zoomPercent: number;
  canZoomOut: boolean;
  canZoomIn: boolean;
  onZoom: (direction: -1 | 0 | 1) => void;
}

/** Barra do leitor: título e progresso à esquerda; página, zoom e modos de tela à direita. */
export function PdfReaderToolbar({
  title,
  subtitle,
  progress,
  navigation,
  onOpenFile,
  notebookVisible,
  onToggleNotebook,
  maximized,
  onToggleMaximized,
  fullscreen,
  onToggleFullscreen,
}: {
  title: string;
  /** Mostrado no lugar do progresso quando ainda não há PDF no tópico. */
  subtitle: string;
  progress: { readCount: number; totalPages: number } | null;
  /** Só existe com um arquivo aberto. */
  navigation: PdfPageNavigation | null;
  onOpenFile: ((file: File) => void) | null;
  notebookVisible: boolean;
  onToggleNotebook?: () => void;
  maximized: boolean;
  onToggleMaximized?: () => void;
  fullscreen: boolean;
  onToggleFullscreen?: () => void;
}) {
  return (
    <div className="px-3 py-2.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 space-y-1">
        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
          <BookOpen size={14} className="text-orange-400 shrink-0" />
          {title}
        </div>
        {progress ? (
          <ReadProgressBar readCount={progress.readCount} totalPages={progress.totalPages} />
        ) : (
          <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {navigation && (
          <>
            <span className="text-slate-400">Página</span>
            <input
              value={navigation.pageInput}
              onChange={(e) => navigation.onPageInputChange(e.target.value.replace(/\D/g, ''))}
              onBlur={navigation.onCommitPageInput}
              onKeyDown={(e) => e.key === 'Enter' && navigation.onCommitPageInput()}
              inputMode="numeric"
              aria-label="Ir para a página"
              className="w-12 px-1.5 py-1 rounded bg-slate-950 border border-slate-800 text-white text-center focus:border-orange-500 outline-none"
            />
            <span className="text-slate-400">de {navigation.totalPages}</span>
            <button
              type="button"
              onClick={navigation.onToggleCurrentPageRead}
              aria-pressed={navigation.currentPageRead}
              title={
                navigation.currentPageRead
                  ? 'Desmarcar esta página como lida'
                  : `Marcar como lida agora (sozinha, ela conta depois de ${SECONDS_TO_COUNT_PAGE_AS_READ} s na tela)`
              }
              className={`ml-1 ${toggleClass(navigation.currentPageRead, 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300')}`}
            >
              {navigation.currentPageRead ? <CheckCircle2 size={12} /> : <Circle size={12} />}
              {navigation.currentPageRead ? 'Página lida' : 'Marcar lida'}
            </button>

            <span className="w-px h-5 bg-slate-800 mx-1" />
            <button
              type="button"
              onClick={() => navigation.onZoom(-1)}
              disabled={!navigation.canZoomOut}
              className={toolButtonClass}
              aria-label="Diminuir zoom"
              title="Diminuir zoom"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              onClick={() => navigation.onZoom(0)}
              className="w-12 text-center text-[11px] text-slate-300 hover:text-white"
              title="Voltar ao tamanho padrão"
            >
              {navigation.zoomPercent}%
            </button>
            <button
              type="button"
              onClick={() => navigation.onZoom(1)}
              disabled={!navigation.canZoomIn}
              className={toolButtonClass}
              aria-label="Aumentar zoom"
              title="Aumentar zoom"
            >
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
            className={toggleClass(notebookVisible, 'bg-orange-500/15 border-orange-500/40 text-orange-300')}
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
        {onOpenFile && <PdfFilePicker onOpenFile={onOpenFile} compact />}
      </div>
    </div>
  );
}
