import {
  minutesForDay,
  WEEKDAY_LABELS,
  weekBudgetMinutes,
  weekDateKeys,
  weeklyReviewDay,
  weekReviewDuration,
  type WeekdayMinutes,
} from './availability';
import type { CycleCalculationResult } from './cycleEngine';
import { MIN_BLOCK_MINUTES, planDailyBlocks } from './dailyPlanner';
import { localDateKey } from './timeFormat';
import type { FrozenBlock, StudySession, Topic } from '../types/database';

/**
 * Sua semana (spec 13 §4.2): os dias que passaram mostram o que foi feito; hoje é o roteiro gravado (o mesmo da
 * coluna); os dias que vêm são previsão — o mesmo planejador do roteiro, com as horas de cada dia e o que ainda falta de
 * cada matéria depois dos dias anteriores. A sobra da semana não é empurrada para nenhum dia: não vira dívida.
 */
export interface ForecastBlock {
  subjectId: string;
  topicId: string | null;
  minutes: number;
  kind: 'STUDY' | 'WEEK_REVIEW';
}

export interface DayForecast {
  dateKey: string;
  /** "Ter 27" */
  label: string;
  plannedMinutes: number;
  studiedMinutes: number;
  /** Folga: nenhum minuto no plano e nada estudado. */
  rest: boolean;
  when: 'past' | 'today' | 'future';
  blocks: ForecastBlock[];
}

/** Sessões de um dia agrupadas por matéria e tópico, na ordem em que apareceram. */
function doneBlocks(sessions: StudySession[]): ForecastBlock[] {
  const byKey = new Map<string, ForecastBlock>();
  for (const s of sessions) {
    const key = `${s.subject_id}|${s.topic_id ?? ''}`;
    const block = byKey.get(key) ?? { subjectId: s.subject_id, topicId: s.topic_id, minutes: 0, kind: 'STUDY' as const };
    block.minutes += s.duration_minutes;
    byKey.set(key, block);
  }
  return [...byKey.values()];
}

export function forecastWeek(input: {
  weekStart: Date;
  now: Date;
  pattern: WeekdayMinutes;
  overrides: Record<string, number>;
  cycleData: CycleCalculationResult;
  topicsBySubject: Record<string, Topic[]>;
  weekSessions: StudySession[];
  todayBlocks: FrozenBlock[];
  reviewEnabled: boolean;
  /** Primeiro dia da reta final (spec 13 §4.3): a partir dele, só revisão. */
  stretchStartKey?: string | null;
  /** Liberar tópicos novos na reta final (spec 12d §3.3). */
  allowNewInFinalStretch?: boolean;
}): DayForecast[] {
  const { weekStart, pattern, overrides, cycleData, topicsBySubject } = input;
  const todayKey = localDateKey(input.now);
  const keys = weekDateKeys(weekStart);
  const reviewDay = input.reviewEnabled ? weeklyReviewDay(weekStart, pattern, overrides) : null;
  const weekBudget = weekBudgetMinutes(weekStart, pattern, overrides);
  const reviewMinutes = weekReviewDuration(weekBudget);
  // Sessão pulada não conta como estudo (o motor do ciclo também a ignora)
  const sessions = input.weekSessions.filter((s) => !s.was_skipped);
  const sessionsOn = (key: string) => sessions.filter((s) => localDateKey(new Date(s.started_at)) === key);

  // 1. O que ainda falta de cada matéria depois de hoje (o que hoje ainda vai fazer já está reservado)
  const remaining = new Map(cycleData.allocations.map((a) => [a.subject.id, a.remainingThisWeekMinutes]));
  const todayStudied = new Map<string, number>();
  for (const s of sessionsOn(todayKey)) todayStudied.set(s.subject_id, (todayStudied.get(s.subject_id) ?? 0) + s.duration_minutes);
  const todayPlanned = new Map<string, number>();
  for (const b of input.todayBlocks) todayPlanned.set(b.subjectId, (todayPlanned.get(b.subjectId) ?? 0) + b.durationMinutes);
  let todayStillToDo = 0;
  for (const [subjectId, planned] of todayPlanned) {
    const stillToDo = Math.max(0, planned - (todayStudied.get(subjectId) ?? 0));
    todayStillToDo += stillToDo;
    remaining.set(subjectId, Math.max(0, (remaining.get(subjectId) ?? 0) - stillToDo));
  }
  // Teto do que os próximos dias ainda podem receber: nem o que falta das matérias, nem o que sobra da semana — estudar
  // a mais numa matéria não abre espaço extra nas outras, e semana cumprida não ganha blocos extra na previsão
  const studiedWeek = sessions.reduce((acc, s) => acc + s.duration_minutes, 0);
  const sumRemaining = [...remaining.values()].reduce((acc, m) => acc + m, 0);
  let weekLeft = Math.max(0, Math.min(sumRemaining, weekBudget - studiedWeek - todayStillToDo));

  // 2. Tópicos que a semana já usou não repetem enquanto a matéria tiver outro
  const usedTopics = new Set<string>();
  for (const s of sessions) if (s.topic_id) usedTopics.add(s.topic_id);
  for (const b of input.todayBlocks) if (b.topicId) usedTopics.add(b.topicId);

  return keys.map((dateKey, i) => {
    const plannedMinutes = minutesForDay(dateKey, pattern, overrides);
    const day = Number(dateKey.slice(8));
    const label = `${WEEKDAY_LABELS[i]} ${day}`;
    const studied = dateKey <= todayKey ? sessionsOn(dateKey) : [];
    const studiedMinutes = studied.reduce((acc, s) => acc + s.duration_minutes, 0);
    const base = { dateKey, label, plannedMinutes, studiedMinutes, rest: plannedMinutes === 0 && studiedMinutes === 0 };

    if (dateKey < todayKey) return { ...base, when: 'past' as const, blocks: doneBlocks(studied) };
    if (dateKey === todayKey) {
      const blocks = input.todayBlocks.map((b) => ({
        subjectId: b.subjectId,
        topicId: b.topicId,
        minutes: b.durationMinutes,
        kind: b.kind ?? ('STUDY' as const),
      }));
      return { ...base, when: 'today' as const, blocks };
    }

    // 3. Dia que vem: o planejador do roteiro com as horas do dia e o que sobrou da semana
    const dayCap = Math.min(plannedMinutes, weekLeft);
    if (dayCap < MIN_BLOCK_MINUTES) return { ...base, when: 'future' as const, blocks: [] };
    const dayCycle: CycleCalculationResult = {
      ...cycleData,
      allocations: cycleData.allocations.map((a) => ({ ...a, remainingThisWeekMinutes: remaining.get(a.subject.id) ?? 0 })),
    };
    const plan = planDailyBlocks({
      cycleData: dayCycle,
      topicsBySubject,
      weeklyHoursTarget: cycleData.totalWeeklyMinutesBudget / 60,
      dayMinutesBudget: dayCap,
      weekReviewMinutes: dateKey === reviewDay ? reviewMinutes : 0,
      excludeTopicIds: usedTopics,
      finalStretch: input.stretchStartKey ? dateKey >= input.stretchStartKey : false,
      allowNewInFinalStretch: input.allowNewInFinalStretch,
    });
    const blocks = plan.blocks.map((b) => ({ subjectId: b.subject.id, topicId: b.topic?.id ?? null, minutes: b.durationMinutes, kind: b.kind }));
    for (const b of blocks) {
      remaining.set(b.subjectId, Math.max(0, (remaining.get(b.subjectId) ?? 0) - b.minutes));
      weekLeft = Math.max(0, weekLeft - b.minutes);
      if (b.topicId) usedTopics.add(b.topicId);
    }
    return { ...base, when: 'future' as const, blocks };
  });
}
