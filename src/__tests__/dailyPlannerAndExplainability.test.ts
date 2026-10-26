import { describe, expect, it } from 'vitest';
import { SEED_STUDY_PLANS, SEED_SUBJECTS, SEED_TOPIC_LINKS, SEED_TOPICS } from '../data/initialSeed';
import {
  calculateDynamicStudyCycle,
  composeSubjectScore,
  composeTopicHeat,
  startOfWeek,
  STRATEGY_FACTORS,
} from '../lib/cycleEngine';
import { MAX_BLOCK_MINUTES, MAX_BLOCKS_LONG_DAY, planDailyBlocks } from '../lib/dailyPlanner';
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
    // 04:30 por dia é dia longo (spec 13): blocos de até 02:00
    expect(plan.blocks.length).toBeGreaterThanOrEqual(2);
    for (const b of plan.blocks) expect(b.durationMinutes).toBeLessThanOrEqual(MAX_BLOCK_MINUTES);
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

describe('Roteiro pelas horas do dia (spec 13 §4.2)', () => {
  const total = (blocks: { durationMinutes: number }[]) => blocks.reduce((acc, b) => acc + b.durationMinutes, 0);

  it('dia de até 03:00 continua como hoje', () => {
    const cycleData = cycleFor(cguPlan);
    const byDay = planDailyBlocks({ cycleData, topicsBySubject, weeklyHoursTarget: cguPlan.weekly_hours_target, dayMinutesBudget: 150 });
    const byWeek = planDailyBlocks({ cycleData, topicsBySubject, weeklyHoursTarget: (150 * 7) / 60 });
    expect(byDay.dailyMinutesBudget).toBe(150);
    expect(byDay.blocks.map((b) => [b.subject.id, b.topic?.id, b.durationMinutes])).toEqual(
      byWeek.blocks.map((b) => [b.subject.id, b.topic?.id, b.durationMinutes])
    );
    expect(byDay.blocks.length).toBeLessThanOrEqual(2);
  });

  it('dia longo: bloco de no máximo 02:00 e sem repetir matéria enquanto houver outra', () => {
    const plan = planDailyBlocks({ cycleData: cycleFor(cguPlan), topicsBySubject, weeklyHoursTarget: 31.5, dayMinutesBudget: 360 });
    expect(plan.blocks.length).toBeGreaterThanOrEqual(3);
    expect(plan.blocks.length).toBeLessThanOrEqual(MAX_BLOCKS_LONG_DAY);
    for (const b of plan.blocks) expect(b.durationMinutes).toBeLessThanOrEqual(MAX_BLOCK_MINUTES);
    expect(new Set(plan.blocks.map((b) => b.subject.id)).size).toBe(plan.blocks.length);
    expect(total(plan.blocks)).toBeLessThanOrEqual(360);
  });

  it('dia longo com só 2 matérias pendentes: a matéria repete com outro tópico', () => {
    const base = cycleFor(cguPlan);
    const monday = startOfWeek(NOW);
    const [a, b, ...done] = [...base.allocations].sort((x, y) => y.currentWeeklyMinutes - x.currentWeeklyMinutes);
    const sessions = done.map((d, i) => sessionOf(d.subject.id, d.currentWeeklyMinutes, new Date(monday.getTime() + (i + 1) * 3600_000)));
    expect(a.currentWeeklyMinutes).toBeGreaterThanOrEqual(200);
    expect(b.currentWeeklyMinutes).toBeGreaterThanOrEqual(200);
    const plan = planDailyBlocks({ cycleData: cycleFor(cguPlan, sessions), topicsBySubject, weeklyHoursTarget: 31.5, dayMinutesBudget: 360 });
    for (const blk of plan.blocks) {
      expect(blk.durationMinutes).toBeLessThanOrEqual(MAX_BLOCK_MINUTES);
      expect([a.subject.id, b.subject.id]).toContain(blk.subject.id);
    }
    expect(plan.blocks.length).toBeGreaterThan(2);
    const topicIds = plan.blocks.map((blk) => blk.topic?.id);
    expect(new Set(topicIds).size).toBe(topicIds.length);
  });

  it('dia de folga (orçamento 0): nenhum bloco', () => {
    const plan = planDailyBlocks({ cycleData: cycleFor(cguPlan), topicsBySubject, weeklyHoursTarget: 31.5, dayMinutesBudget: 0 });
    expect(plan.blocks).toEqual([]);
  });

  it('Revisão da semana: um bloco no tópico estudado que mais esfriou, dentro do tempo do dia', () => {
    const contabTopics = topicsBySubject['subj-cgu-contabilidade'];
    const [recent, old] = contabTopics;
    const day = 86_400_000;
    const studied: Record<string, Topic[]> = {
      ...topicsBySubject,
      'subj-cgu-contabilidade': contabTopics.map((t) => {
        if (t.id === recent.id) return { ...t, last_studied_at: new Date(NOW.getTime() - 1 * day).toISOString() };
        if (t.id === old.id) return { ...t, last_studied_at: new Date(NOW.getTime() - 9 * day).toISOString() };
        return t;
      }),
    };
    const cycleData = calculateDynamicStudyCycle({
      plan: cguPlan, subjects: cguSubjects, topicsBySubject: studied, attempts: [], sessions: [], topicLinks: SEED_TOPIC_LINKS, now: NOW,
    });
    const plan = planDailyBlocks({ cycleData, topicsBySubject: studied, weeklyHoursTarget: 31.5, dayMinutesBudget: 300, weekReviewMinutes: 60 });
    const review = plan.blocks.filter((b) => b.kind === 'WEEK_REVIEW');
    expect(review).toHaveLength(1);
    expect(review[0].durationMinutes).toBe(60);
    expect(review[0].reasonText).toMatch(/Revisão da semana: .+ foi estudado há \d+ dias?\./);
    expect(total(plan.blocks)).toBeLessThanOrEqual(300);
    // O tópico da revisão não repete um bloco de estudo do mesmo dia; entre os que sobram, é o mais frio
    const studyTopics = new Set(plan.blocks.filter((b) => b.kind === 'STUDY').map((b) => b.topic?.id));
    expect(studyTopics.has(review[0].topic?.id)).toBe(false);
    const recall = (h: (typeof cycleData.topicHeatmapRanking)[number]) => Math.pow(2, -(h.daysSinceLastStudy ?? 0) / Math.max(1, h.memoryHalfLifeDays));
    const coldestFree = cycleData.topicHeatmapRanking
      .filter((h) => h.daysSinceLastStudy !== null && !studyTopics.has(h.topic.id))
      .sort((a, b) => recall(a) - recall(b))[0];
    expect(review[0].topic?.id).toBe(coldestFree.topic.id);
    if (!studyTopics.has(old.id)) expect(review[0].topic?.id).toBe(old.id);

    // Sem nenhum tópico estudado não há revisão: o tempo vai para estudo
    const unseen: Record<string, Topic[]> = Object.fromEntries(
      Object.entries(topicsBySubject).map(([id, list]) => [id, list.map((t) => ({ ...t, last_studied_at: null }))])
    );
    const unseenCycle = calculateDynamicStudyCycle({
      plan: cguPlan, subjects: cguSubjects, topicsBySubject: unseen, attempts: [], sessions: [], topicLinks: SEED_TOPIC_LINKS, now: NOW,
    });
    const fresh = planDailyBlocks({ cycleData: unseenCycle, topicsBySubject: unseen, weeklyHoursTarget: 31.5, dayMinutesBudget: 300, weekReviewMinutes: 60 });
    expect(fresh.blocks.some((b) => b.kind === 'WEEK_REVIEW')).toBe(false);
    expect(fresh.blocks.length).toBeGreaterThan(0);
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

describe('Revisão da semana não repete tópico do dia (spec 13 §4.2)', () => {
  it('matéria com um tópico só, que é o mais frio: o estudo fica com ele e a revisão vai para outro', () => {
    const day = 86_400_000;
    const [contab, ...others] = cguSubjects;
    const single: Record<string, Topic[]> = { ...topicsBySubject };
    const only = { ...topicsBySubject[contab.id][0], last_studied_at: new Date(NOW.getTime() - 20 * day).toISOString() };
    single[contab.id] = [only];
    const warm = { ...topicsBySubject[others[0].id][0], last_studied_at: new Date(NOW.getTime() - 3 * day).toISOString() };
    single[others[0].id] = [warm, ...topicsBySubject[others[0].id].slice(1)];
    const cycleData = calculateDynamicStudyCycle({
      plan: cguPlan, subjects: cguSubjects, topicsBySubject: single, attempts: [], sessions: [], topicLinks: SEED_TOPIC_LINKS, now: NOW,
    });
    const plan = planDailyBlocks({ cycleData, topicsBySubject: single, weeklyHoursTarget: 31.5, dayMinutesBudget: 300, weekReviewMinutes: 60 });
    const topics = plan.blocks.map((b) => b.topic?.id);
    expect(new Set(topics).size).toBe(topics.length);
  });
});

describe('Revisão da semana sem tópico livre (revisão independente, 25/10)', () => {
  it('o único tópico estudado vai para um bloco de estudo: o tempo da revisão volta para estudo, não some', () => {
    const day = 86_400_000;
    const onlyOne: Record<string, Topic[]> = Object.fromEntries(
      Object.entries(topicsBySubject).map(([id, list]) => [
        id,
        list.map((t) => ({ ...t, last_studied_at: t.id === 't-cgu-3-1' ? new Date(NOW.getTime() - 5 * day).toISOString() : null })),
      ])
    );
    const cycleData = calculateDynamicStudyCycle({
      plan: cguPlan, subjects: cguSubjects, topicsBySubject: onlyOne, attempts: [], sessions: [], topicLinks: SEED_TOPIC_LINKS, now: NOW,
    });
    const plan = planDailyBlocks({ cycleData, topicsBySubject: onlyOne, weeklyHoursTarget: 31.5, dayMinutesBudget: 300, weekReviewMinutes: 90 });
    const total = plan.blocks.reduce((acc, b) => acc + b.durationMinutes, 0);
    if (!plan.blocks.some((b) => b.kind === 'WEEK_REVIEW')) expect(total).toBeGreaterThanOrEqual(280);
    const topics = plan.blocks.map((b) => b.topic?.id);
    expect(new Set(topics).size).toBe(topics.length);
  });
});

describe('Dia de até 03:00 usa o dia inteiro (sábado da tela do dono, 26/10)', () => {
  it('as duas matérias que mais faltam têm pouco tempo sobrando: entram outras até encher o dia', () => {
    const base = cycleFor(cguPlan);
    const monday = startOfWeek(NOW);
    // Fim de semana: todas as matérias com pouco tempo sobrando (00:50, 00:45, 00:45, 00:45)
    const left = [50, 45, 45, 45];
    const sessions = base.allocations.map((al, i) =>
      sessionOf(al.subject.id, al.currentWeeklyMinutes - left[i % left.length], new Date(monday.getTime() + (i + 1) * 3600_000))
    );
    const plan = planDailyBlocks({ cycleData: cycleFor(cguPlan, sessions), topicsBySubject, weeklyHoursTarget: 31.5, dayMinutesBudget: 180 });
    const total = plan.blocks.reduce((acc, blk) => acc + blk.durationMinutes, 0);
    expect(total).toBeGreaterThanOrEqual(170);
    expect(plan.blocks.length).toBeLessThanOrEqual(MAX_BLOCKS_LONG_DAY);
    expect(new Set(plan.blocks.map((blk) => blk.subject.id)).size).toBe(plan.blocks.length);
  });
});

describe('Reta final no roteiro do dia (spec 13 §4.3)', () => {
  const recall = (h: { daysSinceLastStudy: number | null; memoryHalfLifeDays: number }) =>
    Math.pow(2, -(h.daysSinceLastStudy ?? 0) / Math.max(1, h.memoryHalfLifeDays));

  it('só tópicos já estudados, o mais frio da matéria primeiro, nada novo', () => {
    const cycleData = cycleFor(cguPlan);
    const plan = planDailyBlocks({ cycleData, topicsBySubject, weeklyHoursTarget: 31.5, dayMinutesBudget: 180, finalStretch: true });
    expect(plan.blocks.length).toBeGreaterThan(0);
    for (const b of plan.blocks) {
      const heat = cycleData.topicHeatmapRanking.find((h) => h.topic.id === b.topic?.id)!;
      expect(heat.daysSinceLastStudy).not.toBeNull();
      const studiedOfSubject = cycleData.topicHeatmapRanking.filter((h) => h.topic.subject_id === b.subject.id && h.daysSinceLastStudy !== null);
      if (b === plan.blocks.find((x) => x.subject.id === b.subject.id)) {
        expect(recall(heat)).toBe(Math.min(...studiedOfSubject.map(recall)));
      }
      if (b.kind === 'STUDY') expect(b.reasonText).toMatch(/^Reta final: revisar /);
    }
  });

  it('sem nenhum tópico estudado no plano, a reta final segue o roteiro normal', () => {
    const unseen: Record<string, Topic[]> = Object.fromEntries(
      Object.entries(topicsBySubject).map(([id, list]) => [id, list.map((t) => ({ ...t, last_studied_at: null }))])
    );
    const cycleData = calculateDynamicStudyCycle({
      plan: cguPlan, subjects: cguSubjects, topicsBySubject: unseen, attempts: [], sessions: [], topicLinks: SEED_TOPIC_LINKS, now: NOW,
    });
    const plan = planDailyBlocks({ cycleData, topicsBySubject: unseen, weeklyHoursTarget: 31.5, dayMinutesBudget: 180, finalStretch: true });
    expect(plan.blocks.length).toBeGreaterThan(0);
    expect(plan.blocks.every((b) => !b.reasonText.startsWith('Reta final'))).toBe(true);
  });
});
