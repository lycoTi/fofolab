import type { CycleCalculationResult, SubjectCycleAllocation } from './cycleEngine';
import type { Subject, Topic } from '../types/database';

/**
 * Roteiro do "Meu Dia de Hoje" (docs/specs/05): escolhe as matérias pelo que FALTA estudar
 * na semana (ciclo aplicado − minutos já registrados desde segunda) e, no empate, pela prioridade.
 * Antes, a tela pegava as duas primeiras disciplinas em ordem alfabética, todos os dias.
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
  return `Faltam ${allocation.remainingThisWeekMinutes} min desta matéria na sua meta da semana • Peso ${allocation.subject.exam_weight}x • Domínio ${allocation.studiedTopicsMastery}%.`;
}

export function planDailyBlocks(params: {
  cycleData: CycleCalculationResult;
  topicsBySubject: Record<string, Topic[]>;
  weeklyHoursTarget: number;
}): DailyPlan {
  const { cycleData, topicsBySubject, weeklyHoursTarget } = params;
  const { allocations, topicHeatmapRanking } = cycleData;
  const dailyMinutesBudget = Math.round((weeklyHoursTarget / 7) * 60);
  const studiedThisWeekMinutes = allocations.reduce((acc, a) => acc + a.studiedThisWeekMinutes, 0);

  const pending = allocations.filter((a) => a.remainingThisWeekMinutes > 0);
  const weekCompleted = allocations.length > 0 && pending.length === 0;
  const byPriority = (a: SubjectCycleAllocation, b: SubjectCycleAllocation) => b.elasticScore - a.elasticScore;
  const candidates = weekCompleted
    ? [...allocations].sort(byPriority)
    : [...pending].sort((a, b) => b.remainingThisWeekMinutes - a.remainingThisWeekMinutes || byPriority(a, b));

  const topScore = Math.max(...allocations.map((a) => a.elasticScore));
  const usedTopicIds = new Set<string>();
  const blocks: DailyFocusBlock[] = [];
  let budget = dailyMinutesBudget;

  for (const allocation of candidates) {
    if (blocks.length >= MAX_BLOCKS || budget < MIN_BLOCK_MINUTES) break;

    const isLastSlot = blocks.length === MAX_BLOCKS - 1 || budget <= 60;
    const target = isLastSlot ? budget : Math.round(budget * FIRST_BLOCK_SHARE);
    const durationMinutes = weekCompleted
      ? target
      : Math.min(target, Math.max(MIN_BLOCK_MINUTES, roundTo5(allocation.remainingThisWeekMinutes)));

    const heat = topicHeatmapRanking.find(
      (h) => h.topic.subject_id === allocation.subject.id && !usedTopicIds.has(h.topic.id)
    );
    const topic = heat?.topic ?? (topicsBySubject[allocation.subject.id] || [])[0] ?? null;
    if (topic) usedTopicIds.add(topic.id);

    blocks.push({
      blockNumber: blocks.length + 1,
      subject: allocation.subject,
      topic,
      allocation,
      durationMinutes,
      costBenefitBadge: pickBadge(heat?.heatScore ?? null, allocation.elasticScore === topScore),
      reasonText: describeReason(allocation, weekCompleted),
    });
    budget -= durationMinutes;
  }

  return { dailyMinutesBudget, weekCompleted, studiedThisWeekMinutes, blocks };
}
