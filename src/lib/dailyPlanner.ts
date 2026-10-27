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

const STRETCH_RECALL_THRESHOLD = 0.85;
const STRETCH_MASTERY_THRESHOLD = 75;

/** Tópico estudado que ainda precisa de revisão na reta final (lembrança abaixo de 85% ou domínio abaixo de 75%). */
function needsStretchReview(h: TopicHeatItem): boolean {
  return (
    h.daysSinceLastStudy !== null &&
    (recallOf(h) < STRETCH_RECALL_THRESHOLD || h.topic.mastery_score < STRETCH_MASTERY_THRESHOLD)
  );
}

function stretchReason(heat: TopicHeatItem): string {
  const days = Math.round(heat.daysSinceLastStudy ?? 0);
  const label = `${heat.topic.code ?? ''} ${heat.topic.title}`.trim();
  return `Reta final: revisar ${label} (estudado há ${days} ${days === 1 ? 'dia' : 'dias'}).`;
}

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
  /** Reta final (spec 13 §4.3): só tópicos já estudados, o mais frio primeiro — nada novo. */
  finalStretch?: boolean;
  /** Liberar tópicos inéditos na reta final por escolha do estudante (spec 12d §3.3). */
  allowNewInFinalStretch?: boolean;
}): DailyPlan {
  const { cycleData, topicsBySubject, weeklyHoursTarget } = params;
  const { allocations, topicHeatmapRanking } = cycleData;
  const dailyMinutesBudget = Math.max(0, Math.round(params.dayMinutesBudget ?? (weeklyHoursTarget / 7) * 60));
  const studiedThisWeekMinutes = allocations.reduce((acc, a) => acc + a.studiedThisWeekMinutes, 0);
  const excluded = params.excludeTopicIds ?? new Set<string>();

  const pending = allocations.filter((a) => a.remainingThisWeekMinutes > 0);
  const weekCompleted = allocations.length > 0 && pending.length === 0;
  const byPriority = (a: SubjectCycleAllocation, b: SubjectCycleAllocation) => b.elasticScore - a.elasticScore;
  // Reta final sem nenhum tópico estudado no plano inteiro (ou com inéditos liberados): segue o roteiro normal
  const stretch =
    params.finalStretch === true && !params.allowNewInFinalStretch && coldestStudied(topicHeatmapRanking) !== null;
  const hasStudied = (subjectId: string) => topicHeatmapRanking.some((h) => h.topic.subject_id === subjectId && h.daysSinceLastStudy !== null);
  const ordered = weekCompleted
    ? [...allocations].sort(byPriority)
    : [...pending].sort((a, b) => b.remainingThisWeekMinutes - a.remainingThisWeekMinutes || byPriority(a, b));
  // Na reta final o dia é de revisão: entram todas as matérias com tópico estudado, por prioridade, e o bloco não é
  // limitado pelo que falta da matéria na semana (senão o dia encolhia ou ficava vazio)
  const candidates = stretch ? [...allocations].filter((a) => hasStudied(a.subject.id)).sort(byPriority) : ordered;
  const fillDay = weekCompleted || stretch;
  const topScore = Math.max(...allocations.map((a) => a.elasticScore));

  // 1. Revisão da semana: separa o tempo dela (só se já há tópico estudado; senão o tempo é de estudo)
  const reviewMinutes =
    (params.weekReviewMinutes ?? 0) > 0 && coldestStudied(topicHeatmapRanking) !== null
      ? Math.min(params.weekReviewMinutes ?? 0, dailyMinutesBudget)
      : 0;
  const usedTopicIds = new Set<string>();

  // 2. Blocos de estudo
  const pickTopic = (subjectId: string): { topic: Topic | null; heat: TopicHeatItem | undefined } => {
    if (stretch) {
      const ofSubject = topicHeatmapRanking.filter((h) => h.topic.subject_id === subjectId && !usedTopicIds.has(h.topic.id));
      // 1. Tópicos estudados da matéria que ainda precisam de revisão (esfriando ou domínio < 75%)
      const needingReview = ofSubject.filter(needsStretchReview);
      if (needingReview.length > 0) {
        const heat = coldestStudied(needingReview.filter((h) => !excluded.has(h.topic.id))) ?? coldestStudied(needingReview) ?? undefined;
        return { topic: heat?.topic ?? null, heat };
      }
      // 2. Todos os estudados da matéria já estão dominados e frescos (spec 12d §3.3): libera inéditos da matéria
      const unseen =
        ofSubject.find((h) => h.daysSinceLastStudy === null && !excluded.has(h.topic.id)) ??
        ofSubject.find((h) => h.daysSinceLastStudy === null);
      if (unseen) return { topic: unseen.topic, heat: unseen };
      // 3. Sem inéditos, revisa o mais frio mesmo já dominado
      const heat = coldestStudied(ofSubject.filter((h) => !excluded.has(h.topic.id))) ?? coldestStudied(ofSubject) ?? undefined;
      return { topic: heat?.topic ?? null, heat };
    }
    const free = (h: TopicHeatItem) => h.topic.subject_id === subjectId && !usedTopicIds.has(h.topic.id);
    const heat = topicHeatmapRanking.find((h) => free(h) && !excluded.has(h.topic.id)) ?? topicHeatmapRanking.find(free);
    return { topic: heat?.topic ?? (topicsBySubject[subjectId] || [])[0] ?? null, heat };
  };
  const planStudy = (budget: number) => {
    usedTopicIds.clear();
    const input = { candidates, budget, weekCompleted: fillDay, pickTopic, usedTopicIds };
    // Reta final: blocos de até 02:00 que podem repetir a matéria com outro tópico (poucas matérias estudadas)
    return budget > LONG_DAY_MINUTES || stretch ? longDayBlocks(input) : shortDayBlocks(input);
  };
  // O tópico da revisão é o estudado mais frio que os blocos de estudo do dia não usaram
  const coldestFree = () => coldestStudied(topicHeatmapRanking.filter((h) => !usedTopicIds.has(h.topic.id)));
  let studyBlocks = planStudy(dailyMinutesBudget - reviewMinutes);
  let reviewHeat = reviewMinutes >= MIN_BLOCK_MINUTES ? coldestFree() : null;
  // Os blocos ficaram com o único tópico estudado: sem revisão hoje, o tempo dela volta para estudo
  if (reviewMinutes > 0 && !reviewHeat) {
    studyBlocks = planStudy(dailyMinutesBudget);
    reviewHeat = null;
  }

  const blocks: DailyFocusBlock[] = studyBlocks.map((b, i) => ({
    blockNumber: i + 1,
    subject: b.allocation.subject,
    topic: b.topic,
    allocation: b.allocation,
    durationMinutes: b.durationMinutes,
    costBenefitBadge: pickBadge(b.heat?.heatScore ?? null, b.allocation.elasticScore === topScore),
    reasonText: stretch && b.heat && b.heat.daysSinceLastStudy !== null ? stretchReason(b.heat) : describeReason(b.allocation, weekCompleted),
    kind: 'STUDY',
  }));

  // 3. A revisão fecha o dia
  const reviewAllocation = reviewHeat ? allocations.find((a) => a.subject.id === reviewHeat.topic.subject_id) : undefined;
  if (reviewHeat && reviewAllocation) {
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
  // As matérias dos 2 blocos tinham pouco tempo sobrando na semana: outras completam o dia (fim de semana com tudo
  // quase cumprido deixava o sábado pela metade)
  const used = new Set(blocks.map((b) => b.allocation.subject.id));
  for (const allocation of candidates) {
    if (blocks.length >= MAX_BLOCKS_LONG_DAY || budget < MIN_BLOCK_MINUTES || weekCompleted) break;
    if (used.has(allocation.subject.id)) continue;
    const durationMinutes = Math.min(budget, Math.max(MIN_BLOCK_MINUTES, roundTo5(allocation.remainingThisWeekMinutes)));
    const { topic, heat } = pickTopic(allocation.subject.id);
    if (topic) usedTopicIds.add(topic.id);
    blocks.push({ allocation, topic, heat, durationMinutes });
    used.add(allocation.subject.id);
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
