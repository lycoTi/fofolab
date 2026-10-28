import { useEffect, useState } from 'react';
import { ClipboardList, Undo2 } from 'lucide-react';
import { Collapse } from '../../components/Collapse';
import { isValidLog } from '../../lib/questionLogs';
import type { Topic } from '../../types/database';

export interface QuestionLogPanelProps {
  /** Tópicos que dá para escolher: o do bloco, os do grupo dele e o que está aberto. */
  topics: Topic[];
  defaultTopicId: string | null;
  /** Bloco acabou de terminar: abre sozinho com o convite. */
  invite: boolean;
  lastLogLabel: string | null;
  onSubmit: (value: { topicId: string; total: number; correct: number; blank: number }) => void;
  onUndo: () => void;
  onDismissInvite: () => void;
}

function label(topic: Topic): string {
  return topic.code ? `${topic.code} ${topic.title}` : topic.title;
}

const field = 'w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:border-orange-500 outline-none';

/**
 * Registro rápido de questões resolvidas fora do app (qualquer site ou caderno de provas): só os números.
 * Fica recolhido no topo da coluna e abre sozinho, uma vez, quando um bloco termina.
 */
export function QuestionLogPanel(props: QuestionLogPanelProps) {
  const { topics, defaultTopicId, invite, lastLogLabel } = props;
  const [open, setOpen] = useState(invite);
  const [topicId, setTopicId] = useState(defaultTopicId ?? topics[0]?.id ?? '');
  const [total, setTotal] = useState('');
  const [correct, setCorrect] = useState('');
  const [blank, setBlank] = useState('0');

  useEffect(() => {
    if (invite) setOpen(true);
  }, [invite]);
  useEffect(() => {
    if (defaultTopicId) setTopicId(defaultTopicId);
  }, [defaultTopicId]);

  // O tópico sugerido pode não estar entre as opções (ex.: convite de um bloco anterior): vale o que aparece selecionado
  const effectiveTopicId = topics.some((t) => t.id === topicId) ? topicId : (topics[0]?.id ?? '');
  const numbers = { total: Number(total), correct: Number(correct), blank: Number(blank || '0') };
  const filled = total !== '' && correct !== '';
  const valid = filled && isValidLog(numbers) && effectiveTopicId !== '';

  const submit = () => {
    if (!valid) return;
    props.onSubmit({ topicId: effectiveTopicId, ...numbers });
    setTotal('');
    setCorrect('');
    setBlank('0');
    setOpen(false);
  };

  return (
    <div className="mx-3 mt-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs transition-colors">
      {lastLogLabel && (
        <div className="mb-2 flex items-center justify-between gap-2 text-emerald-300">
          <span>{lastLogLabel}</span>
          <button type="button" onClick={props.onUndo} className="flex items-center gap-1 text-slate-300 hover:text-white">
            <Undo2 size={12} />
            Desfazer
          </button>
        </div>
      )}

      <Collapse open={!open}>
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 font-medium text-orange-400 hover:text-orange-300">
          <ClipboardList size={13} />
          Registrar questões feitas fora do app
        </button>
      </Collapse>

      <Collapse open={open}>
        <div className="space-y-2">
          {invite && <p className="text-slate-300">Resolveu questões em outro lugar? Registre seu desempenho.</p>}
          <label className="block space-y-1">
            <span className="text-slate-400">Tópico</span>
            <select value={effectiveTopicId} onChange={(e) => setTopicId(e.target.value)} className={field}>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {label(t)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-slate-400">Total</span>
              <input type="number" min={1} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} className={field} />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Certas</span>
              <input type="number" min={0} inputMode="numeric" value={correct} onChange={(e) => setCorrect(e.target.value)} className={field} />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Em branco</span>
              <input type="number" min={0} inputMode="numeric" value={blank} onChange={(e) => setBlank(e.target.value)} className={field} />
            </label>
          </div>
          {filled && !isValidLog(numbers) && (
            <p className="text-amber-300">Confira os números: certas e em branco não passam do total.</p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!valid}
              className="rounded-lg bg-orange-500 px-3 py-1.5 font-semibold text-white hover:bg-orange-400 disabled:opacity-40"
            >
              Registrar
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (invite) props.onDismissInvite();
              }}
              className="text-slate-400 hover:text-slate-200"
            >
              {invite ? 'Agora não' : 'Cancelar'}
            </button>
          </div>
        </div>
      </Collapse>
    </div>
  );
}
