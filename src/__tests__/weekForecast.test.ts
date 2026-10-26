import { describe, expect, it } from 'vitest';
import { SEED_STUDY_PLANS, SEED_SUBJECTS, SEED_TOPIC_LINKS, SEED_TOPICS } from '../data/initialSeed';
import { weekBudgetMinutes, type WeekdayMinutes } from '../lib/availability';
import { calculateDynamicStudyCycle, startOfWeek } from '../lib/cycleEngine';
import { planDailyBlocks } from '../lib/dailyPlanner';
import { freezeDailyPlan } from '../lib/dailyRoutine';
import { forecastWeek } from '../lib/weekForecast';
import type { StudySession, Topic } from '../types/database';

const NOW = new Date(2026, 9, 27, 10, 0); // terça 27/10/2026, 10:00
const MONDAY = startOfWeek(NOW);
const PATTERN: WeekdayMinutes = [150, 150, 150, 150, 150, 300, 0];
const plan = SEED_STUDY_PLANS[0];
const subjects = SEED_SUBJECTS.filter((s) => s.plan_id === plan.id);
const topicsBySubject: Record<string, Topic[]> = {};
for (const s of subjects) topicsBySubject[s.id] = SEED_TOPICS.filter((t) => t.subject_id === s.id);

const session = (subjectId: string, topicId: string | null, minutes: number, at: Date): StudySession => ({
  id: `s-${subjectId}-${at.getTime()}`, subject_id: subjectId, topic_id: topicId, duration_minutes: minutes,
  session_type: 'POMODORO', pauses_count: 0, was_skipped: 0, started_at: at.toISOString(),
});

function setup(opts: { pattern?: WeekdayMinutes; sessions?: StudySession[]; reviewEnabled?: boolean } = {}) {
  const pattern = opts.pattern ?? PATTERN;
  const sessions = opts.sessions ?? [];
  const budget = weekBudgetMinutes(MONDAY, pattern, {});
  const cycleData = calculateDynamicStudyCycle({
    plan, subjects, topicsBySubject, attempts: [], sessions, topicLinks: SEED_TOPIC_LINKS, now: NOW, weeklyMinutesBudget: budget,
  });
  const todayBlocks = freezeDailyPlan(planDailyBlocks({ cycleData, topicsBySubject, weeklyHoursTarget: budget / 60, dayMinutesBudget: pattern[1] }));
  const days = forecastWeek({
    weekStart: MONDAY, now: NOW, pattern, overrides: {}, cycleData, topicsBySubject, weekSessions: sessions, todayBlocks,
    reviewEnabled: opts.reviewEnabled ?? true,
  });
  return { days, budget, todayBlocks };
}

const sum = (blocks: { minutes: number }[]) => blocks.reduce((acc, b) => acc + b.minutes, 0);

describe('Previsão da semana dia a dia (spec 13 §4.2)', () => {
  it('passado com o que foi feito, hoje com o roteiro gravado, o resto como previsão', () => {
    const monday = new Date(2026, 9, 26, 19, 0);
    const contab = subjects.find((s) => s.id === 'subj-cgu-contabilidade')!;
    const { days, todayBlocks } = setup({ sessions: [session(contab.id, null, 50, monday), session(contab.id, null, 40, monday)] });
    expect(days.map((d) => d.label)).toEqual(['Seg 26', 'Ter 27', 'Qua 28', 'Qui 29', 'Sex 30', 'Sáb 31', 'Dom 1']);
    expect(days.map((d) => d.when)).toEqual(['past', 'today', 'future', 'future', 'future', 'future', 'future']);
    expect(days[0].studiedMinutes).toBe(90);
    expect(days[0].blocks).toEqual([{ subjectId: contab.id, topicId: null, minutes: 90, kind: 'STUDY' }]);
    expect(days[1].blocks.map((b) => b.subjectId)).toEqual(todayBlocks.map((b) => b.subjectId));
    expect(days[2].blocks.length).toBeGreaterThan(0);
  });

  it('folga fixa: o dia desligado aparece como folga, sem blocos', () => {
    const { days } = setup();
    expect(days[6].rest).toBe(true);
    expect(days[6].blocks).toEqual([]);
    expect(days[5].rest).toBe(false);
  });

  it('previsão respeita as horas de cada dia e o total da semana', () => {
    const { days, budget } = setup();
    for (const d of days.filter((x) => x.when === 'future')) expect(sum(d.blocks)).toBeLessThanOrEqual(d.plannedMinutes);
    const total = days.reduce((acc, d) => acc + (d.when === 'past' ? d.studiedMinutes : sum(d.blocks)), 0);
    expect(total).toBeLessThanOrEqual(budget);
  });

  it('o que não foi feito não vira dívida: segunda sem estudo não aumenta os outros dias', () => {
    const { days } = setup();
    expect(days[0].studiedMinutes).toBe(0);
    for (const d of days.filter((x) => x.when === 'future')) expect(sum(d.blocks)).toBeLessThanOrEqual(PATTERN[days.indexOf(d)]);
  });

  it('tópico não repete na semana enquanto a matéria tiver outro', () => {
    const { days } = setup();
    const studyTopics = days.flatMap((d) => d.blocks.filter((b) => b.kind === 'STUDY').map((b) => `${b.subjectId}:${b.topicId}`));
    const bySubject = new Map<string, string[]>();
    for (const key of studyTopics) {
      const [subjectId, topicId] = key.split(':');
      bySubject.set(subjectId, [...(bySubject.get(subjectId) ?? []), topicId]);
    }
    for (const [subjectId, list] of bySubject) {
      const available = (topicsBySubject[subjectId] ?? []).length;
      if (list.length <= available) expect(new Set(list).size).toBe(list.length);
    }
  });

  it('revisão da semana só no dia mais longo e só com a Revisão do dia ligada', () => {
    const on = setup().days;
    const reviewDays = on.filter((d) => d.blocks.some((b) => b.kind === 'WEEK_REVIEW')).map((d) => d.label);
    expect(reviewDays).toEqual(['Sáb 31']);
    const off = setup({ reviewEnabled: false }).days;
    expect(off.some((d) => d.blocks.some((b) => b.kind === 'WEEK_REVIEW'))).toBe(false);
  });

  it('semana inteira de folga: os 7 dias de folga, nenhum bloco, nenhum número quebrado', () => {
    const { days } = setup({ pattern: [0, 0, 0, 0, 0, 0, 0] });
    expect(days.every((d) => d.rest && d.blocks.length === 0)).toBe(true);
    expect(days.every((d) => Number.isFinite(d.plannedMinutes) && Number.isFinite(d.studiedMinutes))).toBe(true);
  });
});
