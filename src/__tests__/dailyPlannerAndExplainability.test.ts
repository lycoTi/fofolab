import { describe, expect, it } from 'vitest';
import { SEED_STUDY_PLANS, SEED_SUBJECTS, SEED_TOPIC_LINKS, SEED_TOPICS } from '../data/initialSeed';
import {
  calculateDynamicStudyCycle,
  composeSubjectScore,
  composeTopicHeat,
  startOfWeek,
  STRATEGY_FACTORS,
} from '../lib/cycleEngine';
import { planDailyBlocks } from '../lib/dailyPlanner';
import { explainSubjectAllocation, explainTopicHeat, formatDecimal } from '../lib/explainabilityEngine';
import type { StudyPlan, StudySession, Topic } from '../types/database';

const NOW = new Date('2026-10-21T15:00:00'); // quarta-feira
const cguPlan = SEED_STUDY_PLANS[0];
const cguSubjects = SEED_SUBJECTS.filter((s) => s.plan_id === cguPlan.id);
const topicsBySubject: Record<string, Topic[]> = {};
for (const s of cguSubjects) topicsBySubject[s.id] = SEED_TOPICS.filter((t) => t.subject_id === s.id);

function cycleFor(plan: StudyPlan, sessions: StudySession[] = [], subjects = cguSubjects) {
  return calculateDynamicStudyCycle({
    plan,
    subjects,
    topicsBySubject,
    attempts: [],
    sessions,
    topicLinks: SEED_TOPIC_LINKS,
    now: NOW,
  });
}

function sessionOf(subjectId: string, minutes: number, startedAt: Date): StudySession {
  return {
    id: `s-${subjectId}-${startedAt.getTime()}`,
    subject_id: subjectId,
    topic_id: null,
    duration_minutes: minutes,
    session_type: 'POMODORO',
    pauses_count: 0,
    was_skipped: 0,
    started_at: startedAt.toISOString(),
  };
}

describe('Meu Dia de Hoje: roteiro pelo que falta na semana (não por ordem alfabética)', () => {
  it('começa pela matéria com mais minutos pendentes do ciclo, não pela primeira da lista', () => {
    const plan = planDailyBlocks({
      cycleData: cycleFor(cguPlan),
      topicsBySubject,
      weeklyHoursTarget: cguPlan.weekly_hours_target,
    });

    // Na lista, Auditoria vem antes (ordem alfabética), mas Contabilidade tem mais minutos no ciclo aplicado
    expect(cguSubjects.map((s) => s.name)[0]).toBe('Auditoria Governamental');
    expect(plan.blocks[0].subject.id).toBe('subj-cgu-contabilidade');
    expect(plan.blocks).toHaveLength(2);
    expect(plan.blocks.reduce((acc, b) => acc + b.durationMinutes, 0)).toBeLessThanOrEqual(plan.dailyMinutesBudget);
  });

  it('uma matéria cuja meta da semana já foi cumprida sai do roteiro de hoje', () => {
    const before = cycleFor(cguPlan);
    const contab = before.allocations.find((a) => a.subject.id === 'subj-cgu-contabilidade')!;
    const monday = startOfWeek(NOW);
    const sessions = [sessionOf('subj-cgu-contabilidade', contab.currentWeeklyMinutes, new Date(monday.getTime() + 3600_000))];

    const plan = planDailyBlocks({
      cycleData: cycleFor(cguPlan, sessions),
      topicsBySubject,
      weeklyHoursTarget: cguPlan.weekly_hours_target,
    });

    expect(plan.blocks.map((b) => b.subject.id)).not.toContain('subj-cgu-contabilidade');
    expect(plan.studiedThisWeekMinutes).toBe(contab.currentWeeklyMinutes);
  });

  it('sessões da semana passada não contam para a semana atual', () => {
    const lastWeek = new Date(startOfWeek(NOW).getTime() - 2 * 86_400_000);
    const cycle = cycleFor(cguPlan, [sessionOf('subj-cgu-contabilidade', 500, lastWeek)]);
    expect(cycle.allocations.find((a) => a.subject.id === 'subj-cgu-contabilidade')!.studiedThisWeekMinutes).toBe(0);
  });

  it('com 1h/dia ou menos monta um único bloco', () => {
    const plan = planDailyBlocks({
      cycleData: cycleFor({ ...cguPlan, weekly_hours_target: 7 }),
      topicsBySubject,
      weeklyHoursTarget: 7,
    });
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0].durationMinutes).toBe(60);
  });

  it('com a semana inteira cumprida, oferece revisão extra pela maior prioridade', () => {
    const base = cycleFor(cguPlan);
    const monday = startOfWeek(NOW);
    const sessions = base.allocations.map((a, i) =>
      sessionOf(a.subject.id, a.currentWeeklyMinutes, new Date(monday.getTime() + (i + 1) * 3600_000))
    );
    const plan = planDailyBlocks({ cycleData: cycleFor(cguPlan, sessions), topicsBySubject, weeklyHoursTarget: 31.5 });

    const topPriority = [...base.allocations].sort((a, b) => b.elasticScore - a.elasticScore)[0];
    expect(plan.weekCompleted).toBe(true);
    expect(plan.blocks[0].subject.id).toBe(topPriority.subject.id);
  });
});

describe('Estratégia do Wizard aplicada no ciclo', () => {
  it('sem estratégia o multiplicador é neutro; "Base Comum" puxa as matérias básicas', () => {
    const neutral = cycleFor(cguPlan);
    expect(neutral.allocations.every((a) => a.scoreBreakdown.strategyMultiplier === 1)).toBe(true);

    const baseComum = cycleFor({ ...cguPlan, strategy_mode: 'BASE_COMUM' });
    const dirAdmNeutral = neutral.allocations.find((a) => a.subject.category === 'BASICO')!;
    const dirAdm = baseComum.allocations.find((a) => a.subject.category === 'BASICO')!;
    expect(dirAdm.scoreBreakdown.strategyMultiplier).toBe(STRATEGY_FACTORS.BASE_COMUM.BASICO);
    expect(dirAdm.sharePercent).toBeGreaterThan(dirAdmNeutral.sharePercent);
  });

  it('"Alta rentabilidade" concentra nas matérias de maior peso', () => {
    const neutral = cycleFor(cguPlan);
    const highWeight = cycleFor({ ...cguPlan, strategy_mode: 'ALTO_PESO_CURTO' });
    const ti = (c: typeof neutral) => c.allocations.find((a) => a.subject.id === 'subj-cgu-ti-dev')!; // peso 2.5
    expect(ti(highWeight).sharePercent).toBeGreaterThan(ti(neutral).sharePercent);
  });
});

describe('Explicabilidade: a conta exibida é a conta que o motor faz', () => {
  it('a prioridade de cada disciplina é exatamente a soma dos termos detalhados', () => {
    const cycle = cycleFor({ ...cguPlan, strategy_mode: 'MAIS_COBRADOS' });
    for (const alloc of cycle.allocations) {
      expect(composeSubjectScore(alloc.scoreBreakdown)).toBeCloseTo(alloc.elasticScore, 1);
      const explanation = explainSubjectAllocation(alloc, 31.5, 90, cycle.strategy);
      const finalRow = explanation.formulaDetails!.variables.find((v) => v.label === 'Prioridade final')!;
      expect(finalRow.value).toBe(formatDecimal(alloc.elasticScore));
    }
  });

  it('a urgência de cada tópico é exatamente a composição dos termos detalhados', () => {
    const cycle = cycleFor(cguPlan);
    for (const item of cycle.topicHeatmapRanking) {
      expect(composeTopicHeat(item.heatBreakdown)).toBeCloseTo(item.heatScore, 1);
      const explanation = explainTopicHeat(item);
      expect(explanation.formulaDetails!.formulaLabel).toContain('Peso da matéria');
      expect(explanation.bulletPoints.join(' ')).not.toContain('estimativa científica');
    }
  });

  it('tópicos "pai" (com subtópicos) não entram no calor nem na cobertura', () => {
    const parent: Topic = { ...SEED_TOPICS[0], id: 't-pai', code: '9', title: 'Agrupador', mastery_score: 0 };
    const child: Topic = { ...SEED_TOPICS[0], id: 't-filho', code: '9.1', title: 'Subtópico', parent_id: 't-pai' };
    const withHierarchy = {
      ...topicsBySubject,
      'subj-cgu-auditoria': [...topicsBySubject['subj-cgu-auditoria'], parent, child],
    };
    const cycle = calculateDynamicStudyCycle({
      plan: cguPlan,
      subjects: cguSubjects,
      topicsBySubject: withHierarchy,
      attempts: [],
      sessions: [],
      topicLinks: [],
      now: NOW,
    });
    const ids = cycle.topicHeatmapRanking.map((h) => h.topic.id);
    expect(ids).toContain('t-filho');
    expect(ids).not.toContain('t-pai');
  });
});
