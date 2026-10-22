import { useState } from 'react';
import { FileUp, Loader2, X } from 'lucide-react';
import { parseEdital, type ParsedEdital } from '../../lib/editalParser';
import type { EditalPlanInput } from '../../types/database';
import { extractPdfLines } from '../pdf-reader/pdfDocument';
import { createEditalDraft, draftToPlanInput, roleNeedsChoice, type EditalDraft } from './editalDraft';
import { EditalPreview } from './EditalPreview';

type ImportState =
  | { phase: 'idle' }
  | { phase: 'reading'; fileName: string }
  | { phase: 'failed'; message: string }
  | { phase: 'preview'; edital: ParsedEdital; roleNumber: number | null; draft: EditalDraft | null };

/**
 * Importar edital em PDF (docs/specs/07): lê o texto no próprio computador, mostra a prévia
 * editável e só grava quando o estudante confirma.
 */
export function EditalImportModal({
  isOpen,
  weeklyHoursTarget,
  onClose,
  onCreatePlan,
}: {
  isOpen: boolean;
  weeklyHoursTarget: number;
  onClose: () => void;
  onCreatePlan: (input: EditalPlanInput) => void;
}) {
  const [state, setState] = useState<ImportState>({ phase: 'idle' });

  if (!isOpen) return null;

  const close = () => {
    setState({ phase: 'idle' });
    onClose();
  };

  const readFile = async (file: File) => {
    setState({ phase: 'reading', fileName: file.name });
    try {
      const edital = parseEdital(await extractPdfLines(await file.arrayBuffer()));
      if (edital.parts.length === 0 && edital.commonSubjects.length === 0) {
        setState({
          phase: 'failed',
          message:
            'Não reconheci as provas nem o conteúdo programático deste arquivo. Por enquanto o FofoLab entende editais no modelo Cebraspe; você ainda pode colar o conteúdo em "Edital Verticalizado".',
        });
        return;
      }
      const roleNumber = roleNeedsChoice(edital) ? null : (edital.roles[0]?.number ?? null);
      const draft = roleNeedsChoice(edital) ? null : createEditalDraft(edital, roleNumber, weeklyHoursTarget);
      setState({ phase: 'preview', edital, roleNumber, draft });
    } catch {
      setState({ phase: 'failed', message: 'Não consegui ler este PDF. Confira se é o edital (com texto, não uma foto digitalizada).' });
    }
  };

  const chooseRole = (roleNumber: number) => {
    if (state.phase !== 'preview') return;
    setState({ ...state, roleNumber, draft: createEditalDraft(state.edital, roleNumber, weeklyHoursTarget) });
  };

  const canCreate = state.phase === 'preview' && state.draft !== null && state.draft.title.trim() !== '' && state.draft.subjects.length > 0;

  return (
    <div role="dialog" aria-modal="true" aria-label="Importar edital" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-slate-100">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileUp size={16} className="text-orange-400" />
              Importar edital em PDF
            </h2>
            <p className="text-xs text-slate-400">Confira o que foi lido antes de criar o plano. Nada é gravado sem você confirmar.</p>
          </div>
          <button type="button" onClick={close} aria-label="Fechar importação" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {state.phase !== 'preview' && (
            <label className="block p-6 rounded-xl border border-dashed border-slate-700 hover:border-orange-500/50 text-center cursor-pointer transition">
              <span className="block text-xs text-slate-300">Escolha o PDF do edital no seu computador</span>
              <span className="block text-[11px] text-slate-500 mt-1">O arquivo é lido aqui mesmo e não é guardado pelo app.</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                aria-label="Escolher PDF do edital"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void readFile(file);
                }}
              />
            </label>
          )}

          {state.phase === 'reading' && (
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Lendo {state.fileName}…
            </p>
          )}
          {state.phase === 'failed' && <p className="text-xs text-amber-300">{state.message}</p>}

          {state.phase === 'preview' && roleNeedsChoice(state.edital) && (
            <label className="block space-y-1">
              <span className="text-xs font-bold text-white">Qual cargo você vai prestar?</span>
              <select
                value={state.roleNumber ?? ''}
                onChange={(e) => chooseRole(Number(e.target.value))}
                className="w-full px-2 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-orange-500 outline-none"
              >
                <option value="" disabled>
                  Escolha o cargo/especialidade
                </option>
                {state.edital.roles.map((role) => (
                  <option key={role.number} value={role.number}>
                    Cargo {role.number}: {role.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {state.phase === 'preview' && state.draft && (
            <EditalPreview edital={state.edital} draft={state.draft} onChange={(draft) => setState({ ...state, draft })} />
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-end gap-2">
          <button type="button" onClick={close} className="px-3.5 py-2 rounded-xl border border-slate-800 text-xs text-slate-400 hover:text-white">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => {
              if (state.phase !== 'preview' || !state.draft) return;
              onCreatePlan(draftToPlanInput(state.draft, state.edital, state.roleNumber));
              setState({ phase: 'idle' });
            }}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold disabled:opacity-40 disabled:pointer-events-none"
          >
            Criar meu plano
          </button>
        </div>
      </div>
    </div>
  );
}
