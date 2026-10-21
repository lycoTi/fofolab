import { describe, expect, it } from 'vitest';
import {
  calculateDynamicStudyCycle,
  calculateMemoryDecayBoost,
  calculateSampleConfidencePercent,
  getSampleSubtopicsForCalibration,
} from '../lib/cycleEngine';
import {
  SEED_STUDY_PLANS,
  SEED_SUBJECTS,
  SEED_TOPIC_LINKS,
  SEED_TOPICS,
} from '../data/initialSeed';
import type { QuestionAttempt, Topic } from '../types/database';

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

  it('substitui a regra fixa de 3 questões por Curva Contínua de Confiança da Amostra (estilo saturação BM25)', () => {
    // Com apenas 3 questões, a confiança da amostra ainda não saturou (< 55%), mantendo calibração ativa
    const conf3SmallSubj = calculateSampleConfidencePercent(3, 4);
    const conf3ExtensiveSubj = calculateSampleConfidencePercent(3, 12);
    const conf20ExtensiveSubj = calculateSampleConfidencePercent(20, 12);

    expect(conf3SmallSubj).toBeLessThan(55);
    // Matérias mais extensas exigem mais evidência para atingir a mesma confiança
    expect(conf3ExtensiveSubj).toBeLessThan(conf3SmallSubj);
    // Com 20 evidências, a confiança supera 65%
    expect(conf20ExtensiveSubj).toBeGreaterThanOrEqual(65);
  });

  it('calcula decaimento de memória (Meia-Vida HLR + Regra 10-20% de Cepeda) e separa Cobertura de Domínio', () => {
    const nineteenDaysAgo = new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString();
    const decay = calculateMemoryDecayBoost({
      lastStudiedAt: nineteenDaysAgo,
      masteryScore: 60,
      attemptsCount: 4,
      daysUntilExam: 90,
    });

    expect(decay.daysSinceLastStudy).toBeGreaterThanOrEqual(18);
    expect(decay.forgettingBoost).toBeGreaterThan(0.5);

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
