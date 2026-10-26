import type { CycleCalculationResult, SubjectCycleAllocation, TopicHeatItem } from './cycleEngine';
import type { Subject, Topic } from '../types/database';
import { formatDuration } from './timeFormat';

/**
 * Roteiro do "Meu Dia de Hoje" (docs/specs/05): escolhe as matérias pelo que FALTA estudar
 * na semana (ciclo aplicado − minutos já registrados desde segunda) e, no empate, pela prioridade.
 * Antes, a tela pegava as duas primeiras disciplinas em ordem alfabética, todos os dias.
 * Com as horas por dia (spec 13), o orçamento é o do dia; dia longo ganha mais blocos, de até 02:00 cada, e o dia
 * mais longo da semana pode trazer a Revisão da semana.
 */
export type CostBenefitBadge = 'ALTA_RENTABILIDADE' | 'BASE_ESTRATEGICA' | 'REVISAO_URGENTE';

export interface DailyFocusBlock {
  blockNumber: number;
  subject: Subject;
  topic: Topic | null;
  allocation: SubjectCycleAllocation;
  durationMinutes: number;
  costBenefitBadge: CostBenefitBadge;
  reasonText: string;
  /** Estudo do ciclo ou a Revisão da semana (o tópico estudado que mais esfriou). */
  kind: 'STUDY' | 'WEEK_REVIEW';
}

export interface DailyPlan {
  dailyMinutesBudget: number;
  /** Todas as matérias já cumpriram a meta da semana: os blocos viram revisão extra. */
  weekCompleted: boolean;
  studiedThisWeekMinutes: number;
  blocks: DailyFocusBlock[];
}

export const MIN_BLOCK_MINUTES = 20;
const MAX_BLOCKS = 2;
const FIRST_BLOCK_SHARE = 0.6;
const URGENT_HEAT = 6.5;
/** Dia acima de 03:00: blocos de no máximo 02:00, até 4 — dois blocos de 03:00 seriam estudo em bloco. */
export const MAX_BLOCK_MINUTES = 120;
export const LONG_DAY_MINUTES = 180;
export const MAX_BLOCKS_LONG_DAY = 4;

function roundTo5(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5);
}

function pickBadge(heatScore: number | null, isTopPriority: boolean): CostBenefitBadge {
  if (heatScore !== null && heatScore >= URGENT_HEAT) return 'REVISAO_URGENTE';
  if (isTopPriority) return 'ALTA_RENTABILIDADE';
  return 'BASE_ESTRATEGICA';
}

function describeReason(allocation: SubjectCycleAllocation, weekCompleted: boolean): string {
  if (weekCompleted) {
    return `Meta da semana cumprida — bloco extra na matéria de maior prioridade (peso ${allocation.subject.exam_weight}x).`;
  }
  return `Faltam ${formatDuration(allocation.remainingThisWeekMinutes)} desta matéria na sua meta da semana • Peso ${allocation.subject.exam_weight}x • Domínio ${allocation.studiedTopicsMastery}%.`;
}

/** Chance de lembrar hoje, `2^(−dias ÷ meia-vida)` — a mesma conta do motor e da Revisão do dia. */
const recallOf = (h: TopicHeatItem) => Math.pow(2, -(h.daysSinceLastStudy ?? 0) / Math.max(1, h.memoryHalfLifeDays));

/** O tópico já estudado que mais esfriou; nenhum estudado, nenhum. */
function coldestStudied(ranking: TopicHeatItem[]): TopicHeatItem | null {
  const studied = ranking.filter((h) => h.daysSinceLastStudy !== null);
  if (studied.length === 0) return null;
  return [...studied].sort((a, b) => recallOf(a) - recallOf(b) || (b.daysSinceLastStudy ?? 0) - (a.daysSinceLastStudy ?? 0))[0];
}

export function planDailyBlocks(params: {
  cycleData: CycleCalculationResult;
  topicsBySubject: Record<string, Topic[]>;
  weeklyHoursTarget: number;
  /** Minutos de hoje (padrão de horas + exceções). Ausente: a semana ÷ 7, como antes das horas por dia. */
  dayMinutesBudget?: number;
  /** Hoje é o dia da Revisão da semana: o tempo dela (0 = não é). */
  weekReviewMinutes?: number;
  /** Tópicos já usados nos dias anteriores da previsão da semana (liberados se a matéria não tiver outro). */
  excludeTopicIds?: ReadonlySet<string>;
}): DailyPlan {
  const { cycleData, topicsBySubject, weeklyHoursTarget } = params;
  const { allocations, topicHeatmapRanking } = cycleData;
  const dailyMinutesBudget = Math.max(0, Math.round(params.dayMinutesBudget ?? (weeklyHoursTarget / 7) * 60));
  const studiedThisWeekMinutes = allocations.reduce((acc, a) => acc + a.studiedThisWeekMinutes, 0);
  const excluded = params.excludeTopicIds ?? new Set<string>();

  const pending = allocations.filter((a) => a.remainingThisWeekMinutes > 0);
  const weekCompleted = allocations.length > 0 && pending.length === 0;
  const byPriority = (a: SubjectCycleAllocation, b: SubjectCycleAllocation) => b.elasticScore - a.elasticScore;
  const candidates = weekCompleted
    ? [...allocations].sort(byPriority)
    : [...pending].sort((a, b) => b.remainingThisWeekMinutes - a.remainingThisWeekMinutes || byPriority(a, b));
  const topScore = Math.max(...allocations.map((a) => a.elasticScore));

  // 1. Revisão da semana: separa o tempo dela, no tópico estudado que mais esfriou
  const reviewHeat = (params.weekReviewMinutes ?? 0) > 0 ? coldestStudied(topicHeatmapRanking) : null;
  const reviewAllocation = reviewHeat ? allocations.find((a) => a.subject.id === reviewHeat.topic.subject_id) : undefined;
  const reviewMinutes = reviewAllocation ? Math.min(params.weekReviewMinutes ?? 0, dailyMinutesBudget) : 0;
  const usedTopicIds = new Set<string>(reviewHeat && reviewAllocation ? [reviewHeat.topic.id] : []);

  // 2. Blocos de estudo
  const pickTopic = (subjectId: string): { topic: Topic | null; heat: TopicHeatItem | undefined } => {
    const free = (h: TopicHeatItem) => h.topic.subject_id === subjectId && !usedTopicIds.has(h.topic.id);
    const heat = topicHeatmapRanking.find((h) => free(h) && !excluded.has(h.topic.id)) ?? topicHeatmapRanking.find(free);
    return { topic: heat?.topic ?? (topicsBySubject[subjectId] || [])[0] ?? null, heat };
  };
  const studyBudget = dailyMinutesBudget - reviewMinutes;
  const studyBlocks =
    studyBudget > LONG_DAY_MINUTES
      ? longDayBlocks({ candidates, budget: studyBudget, weekCompleted, pickTopic, usedTopicIds })
      : shortDayBlocks({ candidates, budget: studyBudget, weekCompleted, pickTopic, usedTopicIds });

  const blocks: DailyFocusBlock[] = studyBlocks.map((b, i) => ({
    blockNumber: i + 1,
    subject: b.allocation.subject,
    topic: b.topic,
    allocation: b.allocation,
    durationMinutes: b.durationMinutes,
    costBenefitBadge: pickBadge(b.heat?.heatScore ?? null, b.allocation.elasticScore === topScore),
    reasonText: describeReason(b.allocation, weekCompleted),
    kind: 'STUDY',
  }));

  // 3. A revisão fecha o dia
  if (reviewHeat && reviewAllocation && reviewMinutes >= MIN_BLOCK_MINUTES) {
    const days = Math.round(reviewHeat.daysSinceLastStudy ?? 0);
    const label = `${reviewHeat.topic.code ?? ''} ${reviewHeat.topic.title}`.trim();
    blocks.push({
      blockNumber: blocks.length + 1,
      subject: reviewAllocation.subject,
      topic: reviewHeat.topic,
      allocation: reviewAllocation,
      durationMinutes: reviewMinutes,
      costBenefitBadge: 'REVISAO_URGENTE',
      reasonText: `Revisão da semana: ${label} foi estudado há ${days} ${days === 1 ? 'dia' : 'dias'}.`,
      kind: 'WEEK_REVIEW',
    });
  }

  return { dailyMinutesBudget, weekCompleted, studiedThisWeekMinutes, blocks };
}

interface PlannedBlock {
  allocation: SubjectCycleAllocation;
  topic: Topic | null;
  heat: TopicHeatItem | undefined;
  durationMinutes: number;
}

interface BlockInput {
  candidates: SubjectCycleAllocation[];
  budget: number;
  weekCompleted: boolean;
  pickTopic: (subjectId: string) => { topic: Topic | null; heat: TopicHeatItem | undefined };
  usedTopicIds: Set<string>;
}

/** Dia de até 03:00: até 2 blocos, o primeiro com 60% do dia — o roteiro de sempre. */
function shortDayBlocks({ candidates, budget: dayBudget, weekCompleted, pickTopic, usedTopicIds }: BlockInput): PlannedBlock[] {
  const blocks: PlannedBlock[] = [];
  let budget = dayBudget;
  for (const allocation of candidates) {
    if (blocks.length >= MAX_BLOCKS || budget < MIN_BLOCK_MINUTES) break;
    const isLastSlot = blocks.length === MAX_BLOCKS - 1 || budget <= 60;
    const target = isLastSlot ? budget : Math.round(budget * FIRST_BLOCK_SHARE);
    const durationMinutes = weekCompleted
      ? target
      : Math.min(target, Math.max(MIN_BLOCK_MINUTES, roundTo5(allocation.remainingThisWeekMinutes)));
    const { topic, heat } = pickTopic(allocation.subject.id);
    if (topic) usedTopicIds.add(topic.id);
    blocks.push({ allocation, topic, heat, durationMinutes });
    budget -= durationMinutes;
  }
  return blocks;
}

/**
 * Dia longo: blocos de até 02:00, uma matéria por bloco na ordem do que falta na semana; a matéria só repete quando
 * nenhuma outra tem tempo sobrando, e com outro tópico.
 */
function longDayBlocks({ candidates, budget: dayBudget, weekCompleted, pickTopic, usedTopicIds }: BlockInput): PlannedBlock[] {
  const blocks: PlannedBlock[] = [];
  const plannedBySubject = new Map<string, number>();
  const left = (a: SubjectCycleAllocation) => a.remainingThisWeekMinutes - (plannedBySubject.get(a.subject.id) ?? 0);
  const hasTime = (a: SubjectCycleAllocation) => weekCompleted || left(a) >= MIN_BLOCK_MINUTES;
  let budget = dayBudget;

  while (blocks.length < MAX_BLOCKS_LONG_DAY && budget >= MIN_BLOCK_MINUTES) {
    const fresh = candidates.find((a) => !plannedBySubject.has(a.subject.id) && hasTime(a));
    const repeat = fresh ? undefined : candidates.find((a) => hasTime(a) && pickTopic(a.subject.id).heat !== undefined);
    const allocation = fresh ?? repeat;
    if (!allocation) break;
    const target = Math.min(MAX_BLOCK_MINUTES, budget);
    const durationMinutes = weekCompleted ? target : Math.min(target, Math.max(MIN_BLOCK_MINUTES, roundTo5(left(allocation))));
    const { topic, heat } = pickTopic(allocation.subject.id);
    if (topic) usedTopicIds.add(topic.id);
    blocks.push({ allocation, topic, heat, durationMinutes });
    plannedBySubject.set(allocation.subject.id, (plannedBySubject.get(allocation.subject.id) ?? 0) + durationMinutes);
    budget -= durationMinutes;
  }
  return blocks;
}
