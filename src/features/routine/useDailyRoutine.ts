import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearDailyPlan, getDailyPlan, localDateKey, saveDailyPlan } from '../../lib/database';
import type { CycleCalculationResult } from '../../lib/cycleEngine';
import { planDailyBlocks } from '../../lib/dailyPlanner';
import { buildRoutine, freezeDailyPlan, pickExtraBlock, routineProfileKey, type RoutineItem } from '../../lib/dailyRoutine';
import type { FrozenBlock, StudyPlan, StudySession, Subject, Topic } from '../../types/database';

/** Meia-noite local do dia 'YYYY-MM-DD', em ISO (as sessões são gravadas em ISO). */
function startOfDayIso(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toISOString();
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
  /** Minutos de hoje (spec 13: padrão de horas + "mudar o tempo de hoje"); ausente = horas da semana ÷ 7. */
  dayMinutes?: number;
  /** Hoje é o dia da Revisão da semana: o tempo dela (0 = não é). */
  weekReviewMinutes?: number;
}) {
  const { dbReady, plan, cycleData, subjects, topicsBySubject, weekSessions, dataVersion, dayMinutes, weekReviewMinutes } = params;
  const dateKey = localDateKey(new Date());
  const [savedVersion, setSavedVersion] = useState(0);

  const livePlan = useMemo(() => {
    if (!plan || !cycleData) return null;
    return planDailyBlocks({
      cycleData,
      topicsBySubject,
      weeklyHoursTarget: plan.weekly_hours_target,
      dayMinutesBudget: dayMinutes,
      weekReviewMinutes,
    });
  }, [plan, cycleData, topicsBySubject, dayMinutes, weekReviewMinutes]);

  const profileKey = plan ? routineProfileKey(plan, subjects, topicsBySubject, dayMinutes, weekReviewMinutes) : '';

  // A data entra nas dependências: virar a meia-noite com o app aberto não pode levar o tempo de ontem
  const todaySessions = useMemo(() => {
    const since = startOfDayIso(dateKey);
    return weekSessions.filter((s) => s.started_at >= since);
  }, [weekSessions, dateKey]);

  // Roteiro gravado só vale se foi congelado com o perfil atual
  const frozen = useMemo(() => {
    if (!dbReady || !plan) return null;
    // dataVersion e savedVersion não aparecem no corpo: estão aqui para reler depois de gravar ou restaurar backup
    void dataVersion;
    void savedVersion;
    const saved = getDailyPlan(plan.id, dateKey);
    if (!saved || saved.profileKey !== profileKey) return null;
    return saved.blocks;
  }, [dbReady, plan, dateKey, profileKey, dataVersion, savedVersion]);

  // 1. Primeira abertura do dia (ou perfil/tempo de hoje mudou): congela o que o motor planejou. Os blocos que já foram
  //    feitos hoje continuam no roteiro; o tempo que sobra do dia vai para blocos novos
  useEffect(() => {
    if (!dbReady || !plan || frozen || !livePlan || !cycleData) return;
    const previous = getDailyPlan(plan.id, dateKey);
    const kept = previous
      ? buildRoutine({ blocks: previous.blocks, subjects, topicsBySubject, todaySessions })
          .filter((i) => i.status === 'done')
          .map((i) => i.block)
      : [];
    if (kept.length === 0) {
      if (livePlan.blocks.length === 0) return;
      saveDailyPlan(plan.id, dateKey, freezeDailyPlan(livePlan), profileKey);
      setSavedVersion((v) => v + 1);
      return;
    }
    // O planejador evita os tópicos já feitos hoje e não põe outra Revisão da semana se ela já foi feita
    const keptMinutes = kept.reduce((acc, b) => acc + b.durationMinutes, 0);
    const keptTopics = new Set(kept.flatMap((b) => (b.topicId ? [b.topicId] : [])));
    const reviewDone = kept.some((b) => b.kind === 'WEEK_REVIEW');
    const rest = planDailyBlocks({
      cycleData,
      topicsBySubject,
      weeklyHoursTarget: plan.weekly_hours_target,
      dayMinutesBudget: dayMinutes === undefined ? undefined : Math.max(0, dayMinutes - keptMinutes),
      weekReviewMinutes: reviewDone ? 0 : weekReviewMinutes,
      excludeTopicIds: keptTopics,
    });
    const blocks = [...kept, ...freezeDailyPlan(rest)].map((b, i) => ({ ...b, blockNumber: i + 1 }));
    saveDailyPlan(plan.id, dateKey, blocks, profileKey);
    setSavedVersion((v) => v + 1);
  }, [dbReady, plan, frozen, livePlan, cycleData, dateKey, profileKey, subjects, topicsBySubject, todaySessions, dayMinutes, weekReviewMinutes]);

  const blocks = useMemo(() => frozen ?? (livePlan ? freezeDailyPlan(livePlan) : []), [frozen, livePlan]);

  const items = useMemo(
    () => buildRoutine({ blocks, subjects, topicsBySubject, todaySessions }),
    [blocks, subjects, topicsBySubject, todaySessions]
  );

  // 2. Roteiro cumprido: um bloco extra escolhido pelo motor UMA vez por plano e dia. O motor recalcula a cada
  //    questão respondida; se o extra acompanhasse, a bancada trocaria de tópico sozinha no meio do estudo.
  const extraRef = useRef<{ key: string; block: FrozenBlock | null } | null>(null);
  const allDone = items.length > 0 && items.every((i) => i.status === 'done');
  const extraKey = `${plan?.id ?? ''}|${dateKey}|${blocks.length}`;
  if (allDone && livePlan && extraRef.current?.key !== extraKey) {
    extraRef.current = { key: extraKey, block: pickExtraBlock(livePlan, blocks) };
  }
  const extraBlock = allDone && extraRef.current?.key === extraKey ? extraRef.current.block : null;

  const extraItem = useMemo<RoutineItem | null>(() => {
    if (!extraBlock) return null;
    const [item] = buildRoutine({ blocks: [extraBlock], subjects, topicsBySubject, todaySessions: [] });
    return item ?? null;
  }, [extraBlock, subjects, topicsBySubject]);

  /** Recalibrar o perfil: o roteiro de hoje do plano calibrado (por padrão, o ativo) é refeito com o perfil novo. */
  const refreeze = useCallback(
    (planId?: string) => {
      const target = planId ?? plan?.id;
      if (!target) return;
      clearDailyPlan(target, localDateKey(new Date()));
      setSavedVersion((v) => v + 1);
    },
    [plan]
  );

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
