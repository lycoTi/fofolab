import { useState } from 'react';
import { Eye } from 'lucide-react';
import type { TopicGroup } from '../../lib/dailyRoutine';
import type { Topic } from '../../types/database';

/** Quantos tópicos do grupo aparecem antes do "Ver mais" (o do bloco e o selecionado aparecem sempre). */
const VISIBLE = 5;

function label(topic: Topic): string {
  return topic.code ? `${topic.code} ${topic.title}` : topic.title;
}

/**
 * Árvore do grupo do bloco: o tópico "pai" é o título do bloco (fora daqui) e os tópicos dele, inclusive o do
 * bloco, ficam recuados no mesmo nível. O contorno do selecionado é por dentro (ring-inset): a animação de
 * altura esconde o que passa da caixa, e um contorno por fora apareceria cortado. O do bloco tem um ponto laranja; o selecionado ganha fundo, contorno e o olhinho — nunca fonte
 * ou recuo maiores, que fariam o texto em volta pular. Os itens extras abrem com a altura animada.
 */
export function TopicTree({
  group,
  blockTopicId,
  selectedTopicId,
  onSelect,
}: {
  group: TopicGroup;
  blockTopicId: string | null;
  selectedTopicId: string | null;
  onSelect: (subjectId: string, topicId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const alwaysShown = (topic: Topic, index: number) =>
    index < VISIBLE || topic.id === blockTopicId || topic.id === selectedTopicId;
  const hiddenCount = group.members.filter((t, i) => !alwaysShown(t, i)).length;

  return (
    <div className="space-y-1">
      <ul aria-label="Tópicos do grupo" className="space-y-0.5 border-l border-slate-700/80 pl-2">
        {group.members.map((topic, index) => {
          const visible = expanded || alwaysShown(topic, index);
          const selected = topic.id === selectedTopicId;
          const isBlock = topic.id === blockTopicId;
          return (
            <li
              key={topic.id}
              className="grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ gridTemplateRows: visible ? '1fr' : '0fr', opacity: visible ? 1 : 0 }}
              aria-hidden={!visible}
              inert={!visible}
            >
              <div className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => onSelect(topic.subject_id, topic.id)}
                  aria-current={selected ? 'true' : undefined}
                  aria-label={isBlock ? `${label(topic)} (tópico do bloco)` : label(topic)}
                  className={`flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left ring-1 ring-inset transition-colors duration-150 ${
                    selected ? 'bg-slate-800 text-slate-100 ring-orange-400/60' : 'text-slate-400 ring-transparent hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isBlock ? 'bg-orange-400' : 'bg-transparent'}`}
                    title={isBlock ? 'Tópico do bloco' : undefined}
                  />
                  <span className="flex-1">{label(topic)}</span>
                  {selected && <Eye size={12} className="mt-0.5 shrink-0 text-orange-300" aria-hidden="true" />}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && !expanded && (
        <button type="button" onClick={() => setExpanded(true)} className="px-1.5 text-[11px] text-orange-400 hover:text-orange-300">
          {`Ver mais (${hiddenCount})`}
        </button>
      )}
    </div>
  );
}
