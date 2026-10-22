import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearDailyPlan, getDailyPlan, localDateKey, saveDailyPlan } from '../../lib/database';
import type { CycleCalculationResult } from '../../lib/cycleEngine';
import { planDailyBlocks } from '../../lib/dailyPlanner';
import { buildRoutine, freezeDailyPlan, pickExtraBlock, type RoutineItem } from '../../lib/dailyRoutine';
import type { StudyPlan, StudySession, Subject, Topic } from '../../types/database';

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/**
 * Roteiro de hoje (spec 09): congelado no banco na primeira abertura do dia (por plano) e classificado
 * pelas sessões de hoje. A data é recalculada a cada render, então virar a meia-noite com o app aberto
 * congela o roteiro do dia novo na próxima atualização dos dados.
 */
export function useDailyRoutine(params: {
  dbReady: boolean;
  plan: StudyPlan | null;
  cycleData: CycleCalculationResult | null;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  /** Sessões da semana (o App já carrega); as de hoje são filtradas aqui. */
  weekSessions: StudySession[];
  dataVersion: number;
}) {
  const { dbReady, plan, cycleData, subjects, topicsBySubject, weekSessions, dataVersion } = params;
  const dateKey = localDateKey(new Date());
  const [savedVersion, setSavedVersion] = useState(0);

  const livePlan = useMemo(() => {
    if (!plan || !cycleData) return null;
    return planDailyBlocks({ cycleData, topicsBySubject, weeklyHoursTarget: plan.weekly_hours_target });
  }, [plan, cycleData, topicsBySubject]);

  const frozen = useMemo(() => {
    if (!dbReady || !plan) return null;
    // dataVersion e savedVersion não aparecem no corpo: estão aqui para reler depois de gravar ou restaurar backup
    void dataVersion;
    void savedVersion;
    return getDailyPlan(plan.id, dateKey);
  }, [dbReady, plan, dateKey, dataVersion, savedVersion]);

  // 1. Primeira abertura do dia: congela o que o motor planejou
  useEffect(() => {
    if (!dbReady || !plan || frozen || !livePlan || livePlan.blocks.length === 0) return;
    saveDailyPlan(plan.id, dateKey, freezeDailyPlan(livePlan));
    setSavedVersion((v) => v + 1);
  }, [dbReady, plan, frozen, livePlan, dateKey]);

  const blocks = useMemo(() => frozen ?? (livePlan ? freezeDailyPlan(livePlan) : []), [frozen, livePlan]);

  const todaySessions = useMemo(() => {
    const since = startOfTodayIso();
    return weekSessions.filter((s) => s.started_at >= since);
  }, [weekSessions]);

  const items = useMemo(
    () => buildRoutine({ blocks, subjects, topicsBySubject, todaySessions }),
    [blocks, subjects, topicsBySubject, todaySessions]
  );

  // 2. Roteiro cumprido: um bloco extra escolhido pelo motor
  const extraItem = useMemo<RoutineItem | null>(() => {
    const allDone = items.length > 0 && items.every((i) => i.status === 'done');
    if (!allDone || !livePlan) return null;
    const extra = pickExtraBlock(livePlan, blocks);
    if (!extra) return null;
    const [item] = buildRoutine({ blocks: [extra], subjects, topicsBySubject, todaySessions: [] });
    return item ?? null;
  }, [items, livePlan, blocks, subjects, topicsBySubject]);

  /** Recalibrar o perfil: o roteiro de hoje é refeito com o perfil novo. */
  const refreeze = useCallback(() => {
    if (!plan) return;
    clearDailyPlan(plan.id, localDateKey(new Date()));
    setSavedVersion((v) => v + 1);
  }, [plan]);

  const currentItem = items.find((i) => i.status === 'current') ?? extraItem;
  const dayTotalMinutes = blocks.reduce((acc, b) => acc + b.durationMinutes, 0);

  return {
    items,
    extraItem,
    currentItem,
    dayTotalMinutes,
    weekStudiedMinutes: livePlan?.studiedThisWeekMinutes ?? 0,
    refreeze,
  };
}
