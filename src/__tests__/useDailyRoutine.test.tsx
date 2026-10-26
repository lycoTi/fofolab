import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrozenBlock, StudyPlan, StudySession, Subject, Topic } from '../types/database';
import type { CycleCalculationResult } from '../lib/cycleEngine';
import type { DailyPlan } from '../lib/dailyPlanner';

const store = new Map<string, { blocks: FrozenBlock[]; profileKey: string }>();
vi.mock('../lib/database', () => ({
  localDateKey: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  getDailyPlan: (planId: string, date: string) => store.get(`${planId}|${date}`) ?? null,
  saveDailyPlan: (planId: string, date: string, blocks: FrozenBlock[], profileKey: string) =>
    store.set(`${planId}|${date}`, { blocks, profileKey }),
  clearDailyPlan: (planId: string, date: string) => store.delete(`${planId}|${date}`),
}));

let livePlan: DailyPlan;
// Dia sem tempo sobrando não tem bloco novo; fora isso, o plano que o teste mandar
type PlannerCall = { dayMinutesBudget?: number; weekReviewMinutes?: number; excludeTopicIds?: ReadonlySet<string> };
const plannerCalls: PlannerCall[] = [];
vi.mock('../lib/dailyPlanner', () => ({
  planDailyBlocks: (p: PlannerCall) => {
    plannerCalls.push(p);
    return p.dayMinutesBudget === 0 ? { ...livePlan, blocks: [] } : livePlan;
  },
}));

const { useDailyRoutine } = await import('../features/routine/useDailyRoutine');

const ti = { id: 'ti', name: 'TI', color: '#000' } as unknown as Subject;
const topicA = { id: 'a', subject_id: 'ti', code: '1', title: 'A', parent_id: null } as unknown as Topic;
const topicB = { id: 'b', subject_id: 'ti', code: '2', title: 'B', parent_id: null } as unknown as Topic;
const topicC = { id: 'c', subject_id: 'ti', code: '3', title: 'C', parent_id: null } as unknown as Topic;
const plan = (id: string) => ({ id, weekly_hours_target: 7 }) as unknown as StudyPlan;
const live = (topic: Topic, minutes = 30) =>
  ({ studiedThisWeekMinutes: 0, blocks: [{ blockNumber: 1, subject: ti, topic, durationMinutes: minutes, reasonText: 'r' }] }) as unknown as DailyPlan;
const session = (iso: string, minutes: number) =>
  ({ subject_id: 'ti', duration_minutes: minutes, session_type: 'POMODORO', started_at: iso }) as unknown as StudySession;

interface HookProps {
  planId: string;
  sessions: StudySession[];
  version: number;
  dayMinutes?: number;
}

function setup(initial: Partial<HookProps> = {}) {
  const initialProps: HookProps = {
    planId: initial.planId ?? 'p1',
    sessions: initial.sessions ?? [],
    version: initial.version ?? 0,
    dayMinutes: initial.dayMinutes,
  };
  return renderHook(
    (p: HookProps) =>
      useDailyRoutine({
        dbReady: true,
        plan: plan(p.planId),
        cycleData: {} as CycleCalculationResult,
        subjects: [ti],
        topicsBySubject: { ti: [topicA, topicB, topicC] },
        weekSessions: p.sessions,
        dataVersion: p.version,
        dayMinutes: p.dayMinutes,
      }),
    { initialProps }
  );
}

beforeEach(() => {
  store.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 22, 23, 50));
});
afterEach(() => vi.useRealTimers());

describe('roteiro do dia (hook)', () => {
  it('virar a meia-noite não leva o tempo de ontem para o roteiro novo', () => {
    livePlan = live(topicA, 30);
    // Mesma lista de sessões (o app não recarrega os dados só porque o relógio virou o dia)
    const sessions = [session(new Date(2026, 9, 22, 23, 0).toISOString(), 30)];
    const { result, rerender } = setup({ sessions });
    expect(result.current.items[0].status).toBe('done');

    vi.setSystemTime(new Date(2026, 9, 23, 0, 5));
    rerender({ planId: 'p1', sessions, version: 0 });
    expect(result.current.items[0].status).toBe('current');
    expect(result.current.items[0].studiedMinutes).toBe(0);
  });

  it('o bloco extra não muda sozinho quando o motor recalcula', () => {
    livePlan = live(topicA, 30);
    const done = session(new Date(2026, 9, 22, 22, 0).toISOString(), 30);
    const { result, rerender } = setup({ sessions: [done] });
    livePlan = { ...live(topicB), blocks: [...live(topicA).blocks, ...live(topicB).blocks] } as DailyPlan;
    rerender({ planId: 'p1', sessions: [done], version: 0 });
    const firstExtra = result.current.extraItem?.topic?.id;
    expect(firstExtra).toBeTruthy();

    livePlan = { ...live(topicC), blocks: [...live(topicA).blocks, ...live(topicC).blocks] } as DailyPlan;
    rerender({ planId: 'p1', sessions: [done, session(new Date(2026, 9, 22, 22, 40).toISOString(), 1)], version: 0 });
    expect(result.current.extraItem?.topic?.id).toBe(firstExtra);
  });

  it('recalibrar refaz o roteiro do plano indicado, não o do plano ativo', () => {
    livePlan = live(topicA);
    store.set('p2|2026-10-22', { blocks: [{ blockNumber: 1, subjectId: 'ti', topicId: 'b', durationMinutes: 30, reasonText: 'velho' }], profileKey: 'x' });
    const { result } = setup({ planId: 'p1' });
    act(() => result.current.refreeze('p2'));
    expect(store.has('p2|2026-10-22')).toBe(false);
    expect(store.has('p1|2026-10-22')).toBe(true);
  });

  it('perfil mudou (recalibrado e app fechado antes de gravar o roteiro novo): o roteiro é refeito', () => {
    livePlan = live(topicA);
    store.set('p1|2026-10-22', { blocks: [{ blockNumber: 1, subjectId: 'ti', topicId: 'b', durationMinutes: 30, reasonText: 'velho' }], profileKey: 'perfil-antigo' });
    const { result } = setup({ planId: 'p1' });
    expect(result.current.items[0].topic?.id).toBe('a');
    expect(store.get('p1|2026-10-22')?.blocks[0].topicId).toBe('a');
  });

  it('mudar o tempo de hoje regrava o roteiro: blocos feitos continuam feitos e o resto encolhe', () => {
    livePlan = live(topicA, 90);
    const done = session(new Date(2026, 9, 22, 20, 0).toISOString(), 90);
    const { result, rerender } = setup({ sessions: [done], dayMinutes: 150 });
    expect(result.current.items.map((i) => i.status)).toEqual(['done']);

    // O dia passa de 02:30 para 01:00 com 01:30 já estudado: nada novo a fazer, o feito fica
    livePlan = live(topicB, 60);
    rerender({ planId: 'p1', sessions: [done], version: 0, dayMinutes: 60 });
    expect(result.current.items.map((i) => [i.topic?.id, i.status])).toEqual([['a', 'done']]);
    expect(result.current.items.every((i) => i.remainingMinutes >= 0)).toBe(true);
    expect(store.get('p1|2026-10-22')?.blocks.map((b) => b.topicId)).toEqual(['a']);

    // O dia passa para 04:00: o feito continua e entra bloco novo no tempo que sobrou
    rerender({ planId: 'p1', sessions: [done], version: 0, dayMinutes: 240 });
    expect(result.current.items.map((i) => [i.topic?.id, i.status])).toEqual([['a', 'done'], ['b', 'current']]);
  });

  it('roteiro refeito com blocos feitos (inclusive a revisão): o planejador evita os tópicos deles e não põe outra revisão', () => {
    const done = [session(new Date(2026, 9, 22, 20, 0).toISOString(), 90)];
    store.set('p1|2026-10-22', {
      blocks: [
        { blockNumber: 1, subjectId: 'ti', topicId: 'a', durationMinutes: 60, reasonText: 'estudo' },
        { blockNumber: 2, subjectId: 'ti', topicId: 'b', durationMinutes: 30, reasonText: 'revisão', kind: 'WEEK_REVIEW' },
      ],
      profileKey: 'perfil-de-antes',
    });
    livePlan = live(topicC, 60);
    plannerCalls.length = 0;
    const { result } = setup({ sessions: done, dayMinutes: 150 });
    const refreeze = plannerCalls.find((c) => c.dayMinutesBudget === 60);
    expect(refreeze).toBeTruthy();
    expect([...(refreeze?.excludeTopicIds ?? [])].sort()).toEqual(['a', 'b']);
    expect(refreeze?.weekReviewMinutes ?? 0).toBe(0);
    expect(result.current.items.map((i) => [i.topic?.id, i.status])).toEqual([['a', 'done'], ['b', 'done'], ['c', 'current']]);
  });
});
