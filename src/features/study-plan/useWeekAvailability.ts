import { useCallback, useMemo, useState } from 'react';
import {
  minutesForDay,
  parseWeekdayMinutes,
  weekBudgetMinutes,
  weekDateKeys,
  weeklyReviewDay,
  type WeekdayMinutes,
} from '../../lib/availability';
import { startOfWeek } from '../../lib/cycleEngine';
import { getDayOverrides, setDayOverride, setWeekOverride, updateWeekdayMinutes } from '../../lib/database';
import { localDateKey } from '../../lib/timeFormat';
import type { StudyPlan } from '../../types/database';

const NO_TIME: WeekdayMinutes = [0, 0, 0, 0, 0, 0, 0];

/**
 * Horas da semana do plano ativo (spec 13 §4.1): o padrão seg–dom, as exceções desta semana e o que sai delas — os
 * minutos de hoje, o orçamento da semana e o dia da Revisão da semana. A data é relida a cada render: virar a
 * meia-noite com o app aberto troca o "hoje" sem levar a exceção de ontem. Gravar avisa o App (`onChanged`) para
 * recalcular ciclo e roteiro.
 */
export function useWeekAvailability({ plan, now, onChanged }: { plan: StudyPlan | null; now?: Date; onChanged: () => void }) {
  const todayKey = localDateKey(now ?? new Date());
  const [version, setVersion] = useState(0);

  const weekStart = useMemo(() => {
    const [year, month, day] = todayKey.split('-').map(Number);
    return startOfWeek(new Date(year, month - 1, day));
  }, [todayKey]);
  const keys = useMemo(() => weekDateKeys(weekStart), [weekStart]);

  const pattern = useMemo(
    () => (plan ? parseWeekdayMinutes(plan.weekday_minutes_json, plan.weekly_hours_target) : NO_TIME),
    [plan]
  );
  const overrides = useMemo(() => {
    // version não aparece no corpo: está aqui para reler depois de gravar
    void version;
    return plan ? getDayOverrides(plan.id, keys[0], keys[6]) : {};
  }, [plan, keys, version]);

  const changed = useCallback(() => {
    setVersion((v) => v + 1);
    onChanged();
  }, [onChanged]);

  const setPattern = useCallback(
    (minutes: WeekdayMinutes) => {
      if (!plan) return;
      updateWeekdayMinutes(plan.id, minutes);
      changed();
    },
    [plan, changed]
  );
  /** `null` volta ao tempo do padrão; 0 = "Hoje não vou estudar". */
  const setTodayMinutes = useCallback(
    (minutes: number | null) => {
      if (!plan) return;
      setDayOverride(plan.id, todayKey, minutes);
      changed();
    },
    [plan, todayKey, changed]
  );
  /** Semana atípica (os sete dias); `null` volta ao padrão. */
  const setThisWeek = useCallback(
    (minutes: WeekdayMinutes | null) => {
      if (!plan) return;
      setWeekOverride(plan.id, keys[0], minutes);
      changed();
    },
    [plan, keys, changed]
  );

  const thisWeek = keys.every((k) => overrides[k] !== undefined) ? (keys.map((k) => overrides[k]) as WeekdayMinutes) : null;

  return {
    pattern,
    overrides,
    weekStart,
    todayKey,
    todayMinutes: plan ? minutesForDay(todayKey, pattern, overrides) : 0,
    weekBudget: plan ? weekBudgetMinutes(weekStart, pattern, overrides) : 0,
    reviewDayKey: plan ? weeklyReviewDay(weekStart, pattern, overrides) : null,
    thisWeek,
    setPattern,
    setTodayMinutes,
    setThisWeek,
  };
}
