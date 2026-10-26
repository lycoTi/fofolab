import { describe, expect, it } from 'vitest';
import type { WeekdayMinutes } from '../lib/availability';
import type { CycleCalculationResult } from '../lib/cycleEngine';
import { examOutlook } from '../lib/examProjection';
import type { ExamPart, StudyPlan, StudySession, Subject, Topic } from '../types/database';

const NOW = new Date(2026, 9, 26, 10, 0); // segunda 26/10/2026
const DAY = 86_400_000;
const plan = { id: 'p', exam_date: '2026-12-13', final_stretch_days: 14, weekly_hours_target: 21, daily_review_enabled: 0 } as unknown as StudyPlan;
const parts: ExamPart[] = [
  { id: 'p1', plan_id: 'p', code: 'P1', name: 'Conhecimentos básicos', item_count: 40, points_per_item: 1, min_score: null, sort_order: 1 } as ExamPart,
  { id: 'p2', plan_id: 'p', code: 'P2', name: 'Conhecimentos complementares', item_count: 40, points_per_item: 1, min_score: 12, sort_order: 2 } as ExamPart,
];
const subjectA = { id: 'A', name: 'Matéria A', initial_knowledge_level: 1, exam_part_id: 'p1' } as unknown as Subject;
const subjectB = { id: 'B', name: 'Matéria B', initial_knowledge_level: 1, exam_part_id: 'p2' } as unknown as Subject;
const topicsOf = (s: string) =>
  Array.from({ length: 10 }, (_, i) => ({ id: `${s}${i + 1}`, subject_id: s, code: `${i + 1}`, title: `Tópico ${s}${i + 1}`, parent_id: null, initial_knowledge_level: null, last_studied_at: null })) as unknown as Topic[];
const topicsBySubject = { A: topicsOf('A'), B: topicsOf('B') };
// Ciclo: A com 90% da semana, B com 10%
const cycleData = {
  allocations: [
    { subject: subjectA, currentWeeklyMinutes: 900 },
    { subject: subjectB, currentWeeklyMinutes: 100 },
  ],
  topicHeatmapRanking: [],
} as unknown as CycleCalculationResult;
const session = (minutes: number, daysAgo: number): StudySession => ({
  id: `s${daysAgo}-${minutes}`, subject_id: 'A', topic_id: 'A1', duration_minutes: minutes, session_type: 'POMODORO',
  pauses_count: 0, was_skipped: 0, started_at: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
});

function outlook(over: { pattern?: WeekdayMinutes; sessions?: StudySession[]; firstStudyDates?: Record<string, string>; planOver?: Partial<StudyPlan> } = {}) {
  return examOutlook({
    plan: { ...plan, ...over.planOver } as StudyPlan,
    now: NOW,
    pattern: over.pattern ?? [180, 180, 180, 180, 180, 180, 180],
    overrides: {},
    subjects: [subjectA, subjectB],
    topicsBySubject,
    cycleData,
    examParts: parts,
    sessions: over.sessions ?? [],
    firstStudyDates: over.firstStudyDates ?? {},
    todayStudiedMinutes: 0,
  });
}

describe('"Dá tempo?" (spec 13 §4.3)', () => {
  it('com horas de sobra: 100% até a véspera da reta final e nenhuma saída', () => {
    const o = outlook()!;
    expect(o.status).toBe('PROJETANDO');
    expect(o.stretchStartKey).toBe('2026-11-29');
    expect(o.coverageAtStretch).toBe(100);
    expect(o.extraWeeklyMinutes).toBe(0);
    expect(o.leftForLater).toEqual([]);
    expect(o.weeks.at(-1)?.phase).toBe('RETA_FINAL');
  });

  it('com pouco tempo: % abaixo de 100, as horas a mais por semana e o que fica para depois', () => {
    const o = outlook({ pattern: [120, 0, 0, 0, 0, 0, 0] })!;
    expect(o.coverageAtStretch).toBeLessThan(100);
    expect(o.extraWeeklyMinutes).toBeGreaterThan(0);
    expect(o.extraWeeklyMinutes % 30).toBe(0);
    expect(o.leftForLater.length).toBeGreaterThan(0);
    expect(o.leftForLater[0].title).toMatch(/^Tópico /);
  });

  it('ritmo real bem abaixo do plano aparece; perto do plano ou com pouco uso, não', () => {
    const tenDaysAgo = new Date(NOW.getTime() - 20 * DAY).toISOString();
    // 15:30 por semana nas últimas 2 semanas, com o plano em 21:00
    const slow = outlook({ sessions: [session(930, 2), session(930, 9)], firstStudyDates: { A1: tenDaysAgo } })!;
    expect(slow.real?.weeklyMinutes).toBe(930);
    // 20:00 por semana: menos de 10% abaixo do plano
    expect(outlook({ sessions: [session(1200, 2), session(1200, 9)], firstStudyDates: { A1: tenDaysAgo } })!.real).toBeNull();
    // Só 5 dias de uso
    const recent = new Date(NOW.getTime() - 5 * DAY).toISOString();
    expect(outlook({ sessions: [session(100, 2)], firstStudyDates: { A1: recent } })!.real).toBeNull();
  });

  it('P1/P2 com o % projetado e o aviso da prova com nota mínima ficando para trás', () => {
    const o = outlook({ pattern: [120, 0, 0, 0, 0, 0, 0] })!;
    expect(o.parts.map((p) => p.code)).toEqual(['P1', 'P2']);
    expect(o.parts[0].coverageAtStretch).toBeGreaterThan(o.parts[1].coverageAtStretch);
    expect(o.partWarning).toMatch(/^P2 está ficando para trás/);
  });

  it('o "ⓘ" sabe de onde vem o tempo por tópico', () => {
    expect(outlook()!.topicMinutes).toMatchObject({ source: 'AUTOAVALIACAO', sample: 0 });
  });

  it('sem data da prova: nada; hoje na reta final; prova que já passou', () => {
    expect(outlook({ planOver: { exam_date: null } })).toBeNull();
    expect(outlook({ planOver: { exam_date: '2026-11-01' } })!.status).toBe('RETA_FINAL');
    expect(outlook({ planOver: { exam_date: '2026-10-01' } })!.status).toBe('PROVA_PASSOU');
  });
});
