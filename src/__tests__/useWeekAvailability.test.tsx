import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeekdayMinutes } from '../lib/availability';
import type { StudyPlan } from '../types/database';

const overrides = new Map<string, number>();
let savedPattern: WeekdayMinutes | null = null;
vi.mock('../lib/database', () => ({
  getDayOverrides: (_planId: string, from: string, to: string) =>
    Object.fromEntries([...overrides].filter(([k]) => k >= from && k <= to)),
  setDayOverride: (_planId: string, key: string, minutes: number | null) => {
    if (minutes === null) overrides.delete(key);
    else overrides.set(key, minutes);
  },
  setWeekOverride: (_planId: string, weekStartKey: string, minutes: WeekdayMinutes | null) => {
    const [y, m, d] = weekStartKey.split('-').map(Number);
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(y, m - 1, d + i);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      if (minutes === null) overrides.delete(key);
      else overrides.set(key, minutes[i]);
    }
  },
  updateWeekdayMinutes: (_planId: string, minutes: WeekdayMinutes) => {
    savedPattern = minutes;
    return null;
  },
}));

const { useWeekAvailability } = await import('../features/study-plan/useWeekAvailability');

const plan = { id: 'p', weekly_hours_target: 17.5, weekday_minutes_json: '[150,150,150,150,150,300,0]' } as unknown as StudyPlan;
const TUESDAY = new Date(2026, 9, 27, 10, 0);
const WEDNESDAY = new Date(2026, 9, 28, 10, 0);

beforeEach(() => {
  overrides.clear();
  savedPattern = null;
});

describe('Disponibilidade da semana no app (spec 13 §4.1)', () => {
  it('lê o padrão do plano e calcula hoje e a semana', () => {
    const { result } = renderHook(() => useWeekAvailability({ plan, now: TUESDAY, onChanged: vi.fn() }));
    expect(result.current.pattern).toEqual([150, 150, 150, 150, 150, 300, 0]);
    expect(result.current.todayKey).toBe('2026-10-27');
    expect(result.current.todayMinutes).toBe(150);
    expect(result.current.weekBudget).toBe(1050);
    expect(result.current.reviewDayKey).toBe('2026-10-31');
    expect(result.current.thisWeek).toBeNull();
  });

  it('"mudar o tempo de hoje" vale só para hoje; virar o dia não leva a exceção de ontem', () => {
    const onChanged = vi.fn();
    const { result, rerender } = renderHook((p: { now: Date }) => useWeekAvailability({ plan, now: p.now, onChanged }), {
      initialProps: { now: TUESDAY },
    });
    act(() => result.current.setTodayMinutes(60));
    expect(onChanged).toHaveBeenCalled();
    expect(result.current.todayMinutes).toBe(60);
    expect(result.current.weekBudget).toBe(1050 - 90);
    rerender({ now: WEDNESDAY });
    expect(result.current.todayKey).toBe('2026-10-28');
    expect(result.current.todayMinutes).toBe(150);
  });

  it('semana atípica: grava os sete dias e "voltar ao padrão" apaga', () => {
    const { result } = renderHook(() => useWeekAvailability({ plan, now: TUESDAY, onChanged: vi.fn() }));
    act(() => result.current.setThisWeek([60, 60, 60, 60, 60, 60, 0]));
    expect(result.current.thisWeek).toEqual([60, 60, 60, 60, 60, 60, 0]);
    expect(result.current.weekBudget).toBe(360);
    act(() => result.current.setThisWeek(null));
    expect(result.current.thisWeek).toBeNull();
    expect(result.current.weekBudget).toBe(1050);
  });

  it('editar o padrão grava no plano', () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useWeekAvailability({ plan, now: TUESDAY, onChanged }));
    act(() => result.current.setPattern([120, 0, 120, 0, 120, 300, 0]));
    expect(savedPattern).toEqual([120, 0, 120, 0, 120, 300, 0]);
    expect(onChanged).toHaveBeenCalled();
  });

  it('sem plano, tudo zerado e sem quebrar', () => {
    const { result } = renderHook(() => useWeekAvailability({ plan: null, now: TUESDAY, onChanged: vi.fn() }));
    expect(result.current.weekBudget).toBe(0);
    expect(result.current.todayMinutes).toBe(0);
  });
});

describe('"Voltar ao tempo de sempre" só para a exceção de hoje (revisão independente da 13a)', () => {
  it('hoje mudado sozinho pode voltar; dentro de uma semana atípica, não (quem edita é o "Ajustar")', () => {
    const { result } = renderHook(() => useWeekAvailability({ plan, now: TUESDAY, onChanged: vi.fn() }));
    expect(result.current.todayOverridden).toBe(false);
    act(() => result.current.setTodayMinutes(60));
    expect(result.current.todayOverridden).toBe(true);
    act(() => result.current.setThisWeek([60, 60, 60, 60, 60, 60, 0]));
    expect(result.current.todayOverridden).toBe(false);
  });
});
