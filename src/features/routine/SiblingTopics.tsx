import { useState } from 'react';
import { Eye } from 'lucide-react';
import type { Topic } from '../../types/database';

const VISIBLE = 3;

function label(topic: Topic): string {
  return topic.code ? `${topic.code} ${topic.title}` : topic.title;
}

/**
 * Tópicos do mesmo grupo do bloco: no mesmo nível dele (sem recuo nem linha, que diriam "filhos").
 * O selecionado ganha fundo e contorno — nunca fonte ou recuo maiores, que fariam o texto em volta pular.
 */
export function SiblingTopics({
  siblings,
  selectedTopicId,
  onSelect,
}: {
  siblings: Topic[];
  selectedTopicId: string | null;
  onSelect: (subjectId: string, topicId: string) => void;
}) {
  const selectedIndex = siblings.findIndex((s) => s.id === selectedTopicId);
  const [expanded, setExpanded] = useState(false);
  const showAll = expanded || selectedIndex >= VISIBLE;
  const shown = showAll ? siblings : siblings.slice(0, VISIBLE);
  const hidden = siblings.length - shown.length;

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Outros tópicos do mesmo grupo</p>
      <ul className="space-y-0.5">
        {shown.map((s) => {
          const selected = s.id === selectedTopicId;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.subject_id, s.id)}
                aria-current={selected ? 'true' : undefined}
                className={`flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left ring-1 transition-colors ${
                  selected ? 'bg-slate-800 text-slate-100 ring-orange-400/60' : 'text-slate-400 ring-transparent hover:text-slate-200'
                }`}
              >
                <span className="flex-1">{label(s)}</span>
                {selected && <Eye size={12} className="mt-0.5 shrink-0 text-orange-300" aria-label="olhando agora" />}
              </button>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className="px-1.5 text-[11px] text-orange-400 hover:text-orange-300">
          {`Ver mais (${hidden})`}
        </button>
      )}
    </div>
  );
}
