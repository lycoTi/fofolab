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
  'rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-slate-300 hover:border-[var(--fofo-accent)]/50 hover:bg-white/[0.06] hover:text-white transition-colors';

/** Moldura de cada estado; a troca entre eles anima (cor, borda, opacidade, respiro). */
const FRAME: Record<'done' | 'next' | 'open', string> = {
  done: 'border-white/[0.05] bg-transparent px-3 py-2 text-slate-400 opacity-60',
  next: 'border-white/[0.07] bg-white/[0.015] px-3 py-2 hover:border-white/[0.12]',
  open: 'border-l-2 border-l-[var(--fofo-accent)] border-t-white/[0.08] border-r-white/[0.08] border-b-white/[0.08] bg-[#0E121B] p-3.5 shadow-sm',
};

/**
 * Um bloco do roteiro: feito (esmaecido), atual (aberto, com material) ou próximo (recolhido, com o motivo).
 * É o mesmo elemento nos três estados: quando o bloco termina ele recolhe com a altura animada e o próximo
 * se abre, em vez de um trocar pelo outro de supetão.
 */
export function RoutineBlockItem({ item, current }: { item: RoutineItem; current?: CurrentBlockExtras }) {
  const { topic, status, block } = item;
  const done = status === 'done';
  const open = !done && current !== undefined;
  let frame = FRAME.next;
  if (done) frame = FRAME.done;
  else if (open) frame = FRAME.open;

  return (
    <li
      data-testid={`routine-item-${block.blockNumber}`}
      data-status={status}
      className={`rounded-xl border text-xs transition-[background-color,border-color,opacity,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${frame}`}
    >
      <BlockHeader item={item} done={done} open={open} liveFocusMs={current?.liveFocusMs ?? 0} />
      <Collapse open={!done && !open}>
        <p className="pt-1 text-slate-400">{block.reasonText}</p>
      </Collapse>
      <Collapse open={open}>{open && current && <CurrentBody item={item} topic={topic} current={current} />}</Collapse>
    </li>
  );
}

/** Linha de cima do bloco, com o que cada estado precisa mostrar. */
function BlockHeader({ item, done, open, liveFocusMs }: { item: RoutineItem; done: boolean; open: boolean; liveFocusMs: number }) {
  const { subject, topic, block } = item;
  if (done) {
    return (
      <div className="flex items-center gap-2">
        <Check size={13} className="shrink-0 text-emerald-400" />
        <span className="truncate">{`${block.kind === 'WEEK_REVIEW' ? 'Revisão da semana · ' : ''}${subject.name}${topic ? ` · ${topicLabel(topic)}` : ''}`}</span>
        <span className="ml-auto shrink-0 font-mono text-[11px] text-slate-400">{formatDuration(block.durationMinutes)}</span>
      </div>
    );
  }
  const doneMinutes = item.studiedMinutes + Math.floor(liveFocusMs / 60_000);
  return (
    <div className="flex items-center gap-2">
      <span className={`shrink-0 rounded-full ${open ? 'h-2.5 w-2.5' : 'h-2 w-2'}`} style={{ backgroundColor: subject.color }} />
      <span className={`truncate ${open ? 'font-semibold text-white' : 'font-medium text-slate-200'}`}>{subject.name}</span>
      {block.kind === 'WEEK_REVIEW' && (
        <span className="shrink-0 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-200">Revisão da semana</span>
      )}
      <span className={`ml-auto shrink-0 font-mono text-[11px] ${open ? 'text-slate-300' : 'text-slate-400'}`}>
        {open ? `${formatDuration(doneMinutes)} de ${formatDuration(block.durationMinutes)}` : formatDuration(block.durationMinutes)}
      </span>
    </div>
  );
}

/** Conteúdo do bloco atual: progresso, tópico-pai recolhível, subtópico ativo, material, FofoDoro e o botão de começar. */
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
    <div className="space-y-2.5 pt-2.5">
      <div
        role="progressbar"
        aria-label="Progresso do bloco"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        className="h-1 overflow-hidden rounded-full bg-white/[0.08]"
      >
        <div
          className="h-full rounded-full bg-[var(--fofo-accent)] transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      {hasTree && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium leading-snug text-slate-300">
            <button
              type="button"
              onClick={() => setTreeOpen((v) => !v)}
              aria-expanded={treeOpen}
              aria-label={`Subtópicos de ${parentTitle}`}
              className="flex w-full items-center gap-1.5 rounded-md py-0.5 text-left transition-colors duration-150 hover:text-white"
            >
              {group.parent?.code && <span className="font-mono text-[var(--fofo-accent)]">{group.parent.code}</span>}
              <span className="flex-1 truncate">{group.parent?.title ?? parentTitle}</span>
              <span className="shrink-0 font-normal text-[11px] text-slate-400">{`${group.members.length} subtópicos`}</span>
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
                className="flex w-full items-start gap-1.5 rounded-md border-l border-white/[0.15] pl-2 py-0.5 text-left text-sm font-medium leading-snug text-slate-100 transition-colors duration-150 hover:text-white"
              >
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${focusedTopic.id === topic?.id ? 'bg-[var(--fofo-accent)]' : 'bg-slate-500'}`}
                  title={focusedTopic.id === topic?.id ? 'Tópico do bloco' : undefined}
                />
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
          className="block w-full rounded-md text-left text-sm font-medium leading-snug text-slate-100 transition-colors duration-150 hover:text-white"
        >
          {topic.code && <span className="mr-1 font-mono text-[var(--fofo-accent)]">{topic.code}</span>}
          <span>{topic.title}</span>
        </button>
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
      {/* Relógio e prévia trocam de lugar: quem entra espera quem sai, para não se sobreporem */}
      <Collapse open={hasFofodoro} afterExit>
        {fofodoro}
      </Collapse>
      <Collapse open={!blockRunning} afterExit>
        <div className="space-y-2.5">
          {preview}
          <button
            type="button"
            onClick={onStart}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--fofo-accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--fofo-accent-hover)] transition-colors shadow-sm"
          >
            <Play size={13} />
            {startLabel}
          </button>
        </div>
      </Collapse>
    </div>
  );
}
