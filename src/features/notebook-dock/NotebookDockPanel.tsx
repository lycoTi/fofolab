import { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  FolderOpen,
  PenLine,
  Save,
  Search,
  X,
} from 'lucide-react';
import type { Notebook, PdfSource, Subject, Topic } from '../../types/database';

interface NotebookDockPanelProps {
  currentSubject: Subject | null;
  currentTopic: Topic | null;
  notebook: Notebook | null;
  notebookDraft: string;
  onChangeNotebookDraft: (value: string) => void;
  onSaveNotebook: () => void;
  allNotebooks: Notebook[];
  pdfSource: PdfSource | null;
  onSavePdfProgress: (params: {
    title: string;
    filePath: string;
    currentPage: number;
    totalPages: number;
  }) => void;
  onJumpToTopic: (subjectId: string, topicId: string) => void;
  onCloseDock?: () => void;
}

export function NotebookDockPanel({
  currentSubject,
  currentTopic,
  notebook,
  notebookDraft,
  onChangeNotebookDraft,
  onSaveNotebook,
  allNotebooks,
  pdfSource,
  onSavePdfProgress,
  onJumpToTopic,
  onCloseDock,
}: NotebookDockPanelProps) {
  const [subTab, setSubTab] = useState<'editor' | 'search' | 'pdf'>('editor');
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [savedBadge, setSavedBadge] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);

  const matchingNotebooks = allNotebooks.filter((nb) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      nb.title.toLowerCase().includes(q) || nb.content_markdown.toLowerCase().includes(q)
    );
  });

  const currentPage = pdfSource?.current_page ?? 1;
  const totalPages = pdfSource?.total_pages ?? 40;

  return (
    <section
      aria-label="Painel Lateral de Caderno e PDF"
      className="w-96 border-l border-slate-800 bg-slate-900/60 flex flex-col shrink-0 h-full"
    >
      {/* Cabeçalho do Dock */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('editor')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              subTab === 'editor'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen size={13} />
            Caderno
          </button>
          <button
            type="button"
            onClick={() => setSubTab('search')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              subTab === 'search'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search size={13} />
            Buscar ({allNotebooks.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('pdf')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              subTab === 'pdf'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText size={13} />
            PDF ({currentPage}/{totalPages})
          </button>
        </div>

        {onCloseDock && (
          <button
            type="button"
            onClick={onCloseDock}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Recolher Caderno Lateral"
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
              <p className="text-[11px] text-slate-400 truncate">
                {currentSubject?.name || 'Disciplina'}
              </p>
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
              {notebookDraft}
            </div>
          ) : (
            <textarea
              value={notebookDraft}
              onChange={(e) => onChangeNotebookDraft(e.target.value)}
              aria-label="Conteúdo do caderno do tópico"
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
                <p className="text-[11px] text-slate-400 line-clamp-3 whitespace-pre-line">
                  {nb.content_markdown}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Aba 3: Leitor de PDF Integrado & Marcador de Página */}
      {subTab === 'pdf' && (
        <div className="flex-1 flex flex-col p-4 space-y-3 overflow-hidden">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
            <div className="font-semibold text-white truncate">
              📄 {pdfSource?.title || `PDF — ${currentTopic?.title || 'Tópico'}`}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">
                Página <strong className="text-white">{currentPage}</strong> de{' '}
                <strong className="text-white">{totalPages}</strong>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    onSavePdfProgress({
                      title: pdfSource?.title || `Material ${currentTopic?.code || ''}`,
                      filePath: pdfSource?.file_path || 'local.pdf',
                      currentPage: Math.max(1, currentPage - 1),
                      totalPages,
                    })
                  }
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200 hover:border-slate-700"
                >
                  -1 pág
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSavePdfProgress({
                      title: pdfSource?.title || `Material ${currentTopic?.code || ''}`,
                      filePath: pdfSource?.file_path || 'local.pdf',
                      currentPage: Math.min(totalPages, currentPage + 1),
                      totalPages,
                    })
                  }
                  className="px-2 py-1 rounded bg-orange-500/20 border border-orange-500/40 text-orange-300 font-semibold"
                >
                  +1 pág lida
                </button>
              </div>
            </div>

            <label className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer transition">
              <FolderOpen size={13} className="text-orange-400" />
              <span>Abrir arquivo .PDF do computador</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const blobUrl = URL.createObjectURL(file);
                  setLocalPdfUrl(blobUrl);
                  onSavePdfProgress({
                    title: file.name,
                    filePath: file.name,
                    currentPage: 1,
                    totalPages,
                  });
                }}
              />
            </label>
          </div>

          {localPdfUrl ? (
            <iframe
              src={`${localPdfUrl}#page=${currentPage}`}
              title="Leitor de PDF Local"
              className="flex-1 w-full rounded-xl border border-slate-800 bg-slate-950"
            />
          ) : (
            <div className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex flex-col items-center justify-center text-center text-xs text-slate-400 space-y-2">
              <FileText size={24} className="text-slate-600" />
              <p>
                Seu marcador está salvo na página <strong>{currentPage}</strong> de{' '}
                <strong>{totalPages}</strong>.
              </p>
              <p className="text-[11px] text-slate-500">
                Clique em "Abrir arquivo .PDF do computador" acima para ler o PDF lado a lado com
                as questões!
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

