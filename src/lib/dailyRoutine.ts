import type { DailyPlan } from './dailyPlanner';
import type { FrozenBlock, StudySession, Subject, Topic } from '../types/database';

/**
 * Roteiro do dia (spec 09): os blocos são congelados na primeira abertura do dia e, a partir das
 * sessões de hoje, cada um vira feito, atual ou próximo. O estudante não escolhe — o motor escolheu.
 */
export type RoutineStatus = 'done' | 'current' | 'next';

export interface RoutineItem {
  block: FrozenBlock;
  subject: Subject;
  topic: Topic | null;
  status: RoutineStatus;
  studiedMinutes: number;
  remainingMinutes: number;
}

export function freezeDailyPlan(plan: DailyPlan): FrozenBlock[] {
  return plan.blocks.map((b) => ({
    blockNumber: b.blockNumber,
    subjectId: b.subject.id,
    topicId: b.topic?.id ?? null,
    durationMinutes: b.durationMinutes,
    reasonText: b.reasonText,
  }));
}

export function buildRoutine(params: {
  blocks: FrozenBlock[];
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  todaySessions: StudySession[];
}): RoutineItem[] {
  const { blocks, subjects, topicsBySubject, todaySessions } = params;

  // 1. Minutos de hoje por matéria (a revisão do dia não conta para os blocos)
  const minutesLeft = new Map<string, number>();
  for (const s of todaySessions) {
    if (s.session_type === 'REVIEW') continue;
    minutesLeft.set(s.subject_id, (minutesLeft.get(s.subject_id) ?? 0) + s.duration_minutes);
  }

  // 2. Cada bloco consome o tempo da sua matéria na ordem do roteiro; blocos de matéria apagada saem
  const items: RoutineItem[] = [];
  let currentAssigned = false;
  for (const block of blocks) {
    const subject = subjects.find((s) => s.id === block.subjectId);
    if (!subject) continue;
    const topic = (topicsBySubject[subject.id] ?? []).find((t) => t.id === block.topicId) ?? null;
    const available = minutesLeft.get(subject.id) ?? 0;
    const studiedMinutes = Math.min(available, block.durationMinutes);
    minutesLeft.set(subject.id, available - studiedMinutes);

    // 3. O primeiro bloco ainda não cumprido é o atual
    let status: RoutineStatus = 'next';
    if (studiedMinutes >= block.durationMinutes) {
      status = 'done';
    } else if (!currentAssigned) {
      status = 'current';
      currentAssigned = true;
    }
    items.push({ block, subject, topic, status, studiedMinutes, remainingMinutes: block.durationMinutes - studiedMinutes });
  }
  return items;
}

/** Tópicos do mesmo grupo (mesmo pai) — aparecem na coluna só como contexto. */
export function routineSiblings(topic: Topic | null, topicsBySubject: Record<string, Topic[]>): Topic[] {
  if (!topic?.parent_id) return [];
  return (topicsBySubject[topic.subject_id] ?? [])
    .filter((t) => t.parent_id === topic.parent_id && t.id !== topic.id)
    .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', undefined, { numeric: true }));
}

/** Roteiro cumprido: um bloco extra escolhido pelo motor, de preferência num tópico que ainda não apareceu hoje. */
export function pickExtraBlock(live: DailyPlan, frozen: FrozenBlock[]): FrozenBlock | null {
  const [first] = freezeDailyPlan(live);
  if (!first) return null;
  const usedTopics = new Set(frozen.map((b) => b.topicId));
  const fresh = freezeDailyPlan(live).find((b) => !usedTopics.has(b.topicId));
  return { ...(fresh ?? first), blockNumber: frozen.length + 1 };
}
