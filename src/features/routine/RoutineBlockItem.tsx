import { Check, Play } from 'lucide-react';
import { formatDuration } from '../../lib/timeFormat';
import type { RoutineItem } from '../../lib/dailyRoutine';
import type { Topic } from '../../types/database';

export interface RoutineMaterials {
  pdfLabel: string | null;
  questionCount: number;
  hasNotes: boolean;
}

interface CurrentBlockExtras {
  siblings: Topic[];
  materials: RoutineMaterials;
  blockRunning: boolean;
  startLabel: string;
  onStart: () => void;
  onSelectTopic: (subjectId: string, topicId: string) => void;
  onOpenMaterial: (kind: 'pdf' | 'questions' | 'notes') => void;
}

function topicLabel(topic: Topic | null): string {
  if (!topic) return '';
  return topic.code ? `${topic.code} ${topic.title}` : topic.title;
}

const materialButton =
  'rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:border-orange-500/50 hover:text-white';

/** Um bloco do roteiro: feito (esmaecido), atual (aberto, com material) ou próximo (recolhido, com o motivo). */
export function RoutineBlockItem({ item, current }: { item: RoutineItem; current?: CurrentBlockExtras }) {
  const { subject, topic, status, block } = item;

  if (status === 'done') {
    return (
      <li data-testid={`routine-item-${block.blockNumber}`} data-status={status} className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-400 opacity-60">
        <Check size={13} className="shrink-0 text-emerald-400" />
        <span className="truncate">{`${subject.name}${topic ? ` · ${topicLabel(topic)}` : ''}`}</span>
        <span className="ml-auto shrink-0">{formatDuration(block.durationMinutes)}</span>
      </li>
    );
  }

  if (!current) {
    return (
      <li data-testid={`routine-item-${block.blockNumber}`} data-status={status} className="space-y-1 rounded-lg border border-slate-800 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-slate-200">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
          <span className="truncate font-medium">{subject.name}</span>
          <span className="ml-auto shrink-0 text-slate-400">{formatDuration(block.durationMinutes)}</span>
        </div>
        <p className="text-slate-400">{block.reasonText}</p>
      </li>
    );
  }

  const { siblings, materials, blockRunning, startLabel, onStart, onSelectTopic, onOpenMaterial } = current;
  return (
    <li data-testid={`routine-item-${block.blockNumber}`} data-status={status} className="space-y-2.5 rounded-xl border border-orange-500/40 bg-orange-500/5 p-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
        <span className="truncate font-semibold text-white">{subject.name}</span>
        <span className="ml-auto shrink-0 text-slate-300">{`${formatDuration(item.studiedMinutes)} de ${formatDuration(block.durationMinutes)}`}</span>
      </div>
      {topic && (
        <p className="text-sm font-medium leading-snug text-slate-100">
          {topic.code && <span className="mr-1 font-mono text-orange-300">{topic.code}</span>}
          <span>{topic.title}</span>
        </p>
      )}
      {siblings.length > 0 && (
        <ul className="space-y-0.5 border-l border-slate-700 pl-2">
          {siblings.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onSelectTopic(s.subject_id, s.id)} className="text-left text-slate-400 hover:text-slate-200">
                {topicLabel(s)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={materialButton} onClick={() => onOpenMaterial('pdf')}>
          {materials.pdfLabel ?? 'Abrir PDF'}
        </button>
        <button type="button" className={materialButton} onClick={() => onOpenMaterial('questions')}>
          {materials.questionCount === 1 ? '1 questão' : `${materials.questionCount} questões`}
        </button>
        <button type="button" className={materialButton} onClick={() => onOpenMaterial('notes')}>
          Caderno
        </button>
      </div>
      {!blockRunning && (
        <button
          type="button"
          onClick={onStart}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-400"
        >
          <Play size={13} />
          {startLabel}
        </button>
      )}
    </li>
  );
}
