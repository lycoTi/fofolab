import { describe, expect, it } from 'vitest';
import {
  calculateDynamicStudyCycle,
  calculateMemoryDecayBoost,
  calculateSampleConfidencePercent,
  recommendedForStandardWeek,
  getSampleSubtopicsForCalibration,
  RECALL_CHECK_WEIGHT,
} from '../lib/cycleEngine';
import {
  SEED_STUDY_PLANS,
  SEED_SUBJECTS,
  SEED_TOPIC_LINKS,
  SEED_TOPICS,
} from '../data/initialSeed';
import type { QuestionAttempt, QuestionLog, RecallCheck, Topic } from '../types/database';

describe('Motor Matemático do Ciclo de Estudos & Mapa de Calor (cycleEngine)', () => {
  const cguPlan = SEED_STUDY_PLANS[0]; // 31.5h/sem = 1890 min
  const cguSubjects = SEED_SUBJECTS.filter((s) => s.plan_id === cguPlan.id);
  const topicsBySubject: Record<string, Topic[]> = {};
  for (const s of cguSubjects) {
    topicsBySubject[s.id] = SEED_TOPICS.filter((t) => t.subject_id === s.id);
  }

  it('mantém o orçamento semanal fixo (Soma Zero) mesmo após errar 15 questões seguidas no Estudo Reverso', () => {
    const simulatedErrors: QuestionAttempt[] = Array.from({ length: 15 }).map((_, idx) => ({
      id: `att-${idx}`,
      question_id: 'q-fgv-cgu-pcasp-1',
      topic_id: 't-cgu-3-1',
      selected_option: 'A',
      is_correct: 0,
      used_ai_review: 1,
      self_diagnosis: 'BASE_GAP',
      time_spent_seconds: 50,
      attempted_at: new Date().toISOString(),
    }));

    const result = calculateDynamicStudyCycle({
      plan: cguPlan,
      subjects: cguSubjects,
      topicsBySubject,
      attempts: simulatedErrors,
      sessions: [],
      topicLinks: SEED_TOPIC_LINKS,
    });

    // O orçamento total semanal jamais pode inflar com erros
    expect(result.totalWeeklyMinutesBudget).toBe(Math.round(cguPlan.weekly_hours_target * 60));

    // A soma dos percentuais da pizza deve ficar em torno de 100%
    const sumPercent = result.allocations.reduce((acc, a) => acc + a.sharePercent, 0);
    expect(sumPercent).toBeGreaterThanOrEqual(98);
    expect(sumPercent).toBeLessThanOrEqual(102);

    // Contabilidade Pública (onde ocorreram os 15 BASE_GAP) deve subir para o topo do Mapa de Calor
    expect(result.topicHeatmapRanking[0].topic.id).toBe('t-cgu-3-1');
  });

  it('orçamento da semana vindo dos dias (spec 13): soma zero com o valor recebido', () => {
    const result = calculateDynamicStudyCycle({
      plan: cguPlan, subjects: cguSubjects, topicsBySubject, attempts: [], sessions: [], topicLinks: SEED_TOPIC_LINKS,
      weeklyMinutesBudget: 900,
    });
    expect(result.totalWeeklyMinutesBudget).toBe(900);
    const recommended = result.allocations.reduce((acc, a) => acc + a.recommendedWeeklyMinutes, 0);
    expect(recommended).toBeLessThanOrEqual(900 + result.allocations.length);
    expect(recommended).toBeGreaterThanOrEqual(900 - result.allocations.length);
  });

  it('semana inteira de folga: orçamento 0 sem inventar minutos nem gerar NaN', () => {
    const result = calculateDynamicStudyCycle({
      plan: cguPlan, subjects: cguSubjects, topicsBySubject, attempts: [], sessions: [], topicLinks: SEED_TOPIC_LINKS,
      weeklyMinutesBudget: 0,
    });
    expect(result.totalWeeklyMinutesBudget).toBe(0);
    // Folga não é "pouco tempo para muitas matérias": nada de aviso de sobrecarga, nem com 5 matérias
    const five = Array.from({ length: 5 }, (_, i) => ({ ...cguSubjects[0], id: `s-folga-${i}` }));
    const many = calculateDynamicStudyCycle({
      plan: cguPlan, subjects: five, topicsBySubject: {}, attempts: [], sessions: [], topicLinks: [], weeklyMinutesBudget: 0,
    });
    expect(many.isOverloaded).toBe(false);
    for (const a of result.allocations) {
      expect(a.recommendedWeeklyMinutes).toBe(0);
      expect(a.currentWeeklyMinutes).toBe(0);
      expect(a.remainingThisWeekMinutes).toBe(0);
      for (const value of [a.sharePercent, a.elasticScore, a.deltaMinutes, a.blocksPerWeek, a.floorMinutes]) {
        expect(Number.isNaN(value)).toBe(false);
      }
    }
  });

  it('plano antigo sem padrão de dias: o ciclo quase não muda (só o arredondamento por dia)', () => {
    const base = { plan: cguPlan, subjects: cguSubjects, topicsBySubject, attempts: [], sessions: [], topicLinks: SEED_TOPIC_LINKS };
    const before = calculateDynamicStudyCycle(base);
    const after = calculateDynamicStudyCycle({ ...base, weeklyMinutesBudget: 7 * Math.round((cguPlan.weekly_hours_target * 60) / 7) });
    const diff = before.allocations.reduce((acc, a, i) => acc + Math.abs(a.recommendedWeeklyMinutes - after.allocations[i].recommendedWeeklyMinutes), 0);
    expect(diff).toBeLessThanOrEqual(7);
  });

  it('substitui a regra fixa de 3 questões por Curva Contínua de Confiança da Amostra (estilo saturação BM25)', () => {
    // Com apenas 3 questões, a confiança da amostra ainda não saturou (< 55%), mantendo calibração ativa
    const conf3SmallSubj = calculateSampleConfidencePercent(3, 4);
    const conf3ExtensiveSubj = calculateSampleConfidencePercent(3, 12);
    const conf30Subj = calculateSampleConfidencePercent(30, 4);

    expect(conf3SmallSubj).toBeLessThan(55);
    // Matérias mais extensas exigem mais evidência para atingir a mesma confiança
    expect(conf3ExtensiveSubj).toBeLessThan(conf3SmallSubj);
    // Com 30 evidências, a confiança supera 65%
    expect(conf30Subj).toBeGreaterThanOrEqual(65);
  });

  it('calcula decaimento de memória (Meia-Vida HLR + Regra 10-20% de Cepeda) e separa Cobertura de Domínio', () => {
    const nineteenDaysAgo = new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString();
    const decay = calculateMemoryDecayBoost({
      lastStudiedAt: nineteenDaysAgo,
      masteredCount: 1,
      baseGapCount: 1,
      daysUntilExam: 90,
    });

    expect(decay.daysSinceLastStudy).toBeGreaterThanOrEqual(18);
    expect(decay.decayHeatBoost).toBeGreaterThan(0.5);

    const result = calculateDynamicStudyCycle({
      plan: cguPlan,
      subjects: cguSubjects,
      topicsBySubject,
      attempts: [],
      sessions: [],
      topicLinks: SEED_TOPIC_LINKS,
    });

    for (const alloc of result.allocations) {
      expect(alloc.coveragePercent).toBeGreaterThanOrEqual(0);
      expect(alloc.coveragePercent).toBeLessThanOrEqual(100);
      expect(alloc.studiedTopicsMastery).toBeGreaterThanOrEqual(0);
    }
  });

  it('propaga prioridade no Mapa de Calor para tópicos pré-requisitos vinculados em topic_links', () => {
    // t-cgu-1-1 (ISSAI 100) é pré-requisito de t-cgu-1-3 (Amostragem)
    const attemptsOnTarget: QuestionAttempt[] = [
      {
        id: 'att-gap-1',
        question_id: 'q-1',
        topic_id: 't-cgu-1-3',
        selected_option: 'A',
        is_correct: 0,
        used_ai_review: 1,
        self_diagnosis: 'BASE_GAP',
        time_spent_seconds: 60,
        attempted_at: new Date().toISOString(),
      },
    ];

    const withoutGap = calculateDynamicStudyCycle({
      plan: cguPlan,
      subjects: cguSubjects.map((s) => ({ ...s })),
      topicsBySubject: {
        ...topicsBySubject,
        'subj-cgu-auditoria': topicsBySubject['subj-cgu-auditoria'].map((t) =>
          t.id === 't-cgu-1-3' ? { ...t, mastery_score: 80 } : t
        ),
      },
      attempts: [],
      sessions: [],
      topicLinks: SEED_TOPIC_LINKS,
    });

    const withGapOnDependent = calculateDynamicStudyCycle({
      plan: cguPlan,
      subjects: cguSubjects.map((s) => ({ ...s })),
      topicsBySubject,
      attempts: attemptsOnTarget,
      sessions: [],
      topicLinks: SEED_TOPIC_LINKS,
    });

    const prereqBefore = withoutGap.topicHeatmapRanking.find((t) => t.topic.id === 't-cgu-1-1')!;
    const prereqAfter = withGapOnDependent.topicHeatmapRanking.find(
      (t) => t.topic.id === 't-cgu-1-1'
    )!;

    expect(prereqAfter.heatScore).toBeGreaterThan(prereqBefore.heatScore);
  });

  it('detecta sobrecarga quando o estudante cadastra muitas disciplinas para poucas horas semanais', () => {
    const manySubjects = [
      ...SEED_SUBJECTS,
      { ...SEED_SUBJECTS[0], id: 'extra-1', name: 'Direito Constitucional' },
      { ...SEED_SUBJECTS[0], id: 'extra-2', name: 'Economia Setor Público' },
    ];

    const result = calculateDynamicStudyCycle({
      plan: { ...cguPlan, weekly_hours_target: 14 }, // 14h/sem para 9 matérias
      subjects: manySubjects,
      topicsBySubject,
      attempts: [],
      sessions: [],
      topicLinks: [],
    });

    expect(result.isOverloaded).toBe(true);
    expect(result.overloadMessage).toContain('disciplinas simultâneas');
  });

  it('retorna amostras reais de subtópicos para ajudar a calibrar Nível e Afinidade da matéria', () => {
    const samples = getSampleSubtopicsForCalibration('Contabilidade Pública (CASP)');
    expect(samples.length).toBeGreaterThanOrEqual(3);
    expect(samples.some((s) => s.includes('PCASP'))).toBe(true);
  });
});

describe('questões feitas fora do app entram no motor (spec 07 §5.4)', () => {
  const plan = SEED_STUDY_PLANS[0];
  const subjects = SEED_SUBJECTS.filter((s) => s.plan_id === plan.id);
  const bySubject: Record<string, Topic[]> = {};
  for (const s of subjects) bySubject[s.id] = SEED_TOPICS.filter((t) => t.subject_id === s.id);
  const target = SEED_TOPICS.find((t) => t.subject_id === subjects[0].id && !SEED_TOPICS.some((c) => c.parent_id === t.id))!;
  const log = (correct: number, total = 20) =>
    ({ id: `l${correct}`, subject_id: target.subject_id, topic_id: target.id, total, correct, blank: 0, source: 'EXTERNAL', mastery_before: 0, logged_at: new Date().toISOString() }) as QuestionLog;
  const heatOf = (questionLogs: QuestionLog[]) =>
    calculateDynamicStudyCycle({ plan, subjects, topicsBySubject: bySubject, attempts: [], sessions: [], topicLinks: [], questionLogs })
      .topicHeatmapRanking.find((h) => h.topic.id === target.id)!;

  it('as questões registradas contam como amostra do tópico', () => {
    const base = heatOf([]);
    const withLog = heatOf([log(14)]);
    expect(withLog.attemptsCount).toBe(base.attemptsCount + 20);
    expect(withLog.sampleConfidencePercent).toBeGreaterThan(base.sampleConfidencePercent);
  });

  it('registro com 70% ou mais alonga a meia-vida (dominei); abaixo de 50% encurta (lacuna)', () => {
    const base = heatOf([]).memoryHalfLifeDays;
    expect(heatOf([log(16)]).memoryHalfLifeDays).toBeGreaterThan(base);
    expect(heatOf([log(6)]).memoryHalfLifeDays).toBeLessThan(base);
  });

  it('registro com poucas questões (menos de 5) conta como amostra, mas não como "dominei" nem lacuna', () => {
    const base = heatOf([]).memoryHalfLifeDays;
    expect(heatOf([log(4, 4)]).memoryHalfLifeDays).toBe(base);
    expect(heatOf([log(0, 4)]).memoryHalfLifeDays).toBe(base);
  });
});

describe('autoavaliação da pergunta aberta (Revisão do dia) pesa metade de uma questão na memória', () => {
  const plan = SEED_STUDY_PLANS[0];
  const subjects = SEED_SUBJECTS.filter((s) => s.plan_id === plan.id);
  const bySubject: Record<string, Topic[]> = {};
  for (const s of subjects) bySubject[s.id] = SEED_TOPICS.filter((t) => t.subject_id === s.id);
  const target = SEED_TOPICS.find((t) => t.subject_id === subjects[0].id && !SEED_TOPICS.some((c) => c.parent_id === t.id))!;
  const check = (rating: RecallCheck['rating'], n: number) =>
    ({ id: `r${rating}${n}`, subject_id: target.subject_id, topic_id: target.id, rating, checked_at: new Date().toISOString() }) as RecallCheck;
  const masteredLog = { id: 'l1', subject_id: target.subject_id, topic_id: target.id, total: 20, correct: 18, blank: 0, source: 'EXTERNAL', mastery_before: 0, logged_at: new Date().toISOString() } as QuestionLog;
  const heatOf = (recallChecks: RecallCheck[], questionLogs: QuestionLog[] = []) =>
    calculateDynamicStudyCycle({ plan, subjects, topicsBySubject: bySubject, attempts: [], sessions: [], topicLinks: [], questionLogs, recallChecks })
      .topicHeatmapRanking.find((h) => h.topic.id === target.id)!;

  it('dois "Lembrei bem" alongam a meia-vida como um "dominei"', () => {
    expect(RECALL_CHECK_WEIGHT).toBe(0.5);
    expect(heatOf([check('GOOD', 1), check('GOOD', 2)]).memoryHalfLifeDays).toBe(heatOf([], [masteredLog]).memoryHalfLifeDays);
  });

  it('"Não lembrei" encurta, "Lembrei em parte" não muda', () => {
    const base = heatOf([]).memoryHalfLifeDays;
    expect(heatOf([check('FORGOT', 1), check('FORGOT', 2)]).memoryHalfLifeDays).toBeLessThan(base);
    expect(heatOf([check('PARTIAL', 1)]).memoryHalfLifeDays).toBe(base);
  });

  it('autoavaliação não é amostra de questões', () => {
    expect(heatOf([check('GOOD', 1)]).attemptsCount).toBe(heatOf([]).attemptsCount);
    expect(heatOf([check('GOOD', 1)]).masteredCount).toBe(heatOf([]).masteredCount);
  });
});

describe('diagnósticos novos no motor (spec 11 §5.5)', () => {
  const plan = SEED_STUDY_PLANS[0];
  const subjects = SEED_SUBJECTS.filter((s) => s.plan_id === plan.id);
  const bySubject: Record<string, Topic[]> = {};
  for (const s of subjects) bySubject[s.id] = SEED_TOPICS.filter((t) => t.subject_id === s.id);
  const target = SEED_TOPICS.find((t) => t.subject_id === subjects[0].id && !SEED_TOPICS.some((c) => c.parent_id === t.id))!;
  const attempt = (n: number, diagnosis: QuestionAttempt['self_diagnosis'], correct: boolean, confidence: QuestionAttempt['confidence'] = null) =>
    ({ id: `a${n}`, question_id: `q${n}`, topic_id: target.id, selected_option: 'A', is_correct: correct ? 1 : 0, used_ai_review: 0, self_diagnosis: diagnosis, time_spent_seconds: 30, attempted_at: new Date().toISOString(), confidence }) as QuestionAttempt;
  const heatOf = (attempts: QuestionAttempt[]) =>
    calculateDynamicStudyCycle({ plan, subjects, topicsBySubject: bySubject, attempts, sessions: [], topicLinks: [] }).topicHeatmapRanking.find((h) => h.topic.id === target.id)!;

  it('acertei no chute conta na amostra, mas não alonga a meia-vida como um dominei', () => {
    const base = heatOf([]);
    const lucky = heatOf([attempt(1, 'LUCKY_GUESS', true, 'GUESS')]);
    expect(lucky.attemptsCount).toBe(base.attemptsCount + 1);
    expect(lucky.memoryHalfLifeDays).toBe(base.memoryHalfLifeDays);
    expect(heatOf([attempt(1, 'MASTERED', true, 'SURE')]).memoryHalfLifeDays).toBeGreaterThan(base.memoryHalfLifeDays);
  });

  it('confundi encurta a meia-vida como lacuna e esquenta mais que não sabia', () => {
    const gap = heatOf([attempt(1, 'BASE_GAP', false)]);
    const confused = heatOf([attempt(1, 'MISCONCEPTION', false)]);
    expect(confused.memoryHalfLifeDays).toBe(gap.memoryHalfLifeDays);
    expect(confused.heatScore).toBeGreaterThan(gap.heatScore);
  });

  it('falsa certeza esquenta mais que um chute errado; com pegadinha, não', () => {
    expect(heatOf([attempt(1, 'BASE_GAP', false, 'SURE')]).heatScore).toBeGreaterThan(heatOf([attempt(1, 'BASE_GAP', false, 'GUESS')]).heatScore);
    expect(heatOf([attempt(1, 'BOARD_TRAP', false, 'SURE')]).heatScore).toBe(heatOf([attempt(1, 'BOARD_TRAP', false, 'GUESS')]).heatScore);
  });
});

describe('Divisão recomendada pela semana padrão (revisão independente da 13a)', () => {
  const plan = SEED_STUDY_PLANS[0];
  const subjects = SEED_SUBJECTS.filter((s) => s.plan_id === plan.id);
  const topics: Record<string, Topic[]> = {};
  for (const s of subjects) topics[s.id] = SEED_TOPICS.filter((t) => t.subject_id === s.id);
  const base = { plan, subjects, topicsBySubject: topics, attempts: [], sessions: [], topicLinks: SEED_TOPIC_LINKS };

  it('semana padrão de folga: nada a aplicar (a divisão gravada não é zerada)', () => {
    expect(recommendedForStandardWeek(base, 0)).toBeNull();
  });

  it('semana atípica não distorce: a divisão aplicada é a da semana padrão', () => {
    const standard = recommendedForStandardWeek(base, 1050)!;
    const fromStandard = calculateDynamicStudyCycle({ ...base, weeklyMinutesBudget: 1050 }).allocations.map((a) => ({
      subjectId: a.subject.id,
      minutes: a.recommendedWeeklyMinutes,
    }));
    expect(standard).toEqual(fromStandard);
    expect(standard.every((a) => a.minutes > 0)).toBe(true);
  });
});
