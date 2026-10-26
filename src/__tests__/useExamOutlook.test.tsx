import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SEED_STUDY_PLANS, SEED_SUBJECTS, SEED_TOPIC_LINKS, SEED_TOPICS } from '../data/initialSeed';
import { calculateDynamicStudyCycle } from '../lib/cycleEngine';
import type { Topic } from '../types/database';

// Semana atípica gravada lá na frente (02/11 a 08/11 de folga): a projeção precisa enxergá-la
const futureOff = Object.fromEntries(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].map((k) => [k, 0]));
let askedRange: [string, string] | null = null;
vi.mock('../lib/database', () => ({
  getStudySessionsSince: () => [],
  getTopicFirstStudyDates: () => ({}),
  getDayOverrides: (_planId: string, from: string, to: string) => {
    askedRange = [from, to];
    return futureOff;
  },
}));

const { useExamOutlook } = await import('../features/study-plan/useExamOutlook');

const plan = { ...SEED_STUDY_PLANS[0], exam_date: '2026-12-13', final_stretch_days: 14 };
const subjects = SEED_SUBJECTS.filter((s) => s.plan_id === plan.id);
const topicsBySubject: Record<string, Topic[]> = {};
for (const s of subjects) topicsBySubject[s.id] = SEED_TOPICS.filter((t) => t.subject_id === s.id);
const NOW = new Date(2026, 9, 26, 10, 0);
const cycleData = calculateDynamicStudyCycle({ plan, subjects, topicsBySubject, attempts: [], sessions: [], topicLinks: SEED_TOPIC_LINKS, now: NOW });
const base = {
  plan, cycleData, subjects, topicsBySubject, examParts: [], pattern: [180, 180, 180, 180, 180, 180, 180] as [number, number, number, number, number, number, number],
  weekSessions: [], dataVersion: 0, now: NOW,
};

describe('"Dá tempo?" no app (spec 13 §4.3)', () => {
  it('com o banco pronto e a data da prova, projeta até a reta final', () => {
    const { result } = renderHook(() => useExamOutlook({ ...base, dbReady: true }));
    expect(result.current?.status).toBe('PROJETANDO');
    expect(result.current?.stretchStartKey).toBe('2026-11-29');
  });

  it('antes do banco abrir, nada', () => {
    const { result } = renderHook(() => useExamOutlook({ ...base, dbReady: false }));
    expect(result.current).toBeNull();
  });

  it('usa as exceções de horas de 14 dias atrás até a prova (semanas atípicas futuras entram)', () => {
    const { result } = renderHook(() => useExamOutlook({ ...base, dbReady: true }));
    expect(askedRange).toEqual(['2026-10-12', '2026-12-13']);
    expect(result.current?.weeks[1].newTopicMinutes).toBe(0);
  });
});
