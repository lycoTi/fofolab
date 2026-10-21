import { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Maximize2,
  PenLine,
  Save,
  Search,
  X,
} from 'lucide-react';
import type { Notebook, PdfSource, Subject, Topic } from '../../types/database';
import type { NotebookDraftStatus } from './useNotebookDraft';
import { PdfFilePicker, PdfFrame, PdfPageControls, type PdfProgressUpdate } from './PdfReader';

interface NotebookDockPanelProps {
  width?: number;
  currentSubject: Subject | null;
  currentTopic: Topic | null;
  notebook: Notebook | null;
  notebookDraft: string;
  onChangeNotebookDraft: (value: string) => void;
  onSaveNotebook: () => void;
  draftStatus?: NotebookDraftStatus;
  allNotebooks: Notebook[];
  pdfSource: PdfSource | null;
  pdfFileUrl?: string | null;
  onOpenPdfFile?: (file: File) => void;
  onSavePdfProgress: (update: PdfProgressUpdate) => void;
  /** Abre o PDF no palco central, em tela grande. */
  onOpenReader?: () => void;
  onJumpToTopic: (subjectId: string, topicId: string) => void;
  onCloseDock?: () => void;
}

function DraftStatusBadge({ status }: { status: NotebookDraftStatus }) {
  if (status === 'pending') {
    return (
      <span className="text-[10px] text-slate-400 flex items-center gap-1">
        <Loader2 size={11} className="animate-spin" />
        Salvando…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="text-[10px] text-emerald-300/90 flex items-center gap-1">
        <CheckCircle2 size={11} />
        Salvo automaticamente
      </span>
    );
  }
  return null;
}

export function NotebookDockPanel({
  width = 384,
  currentSubject,
  currentTopic,
  notebook,
  notebookDraft,
  onChangeNotebookDraft,
  onSaveNotebook,
  draftStatus = 'idle',
  allNotebooks,
  pdfSource,
  pdfFileUrl = null,
  onOpenPdfFile,
  onSavePdfProgress,
  onOpenReader,
  onJumpToTopic,
  onCloseDock,
}: NotebookDockPanelProps) {
  const [subTab, setSubTab] = useState<'editor' | 'search' | 'pdf'>('editor');
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [savedBadge, setSavedBadge] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const matchingNotebooks = allNotebooks.filter((nb) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return nb.title.toLowerCase().includes(q) || nb.content_markdown.toLowerCase().includes(q);
  });

  const pdfTabLabel = pdfSource ? `PDF (${pdfSource.current_page}/${pdfSource.total_pages})` : 'PDF';

  return (
    <section
      aria-label="Painel Lateral de Caderno e PDF"
      style={{ width }}
      className="border-l border-slate-800 bg-slate-900/60 flex flex-col shrink-0 h-full min-w-0"
    >
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'editor', label: 'Caderno', icon: BookOpen },
              { id: 'search', label: `Buscar (${allNotebooks.length})`, icon: Search },
              { id: 'pdf', label: pdfTabLabel, icon: FileText },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                  subTab === tab.id
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {onCloseDock && (
          <button
            type="button"
            onClick={onCloseDock}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Recolher Caderno Lateral"
            aria-label="Recolher Caderno Lateral"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Aba 1: Editor / Leitura do Caderno do Tópico */}
      {subTab === 'editor' && (
        <div className="flex-1 flex flex-col p-4 space-y-3 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate">
              <h3 className="text-xs font-bold text-white truncate">
                📓 {notebook?.title || `Caderno ${currentTopic?.code || ''} — ${currentTopic?.title || ''}`}
              </h3>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-slate-400 truncate">{currentSubject?.name || 'Disciplina'}</p>
                <DraftStatusBadge status={draftStatus} />
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewMode((p) => !p)}
                className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 hover:border-slate-700 flex items-center gap-1"
              >
                {previewMode ? <PenLine size={12} /> : <Eye size={12} />}
                {previewMode ? 'Editar' : 'Leitura'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSaveNotebook();
                  setSavedBadge(true);
                  setTimeout(() => setSavedBadge(false), 2500);
                }}
                className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1"
              >
                <Save size={12} />
                Salvar Caderno
              </button>
            </div>
          </div>

          {savedBadge && (
            <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              Caderno salvo com sucesso!
            </div>
          )}

          {previewMode ? (
            <div className="flex-1 overflow-y-auto p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
              {notebookDraft || <span className="text-slate-500">Caderno vazio por enquanto.</span>}
            </div>
          ) : (
            <textarea
              value={notebookDraft}
              onChange={(e) => onChangeNotebookDraft(e.target.value)}
              aria-label="Conteúdo do caderno do tópico"
              placeholder="Anote seus resumos, mnemônicos e jurisprudências aqui... (salva sozinho)"
              className="flex-1 w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:border-orange-500 outline-none leading-relaxed resize-none"
            />
          )}
        </div>
      )}

      {/* Aba 2: Busca Instantânea em todos os Cadernos */}
      {subTab === 'search' && (
        <div className="flex-1 flex flex-col p-4 space-y-3 overflow-hidden">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar termo nos seus cadernos..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-orange-500 outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {matchingNotebooks.map((nb) => (
              <button
                key={nb.id}
                type="button"
                onClick={() => {
                  if (nb.topic_id) {
                    onJumpToTopic(nb.subject_id, nb.topic_id);
                    setSubTab('editor');
                  }
                }}
                className="w-full text-left p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-orange-500/40 space-y-1 transition"
              >
                <div className="text-xs font-bold text-orange-300 truncate">{nb.title}</div>
                <p className="text-[11px] text-slate-400 line-clamp-3 whitespace-pre-line">{nb.content_markdown}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Aba 3: Leitor de PDF (compacto) + atalho para a tela grande */}
      {subTab === 'pdf' && (
        <div className="flex-1 flex flex-col p-4 space-y-3 overflow-hidden">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
            <div className="font-semibold text-white truncate">
              📄 {pdfSource?.title || `PDF — ${currentTopic?.title || 'Tópico'}`}
            </div>
            {pdfSource && <PdfPageControls pdfSource={pdfSource} onChange={onSavePdfProgress} />}
            {onOpenPdfFile && <PdfFilePicker onOpenFile={onOpenPdfFile} />}
            {onOpenReader && (
              <button
                type="button"
                onClick={onOpenReader}
                className="w-full py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold flex items-center justify-center gap-1.5"
              >
                <Maximize2 size={13} />
                Ler em tela grande
              </button>
            )}
          </div>

          {pdfFileUrl ? (
            <PdfFrame fileUrl={pdfFileUrl} page={pdfSource?.current_page ?? 1} title="Leitor de PDF Local" />
          ) : (
            <div className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col items-center justify-center text-center text-xs text-slate-400 space-y-2">
              <FileText size={24} className="text-slate-600" />
              {pdfSource ? (
                <p>
                  Seu marcador está salvo na página <strong>{pdfSource.current_page}</strong> de{' '}
                  <strong>{pdfSource.total_pages}</strong>.
                </p>
              ) : (
                <p>Nenhum PDF vinculado a este tópico ainda.</p>
              )}
              <p className="text-[11px] text-slate-500">
                Abra o arquivo do seu computador para ler aqui ou em tela grande, ao lado das questões e do caderno.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
