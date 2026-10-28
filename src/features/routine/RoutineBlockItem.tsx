import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Play } from 'lucide-react';
import { Collapse } from '../../components/Collapse';
import { formatDuration } from '../../lib/timeFormat';
import type { RoutineItem, TopicGroup } from '../../lib/dailyRoutine';
import type { Topic } from '../../types/database';
import { TopicTree } from './TopicTree';

export interface RoutineMaterials {
  pdfLabel: string | null;
  questionCount: number;
  hasNotes: boolean;
}

interface CurrentBlockExtras {
  group: TopicGroup;
  selectedTopicId: string | null;
  /** Foco do trecho em andamento, ainda não gravado como sessão (para a barra andar ao vivo). */
  liveFocusMs: number;
  materials: RoutineMaterials;
  blockRunning: boolean;
  startLabel: string;
  onStart: () => void;
  onSelectTopic: (subjectId: string, topicId: string) => void;
  onOpenMaterial: (kind: 'pdf' | 'questions' | 'notes') => void;
  fofodoro: ReactNode | null;
  preview: ReactNode | null;
}

function topicLabel(topic: Topic | null): string {
  if (!topic) return '';
  return topic.code ? `${topic.code} ${topic.title}` : topic.title;
}

const materialButton =
  'flex-1 py-1.5 px-2 text-center text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors';

/**
 * Um bloco do roteiro no paradigma anti-card:
 * - Feito: linha plana compacta com checkmark;
 * - Próximo: item limpo com nó de cor da matéria e motivo;
 * - Atual: estação de foco aberta sobre a prancheta da coluna, sem bordas externas de cartão.
 */
export function RoutineBlockItem({ item, current }: { item: RoutineItem; current?: CurrentBlockExtras }) {
  const { topic, status, block } = item;
  const done = status === 'done';
  const open = !done && current !== undefined;

  if (done) {
    return (
      <li
        data-testid={`routine-item-${block.blockNumber}`}
        data-status={status}
        className="flex items-center justify-between gap-2 py-1.5 text-xs text-slate-500 opacity-60 hover:opacity-100 transition-opacity"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Check size={12} className="shrink-0 text-emerald-400" />
          <span className="truncate">{`${block.kind === 'WEEK_REVIEW' ? 'Revisão da semana · ' : ''}${item.subject.name}${topic ? ` · ${topicLabel(topic)}` : ''}`}</span>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-slate-500">{formatDuration(block.durationMinutes)}</span>
      </li>
    );
  }

  if (!open) {
    return (
      <li
        data-testid={`routine-item-${block.blockNumber}`}
        data-status={status}
        className="space-y-1 py-2 text-xs border-t border-slate-800/60 first:border-t-0"
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.subject.color }} />
            <span className="font-semibold text-slate-300 truncate">{item.subject.name}</span>
            {block.kind === 'WEEK_REVIEW' && (
              <span className="shrink-0 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-200">Revisão da semana</span>
            )}
          </div>
          <span className="shrink-0 font-mono text-[11px] text-slate-400">{formatDuration(block.durationMinutes)}</span>
        </div>
        <p className="pl-4 text-[11px] text-slate-500 leading-relaxed">{block.reasonText}</p>
      </li>
    );
  }

  // Bloco ATUAL (Open): Aberto diretamente na coluna, sem moldura de card
  return (
    <li
      data-testid={`routine-item-${block.blockNumber}`}
      data-status={status}
      className="space-y-3 py-3 border-y border-slate-800/80 text-xs"
    >
      <BlockHeader item={item} done={done} open={open} liveFocusMs={current?.liveFocusMs ?? 0} />
      {current && <CurrentBody item={item} topic={topic} current={current} />}
    </li>
  );
}

/** Linha de cabeçalho do bloco ativo. */
function BlockHeader({ item, done, open, liveFocusMs }: { item: RoutineItem; done: boolean; open: boolean; liveFocusMs: number }) {
  const { subject, block } = item;
  const doneMinutes = item.studiedMinutes + Math.floor(liveFocusMs / 60_000);
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
        <span className="font-bold text-white text-sm truncate">{subject.name}</span>
        {block.kind === 'WEEK_REVIEW' && (
          <span className="shrink-0 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-200">Revisão da semana</span>
        )}
      </div>
      <span className="shrink-0 font-mono text-xs font-semibold text-orange-200">
        {`${formatDuration(doneMinutes)} de ${formatDuration(block.durationMinutes)}`}
      </span>
    </div>
  );
}

/** Conteúdo do bloco atual: progresso, árvore de tópicos, materiais em toolbar única, FofoDoro e ação primária. */
function CurrentBody({ item, topic, current }: { item: RoutineItem; topic: Topic | null; current: CurrentBlockExtras }) {
  const { group, selectedTopicId, liveFocusMs, materials, blockRunning, startLabel, onStart, onSelectTopic, onOpenMaterial, fofodoro, preview } = current;
  const hasTree = group.members.length > 1;
  const [treeOpen, setTreeOpen] = useState(false);
  const hasFofodoro = Boolean(fofodoro);

  useEffect(() => {
    if (hasFofodoro) setTreeOpen(false);
  }, [hasFofodoro]);

  const progressPercent = Math.min(100, Math.round(((item.studiedMinutes + liveFocusMs / 60_000) / item.block.durationMinutes) * 100));
  const focusedTopic = (hasTree ? group.members.find((m) => m.id === selectedTopicId) : null) ?? topic;
  const parentTitle = group.parent ? topicLabel(group.parent) : 'Subtópicos do assunto';

  return (
    <div className="space-y-3">
      {/* Barra de progresso contínua */}
      <div
        role="progressbar"
        aria-label="Progresso do bloco"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        className="h-1 w-full overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className="h-full rounded-full bg-[var(--fofo-accent)] transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Tópico e árvore de subtópicos */}
      {hasTree && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium leading-snug text-slate-300">
            <button
              type="button"
              onClick={() => setTreeOpen((v) => !v)}
              aria-expanded={treeOpen}
              aria-label={`Subtópicos de ${parentTitle}`}
              className="flex w-full items-center gap-1.5 py-0.5 text-left text-slate-400 hover:text-white transition-colors"
            >
              {group.parent?.code && <span className="font-mono text-orange-400">{group.parent.code}</span>}
              <span className="flex-1 truncate font-medium text-slate-300">{group.parent?.title ?? parentTitle}</span>
              <span className="shrink-0 text-[11px] text-slate-500">{`${group.members.length} subtópicos`}</span>
              <ChevronDown
                size={13}
                className={`shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${treeOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </h3>
          <Collapse open={!treeOpen}>
            {!treeOpen && focusedTopic && (
              <button
                type="button"
                onClick={() => topic && onSelectTopic(topic.subject_id, topic.id)}
                aria-label={
                  focusedTopic.id === topic?.id
                    ? `${topicLabel(focusedTopic)} (tópico do bloco)`
                    : `Voltar ao tópico do bloco: ${topicLabel(topic)}`
                }
                className="flex w-full items-start gap-2 pl-3 py-1 text-left text-xs font-medium leading-snug text-white hover:text-orange-200 border-l-2 border-orange-500/70 transition-colors"
              >
                <span className="flex-1">{topicLabel(focusedTopic)}</span>
              </button>
            )}
          </Collapse>
          <Collapse open={treeOpen}>
            {treeOpen && <TopicTree group={group} blockTopicId={topic?.id ?? null} selectedTopicId={selectedTopicId} onSelect={onSelectTopic} />}
          </Collapse>
        </div>
      )}
      {!hasTree && topic && (
        <button
          type="button"
          onClick={() => onSelectTopic(topic.subject_id, topic.id)}
          aria-label={`Voltar ao tópico do bloco: ${topicLabel(topic)}`}
          className="block w-full text-left text-xs font-medium leading-snug text-white hover:text-orange-200 pl-3 border-l-2 border-orange-500/70 transition-colors"
        >
          {topic.code && <span className="mr-1 font-mono text-orange-400">{topic.code}</span>}
          <span>{topic.title}</span>
        </button>
      )}

      {/* Toolbar unificada de materiais (sem cartões soltos) */}
      <div className="flex items-center divide-x divide-slate-800 rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
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

      {/* Relógio e prévia */}
      <Collapse open={hasFofodoro} afterExit>
        {fofodoro}
      </Collapse>
      <Collapse open={!blockRunning} afterExit>
        <div className="space-y-3 pt-1">
          {preview}
          <button
            type="button"
            onClick={onStart}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-600 active:scale-[0.98] transition-all"
          >
            <Play size={13} fill="currentColor" />
            {startLabel}
          </button>
        </div>
      </Collapse>
    </div>
  );
}
