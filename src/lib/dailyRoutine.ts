import type { DailyPlan } from './dailyPlanner';
import type { FrozenBlock, StudyPlan, StudySession, Subject, Topic } from '../types/database';

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
  return plan.blocks.map((b) => {
    const block: FrozenBlock = {
      blockNumber: b.blockNumber,
      subjectId: b.subject.id,
      topicId: b.topic?.id ?? null,
      durationMinutes: b.durationMinutes,
      reasonText: b.reasonText,
    };
    // Só a revisão leva o tipo: os roteiros gravados antes dela continuam iguais
    if (b.kind === 'WEEK_REVIEW') block.kind = 'WEEK_REVIEW';
    return block;
  });
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

export interface TopicGroup {
  /** Tópico "pai" (agrupador): a raiz da árvore na coluna. */
  parent: Topic | null;
  /** Todos os tópicos do grupo, inclusive o do bloco, na ordem do edital. */
  members: Topic[];
}

/** Grupo do tópico do bloco (mesmo pai), para a árvore da coluna. Tópico sem pai não tem árvore. */
export function routineGroup(topic: Topic | null, topicsBySubject: Record<string, Topic[]>): TopicGroup {
  if (!topic?.parent_id) return { parent: null, members: [] };
  const all = topicsBySubject[topic.subject_id] ?? [];
  const members = all
    .filter((t) => t.parent_id === topic.parent_id)
    .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', undefined, { numeric: true }));
  return { parent: all.find((t) => t.id === topic.parent_id) ?? null, members };
}

/** Roteiro cumprido: um bloco extra escolhido pelo motor, de preferência num tópico que ainda não apareceu hoje. */
export function pickExtraBlock(live: DailyPlan, frozen: FrozenBlock[]): FrozenBlock | null {
  const [first] = freezeDailyPlan(live);
  if (!first) return null;
  const usedTopics = new Set(frozen.map((b) => b.topicId));
  const fresh = freezeDailyPlan(live).find((b) => !usedTopics.has(b.topicId));
  return { ...(fresh ?? first), blockNumber: frozen.length + 1 };
}

/**
 * Assinatura do perfil com que o roteiro foi congelado: horas, estratégia, autoavaliação e distribuição do
 * ciclo, e o tempo de hoje (spec 13: "mudar o tempo de hoje"). Se mudar, o roteiro gravado está desatualizado e é
 * refeito — mesmo que o app tenha sido fechado antes de gravar o roteiro novo. Estudar (domínio, calor) não muda a
 * assinatura.
 */
export function routineProfileKey(
  plan: StudyPlan,
  subjects: Subject[],
  topicsBySubject: Record<string, Topic[]>,
  dayMinutes?: number,
  weekReviewMinutes = 0
): string {
  const subjectPart = [...subjects]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => `${s.id}:${s.initial_knowledge_level}:${s.cycle_allocated_minutes}`)
    .join(',');
  const topicPart = subjects
    .flatMap((s) => topicsBySubject[s.id] ?? [])
    .filter((t) => t.initial_knowledge_level != null)
    .map((t) => `${t.id}:${t.initial_knowledge_level}`)
    .sort()
    .join(',');
  const key = `${plan.weekly_hours_target}|${plan.strategy_mode ?? ''}|${subjectPart}|${topicPart}`;
  if (dayMinutes === undefined) return key;
  // A Revisão da semana muda de dia quando a semana atípica troca o dia mais longo
  return weekReviewMinutes > 0 ? `${key}|dia:${dayMinutes}|rev:${weekReviewMinutes}` : `${key}|dia:${dayMinutes}`;
}
