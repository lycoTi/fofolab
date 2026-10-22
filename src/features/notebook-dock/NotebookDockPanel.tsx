import { useState } from 'react';
import { RichText } from '../../components/RichText';
import { BookOpen, CheckCircle2, ChevronRight, Eye, FileText, Loader2, PenLine, Save, Search, X } from 'lucide-react';
import type { Notebook, PdfSource, Subject, Topic } from '../../types/database';
import type { NotebookDraftStatus } from './useNotebookDraft';
import { parseReadPages } from '../pdf-reader/readProgress';

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
  /** PDF do tópico: o painel só mostra o progresso; a leitura acontece na aba Leitura de PDF. */
  pdfSource: PdfSource | null;
  /** Abre a aba de leitura (omitido quando ela já está aberta). */
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
  onOpenReader,
  onJumpToTopic,
  onCloseDock,
}: NotebookDockPanelProps) {
  const [subTab, setSubTab] = useState<'editor' | 'search'>('editor');
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [savedBadge, setSavedBadge] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const matchingNotebooks = allNotebooks.filter((nb) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return nb.title.toLowerCase().includes(q) || nb.content_markdown.toLowerCase().includes(q);
  });

  const readPercent = pdfSource
    ? Math.round((parseReadPages(pdfSource.read_pages_json, pdfSource.total_pages).length / pdfSource.total_pages) * 100)
    : 0;

  return (
    <section
      aria-label="Painel Lateral do Caderno"
      style={{ width }}
      className="border-l border-slate-800 bg-slate-900/60 flex flex-col shrink-0 h-full min-w-0"
    >
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'editor', label: 'Caderno', icon: BookOpen },
              { id: 'search', label: `Buscar (${allNotebooks.length})`, icon: Search },
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

      {pdfSource && onOpenReader && (
        <button
          type="button"
          onClick={onOpenReader}
          title="Abrir a leitura do PDF deste tópico"
          className="mx-4 mt-3 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-orange-500/40 text-left flex items-center gap-2 transition"
        >
          <FileText size={14} className="text-orange-400 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold text-slate-200 truncate">{pdfSource.title}</span>
            <span className="block text-[10px] text-slate-400">
              {readPercent}% lido · parou na página {pdfSource.current_page}
            </span>
          </span>
          <span className="text-[11px] text-orange-300 flex items-center shrink-0">
            Continuar leitura
            <ChevronRight size={12} />
          </span>
        </button>
      )}

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
            <div className="flex-1 overflow-y-auto p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed">
              {notebookDraft ? <RichText text={notebookDraft} /> : <span className="text-slate-500">Caderno vazio por enquanto.</span>}
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
    </section>
  );
}
