import type { BlockTarget } from '../study-block/studyBlockMachine';
import type { Subject, Topic } from '../../types/database';
import type { RoutineItem } from '../../lib/dailyRoutine';

/**
 * "Agora" da coluna Hoje (spec 14 §8): é sempre o bloco que está rodando; sem bloco rodando, o atual do roteiro (ou o
 * extra, com o roteiro cumprido). O rótulo diz quando o bloco rodando não é o atual: fora do roteiro (olhada) ou com a
 * meta já cumprida (o roteiro passou o "atual" para o próximo no meio da pausa).
 */
export type NowTag = 'fora do roteiro' | 'meta cumprida' | null;

export interface NowBlock {
  subject: Subject;
  topic: Topic | null;
  /** Item do roteiro (ou o extra); null no bloco fora do roteiro. */
  item: RoutineItem | null;
  tag: NowTag;
  /** Bloco ativo (rodando, pausado ou pronto), não relógio andando. */
  running: boolean;
}

function matchesTarget(item: RoutineItem, block: BlockTarget): boolean {
  return item.subject.id === block.subjectId && (item.topic?.id ?? null) === block.topicId;
}

/** Item do roteiro em que o bloco roda: o atual primeiro (a mesma matéria e tópico podem aparecer de novo no dia). */
function runningItem(candidates: RoutineItem[], block: BlockTarget): RoutineItem | null {
  const matches = candidates.filter((i) => matchesTarget(i, block));
  return matches.find((i) => i.status === 'current') ?? matches[0] ?? null;
}

function fromRunning(input: {
  items: RoutineItem[];
  extra: RoutineItem | null;
  block: BlockTarget;
  subjects: Subject[];
  topics: Topic[];
}): NowBlock | null {
  const { items, extra, block, subjects, topics } = input;
  const candidates = extra ? [...items, extra] : items;
  const item = runningItem(candidates, block);
  if (item) {
    const tag: NowTag = item.status === 'done' ? 'meta cumprida' : null;
    return { subject: item.subject, topic: item.topic, item, tag, running: true };
  }
  // Fora do roteiro: matéria e tópico vêm do bloco; matéria apagada no meio do bloco não tem o que mostrar
  const subject = subjects.find((s) => s.id === block.subjectId);
  if (!subject) return null;
  const topic = topics.find((t) => t.id === block.topicId) ?? null;
  return { subject, topic, item: null, tag: 'fora do roteiro', running: true };
}

export function pickNowBlock(input: {
  items: RoutineItem[];
  extra: RoutineItem | null;
  block: BlockTarget | null;
  active: boolean;
  subjects: Subject[];
  topics: Topic[];
}): NowBlock | null {
  const { items, extra, block, active } = input;

  // 1. Bloco rodando
  if (active && block) {
    const running = fromRunning({ ...input, block });
    if (running) return running;
  }

  // 2. Nada rodando: o atual do roteiro, senão o extra
  const current = items.find((i) => i.status === 'current') ?? extra;
  if (!current) return null;
  return { subject: current.subject, topic: current.topic, item: current, tag: null, running: false };
}
