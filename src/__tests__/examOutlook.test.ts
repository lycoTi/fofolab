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
const session = (minutes: number, daysAgo: number, subjectId = 'A'): StudySession => ({
  id: `s${subjectId}${daysAgo}-${minutes}`, subject_id: subjectId, topic_id: null, duration_minutes: minutes, session_type: 'POMODORO',
  pauses_count: 0, was_skipped: 0, started_at: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
});
/** Uma sessão por dia nos últimos N dias (ontem para trás). */
const daily = (minutes: number, days: number, subjectId = 'A') => Array.from({ length: days }, (_, i) => session(minutes, i + 1, subjectId));

function outlook(over: {
  pattern?: WeekdayMinutes; sessions?: StudySession[]; firstStudyDates?: Record<string, string>; planOver?: Partial<StudyPlan>;
  overrides?: Record<string, number>; topics?: Record<string, Topic[]>; cycle?: CycleCalculationResult;
} = {}) {
  return examOutlook({
    plan: { ...plan, ...over.planOver } as StudyPlan,
    now: NOW,
    pattern: over.pattern ?? [180, 180, 180, 180, 180, 180, 180],
    overrides: over.overrides ?? {},
    subjects: [subjectA, subjectB],
    topicsBySubject: over.topics ?? topicsBySubject,
    cycleData: over.cycle ?? cycleData,
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
    // 02:10 por dia (15:10 por semana) nas últimas 2 semanas, com o plano em 03:00 por dia
    const slow = outlook({ sessions: daily(130, 14) })!;
    expect(slow.real?.weeklyMinutes).toBe(910);
    expect(slow.real!.coverageAtStretch).toBeLessThanOrEqual(slow.coverageAtStretch);
    // 02:50 por dia: menos de 10% abaixo do plano
    expect(outlook({ sessions: daily(170, 14) })!.real).toBeNull();
    // Só 5 dias de uso (pela primeira sessão, não pela primeira questão)
    expect(outlook({ sessions: daily(30, 5), firstStudyDates: { A1: new Date(NOW.getTime() - 40 * DAY).toISOString() } })!.real).toBeNull();
  });

  it('ritmo real: só as sessões deste plano contam', () => {
    // 01:40 por dia aqui e 03:20 por dia noutro plano: o ritmo deste plano é 01:40
    const o = outlook({ sessions: [...daily(100, 14), ...daily(200, 14, 'OUTRO')] })!;
    expect(o.real?.weeklyMinutes).toBe(700);
  });

  it('ritmo real compara com o que estava planejado nos dias (folga planejada não é atraso)', () => {
    // Semana passada de folga (exceções 0) e esta cumprida: o ritmo bate com o planejado
    const lastWeek = Object.fromEntries(Array.from({ length: 7 }, (_, i) => {
      const d = new Date(NOW.getTime() - (i + 8) * DAY);
      return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, 0];
    }));
    expect(outlook({ sessions: daily(180, 7), overrides: lastWeek })!.real).toBeNull();
  });

  it('"+HH:mm por semana" leva mesmo a 100%; quando passa do dobro do plano, não cabe', () => {
    const tight = outlook({ pattern: [60, 60, 60, 60, 60, 0, 0] })!;
    expect(tight.coverageAtStretch).toBeLessThan(100);
    expect(tight.extraWeeklyMinutes % 30).toBe(0);
    const perDay = tight.extraWeeklyMinutes / 7;
    const withExtra = outlook({ pattern: [60 + perDay, 60 + perDay, 60 + perDay, 60 + perDay, 60 + perDay, perDay, perDay] })!;
    expect(withExtra.coverageAtStretch).toBe(100);
    expect(tight.fits).toBe(true);
    expect(outlook({ pattern: [60, 0, 0, 0, 0, 0, 0] })!.fits).toBe(false);
  });

  it('o que fica para depois começa pelo de menor prioridade (de todas as matérias)', () => {
    const ranked = { ...cycleData, topicHeatmapRanking: [...topicsOf('A'), ...topicsOf('B')].map((topic) => ({ topic })) } as unknown as CycleCalculationResult;
    const o = outlook({ pattern: [120, 0, 0, 0, 0, 0, 0], cycle: ranked })!;
    expect(o.leftForLater[0].id).toBe('B10');
  });

  it('sem nível próprio, o tópico usa a autoavaliação do grupo dele', () => {
    const group = { id: 'GA', subject_id: 'A', code: '1', title: 'Grupo A', parent_id: null, initial_knowledge_level: 4, last_studied_at: null } as unknown as Topic;
    const children = topicsOf('A').map((t) => ({ ...t, parent_id: 'GA' }));
    const o = outlook({ topics: { A: [group, ...children], B: topicsOf('B') }, pattern: [120, 0, 0, 0, 0, 0, 0] })!;
    // Filhos de A em "Domino" (00:30) e B em "Nunca vi" (02:00): média de 01:15
    expect(o.topicMinutes.estimate).toBe(75);
  });

  it('plano sem tópicos: sem projeção de cobertura', () => {
    expect(outlook({ topics: { A: [], B: [] } })!.totalTopics).toBe(0);
  });

  it('P1/P2 com o % projetado e o aviso da prova com nota mínima ficando para trás', () => {
    const o = outlook({ pattern: [120, 0, 0, 0, 0, 0, 0] })!;
    expect(o.parts.map((p) => p.code)).toEqual(['P1', 'P2']);
    expect(o.parts[0].coverageAtStretch).toBeGreaterThan(o.parts[1].coverageAtStretch);
    expect(o.partWarning).toMatch(/^P2 deve chegar a \d+% até a reta final \(as outras: \d+%\)\. Ela tem nota mínima\.$/);
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
