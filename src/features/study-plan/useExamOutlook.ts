import { useMemo } from 'react';
import type { WeekdayMinutes } from '../../lib/availability';
import type { CycleCalculationResult } from '../../lib/cycleEngine';
import { getDayOverrides, getStudySessionsSince, getTopicFirstStudyDates } from '../../lib/database';
import { examOutlook, type ExamOutlook } from '../../lib/examProjection';
import { localDateKey } from '../../lib/timeFormat';
import type { ExamPart, StudyPlan, StudySession, Subject, Topic } from '../../types/database';

/** Janela dos fatos do banco: o ritmo real olha as últimas 4 semanas; as exceções de horas, as 2 últimas. */
const FACTS_DAYS = 28;
const OVERRIDES_BACK_DAYS = 14;
const DAY_MS = 86_400_000;

/**
 * "Dá tempo?" e a linha do tempo (spec 13 §4.3): carrega do banco as sessões das últimas 4 semanas e a primeira vez de
 * cada tópico, e projeta. Os fatos são relidos quando os dados ou o dia mudam, não a cada render.
 */
export function useExamOutlook(input: {
  dbReady: boolean;
  plan: StudyPlan | null;
  cycleData: CycleCalculationResult | null;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  examParts: ExamPart[];
  pattern: WeekdayMinutes;
  /** Sessões desta semana (o App já carrega): mudam quando se estuda, e com elas os fatos. */
  weekSessions: StudySession[];
  dataVersion: number;
  now?: Date;
}): ExamOutlook | null {
  const now = input.now ?? new Date();
  const todayKey = localDateKey(now);
  const { dbReady, weekSessions, dataVersion } = input;
  const planId = input.plan?.id ?? null;
  const examDate = input.plan?.exam_date ?? null;

  const facts = useMemo(() => {
    if (!dbReady) return null;
    // Estão aqui para reler o banco depois de estudar, de restaurar um backup ou de virar o dia
    void weekSessions;
    void dataVersion;
    const [year, month, day] = todayKey.split('-').map(Number);
    const since = new Date(new Date(year, month - 1, day).getTime() - FACTS_DAYS * DAY_MS).toISOString();
    // Exceções de horas de 2 semanas atrás (o ritmo real compara com o planejado) até a prova (semanas atípicas futuras)
    const overrides =
      planId && examDate
        ? getDayOverrides(planId, localDateKey(new Date(year, month - 1, day - OVERRIDES_BACK_DAYS)), examDate)
        : {};
    return { sessions: getStudySessionsSince(since), firstStudyDates: getTopicFirstStudyDates(), overrides };
  }, [dbReady, weekSessions, dataVersion, todayKey, planId, examDate]);

  const { plan, cycleData, subjects, topicsBySubject, examParts, pattern } = input;
  return useMemo(() => {
    if (!facts || !plan || !cycleData) return null;
    const subjectIds = new Set(subjects.map((s) => s.id));
    const todayStudiedMinutes = weekSessions
      .filter((s) => !s.was_skipped && subjectIds.has(s.subject_id) && localDateKey(new Date(s.started_at)) === todayKey)
      .reduce((acc, s) => acc + s.duration_minutes, 0);
    return examOutlook({
      plan,
      now: input.now ?? new Date(),
      pattern,
      overrides: facts.overrides,
      subjects,
      topicsBySubject,
      cycleData,
      examParts,
      sessions: facts.sessions,
      firstStudyDates: facts.firstStudyDates,
      todayStudiedMinutes,
    });
    // O relógio fica fora: a projeção muda com os dados e com o dia (todayKey)
  }, [facts, plan, cycleData, subjects, topicsBySubject, examParts, pattern, weekSessions, todayKey, input.now]);
}
