import type {
  QuestionAttempt,
  StudyPlan,
  StudySession,
  StudyStrategy,
  Subject,
  SubjectCategory,
  Topic,
  TopicLink,
} from '../types/database';

// ============================================================================
// Pesos do motor — exportados para que a explicação "ⓘ" mostre EXATAMENTE a conta feita aqui
// ============================================================================

/** Prioridade da disciplina = Peso × (1 + soma dos termos) × Estratégia. */
export const SUBJECT_SCORE_WEIGHTS = {
  coldStartPerLevel: 0.35, // (5 − base inicial 1..4) × 0,35
  affinityPerLevel: 0.2, // (4 − afinidade 1..3) × 0,2
  masteryNeedDivisor: 35, // ((100 − domínio) ÷ 35) × 0,6
  masteryNeedFactor: 0.6,
  unvisitedCoverage: 0.45, // (1 − cobertura) × 0,45
  topicHeat: 0.25, // calor médio dos tópicos × 0,25
  friction: 0.8, // atrito comportamental (0..1) × 0,8
} as const;

/** Calor do tópico = (déficit + sinais + pré-requisitos + esquecimento) × peso da matéria, limitado a 0,5..10. */
export const TOPIC_HEAT_WEIGHTS = {
  masteryDeficitDivisor: 25, // (100 − domínio) ÷ 25 → 0..4
  baseGap: 1.35,
  doubt: 0.55,
  boardTrap: 0.25,
  mastered: 0.4, // subtrai
  prerequisitePerLink: 1.2, // por tópico dependente com lacuna ou domínio < 50%
  forgettingScale: 2.2, // risco de esquecimento (0..1) × 2,2
  examWeightBase: 0.7,
  examWeightFactor: 0.2, // multiplicador = 0,7 + peso × 0,2
  min: 0.5,
  max: 10,
} as const;

/** Efeito da estratégia escolhida no Wizard (docs/specs/05). Sem estratégia = 1 (neutra). */
export const STRATEGY_FACTORS = {
  BASE_COMUM: { BASICO: 1.3, GERAL: 1.1, ESPECIFICO: 1.0 } as Record<SubjectCategory, number>,
  MAIS_COBRADOS_HEAT_FACTOR: 0.06, // 1 + 0,06 × calor médio (prioriza onde há mais dificuldade)
  ALTO_PESO_CURTO_EXPONENT: 0.75, // (peso ÷ peso médio)^0,75 (concentra nas matérias de maior peso)
} as const;

export const STRATEGY_LABELS: Record<StudyStrategy, string> = {
  BASE_COMUM: 'Garantir a Base Comum',
  MAIS_COBRADOS: 'Atacar o que mais cai e meus pontos fracos',
  ALTO_PESO_CURTO: 'Alta rentabilidade (maior peso na prova)',
};

export interface TopicHeatBreakdown {
  masteryDeficit: number;
  diagnosisSignal: number; // já sem valores negativos
  prerequisiteBoost: number;
  forgettingBoost: number;
  examWeightMultiplier: number;
}

export interface TopicHeatItem {
  topic: Topic;
  subjectName: string;
  subjectColor: string;
  attemptsCount: number;
  baseGapCount: number;
  doubtCount: number;
  boardTrapCount: number;
  masteredCount: number;
  sampleConfidencePercent: number;  // Confiança amostral contínua (curva de saturação, 0..100%)
  memoryHalfLifeDays: number;       // Meia-vida estimada da memória (em dias)
  daysSinceLastStudy: number | null;
  isReverseStudyDiscovery: boolean; // Derivado de sampleConfidencePercent < 35%
  heatScore: number;                // Urgência 0,5..10
  heatBreakdown: TopicHeatBreakdown;
  relatedPrerequisiteTitles: string[];
}

export interface SubjectScoreBreakdown {
  examWeight: number;
  coldStart: number;
  affinity: number;
  masteryNeed: number;
  unvisitedCoverage: number;
  topicHeat: number;
  friction: number;
  strategyMultiplier: number;
}

export interface SubjectCycleAllocation {
  subject: Subject;
  elasticScore: number;             // Prioridade bruta (ver SUBJECT_SCORE_WEIGHTS)
  scoreBreakdown: SubjectScoreBreakdown;
  sharePercent: number;             // % da pizza no ciclo (soma ≈ 100%)
  coveragePercent: number;          // % de tópicos do edital já iniciados (evita média diluída)
  studiedTopicsMastery: number;     // Domínio médio real dos tópicos já estudados
  currentWeeklyMinutes: number;     // Minutos atuais do ciclo aplicado, proporcionais à meta semanal
  recommendedWeeklyMinutes: number; // Minutos sugeridos pela prioridade mantendo o teto semanal
  deltaMinutes: number;             // Diferença sugerida para o próximo ciclo (soma zero!)
  blocksPerWeek: number;            // Quantidade de blocos de estudo sugeridos na semana
  studiedThisWeekMinutes: number;   // Minutos registrados no Pomodoro desde segunda-feira
  remainingThisWeekMinutes: number; // Quanto falta do ciclo atual nesta semana
  dominantReason: string;           // Explicação transparente da prioridade
}

export interface CycleSuggestion {
  id: string;
  type: 'REBALANCE' | 'OVERLOAD_WARNING' | 'REVERSE_STUDY_INFO' | 'PREREQUISITE_ALERT';
  title: string;
  description: string;
  actionLabel?: string;
}

export interface CycleCalculationResult {
  daysUntilExam: number | null;
  totalWeeklyMinutesBudget: number;
  dailyAverageMinutes: number;
  isOverloaded: boolean;
  overloadMessage: string | null;
  strategy: StudyStrategy | null;
  weekStartIso: string;
  allocations: SubjectCycleAllocation[];
  topicHeatmapRanking: TopicHeatItem[];
  suggestions: CycleSuggestion[];
}

const DAY_MS = 1000 * 60 * 60 * 24;

/** Segunda-feira 00:00 (horário local) da semana de `date`. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/**
 * Confiança da amostra: curva de saturação inspirada no BM25 — C = n ÷ (n + k),
 * com k crescendo conforme a extensão da disciplina. Substitui o antigo `< 3 questões`.
 */
export function calculateSampleConfidencePercent(
  attemptsCount: number,
  topicCountInSubject = 4
): number {
  if (attemptsCount <= 0) return 0;
  const saturationK = sampleSaturationK(topicCountInSubject);
  const confidenceRatio = attemptsCount / (attemptsCount + saturationK);
  return Math.round(confidenceRatio * 100);
}

/** Constante k da curva de confiança (mínimo 8; cresce 1,5 por tópico da disciplina). */
export function sampleSaturationK(topicCountInSubject: number): number {
  return Math.max(8, 6 + topicCountInSubject * 1.5);
}

/**
 * Curva de esquecimento exponencial (inspirada no HLR do Duolingo, mas com regra fixa — não é um
 * modelo treinado): meia-vida base = 12% dos dias até a prova (3..21 dias, regra de Cepeda et al.),
 * ×1,45 a cada "Dominei" e ×0,75 a cada "Lacuna". Esquecimento = 1 − 2^(−dias ÷ meia-vida).
 */
export function calculateMemoryDecayBoost(params: {
  lastStudiedAt: string | null;
  masteredCount: number;
  baseGapCount: number;
  daysUntilExam: number | null;
  nowMs?: number;
}): { memoryHalfLifeDays: number; daysSinceLastStudy: number | null; decayHeatBoost: number } {
  const { lastStudiedAt, masteredCount, baseGapCount, daysUntilExam } = params;

  const optimalHorizonDays =
    daysUntilExam && daysUntilExam > 0
      ? Math.max(3, Math.min(21, Math.round(daysUntilExam * 0.12)))
      : 7;

  const rawHalfLife = optimalHorizonDays * Math.pow(1.45, masteredCount) * Math.pow(0.75, baseGapCount);
  const memoryHalfLifeDays = Math.max(2, Math.min(45, Math.round(rawHalfLife)));

  if (!lastStudiedAt) {
    return { memoryHalfLifeDays, daysSinceLastStudy: null, decayHeatBoost: 0 };
  }

  const elapsedMs = (params.nowMs ?? Date.now()) - new Date(lastStudiedAt).getTime();
  const daysSinceLastStudy = Math.max(0, Math.floor(elapsedMs / DAY_MS));

  const recallProbability = Math.pow(2, -daysSinceLastStudy / memoryHalfLifeDays);
  const forgettingRisk = 1 - recallProbability;
  const decayHeatBoost = Number((forgettingRisk * TOPIC_HEAT_WEIGHTS.forgettingScale).toFixed(2));

  return { memoryHalfLifeDays, daysSinceLastStudy, decayHeatBoost };
}

/**
 * Amostras de subtópicos reais de prova para ajudar o estudante a calibrar
 * Nível Inicial (1-4) e Afinidade (1-3) sabendo exatamente do que a matéria trata.
 */
export function getSampleSubtopicsForCalibration(subjectName: string): string[] {
  const normalized = subjectName.toLowerCase();
  if (normalized.includes('auditoria')) {
    return [
      'Risco de Auditoria (RI × RC × RD — ISSAI 100)',
      'Matriz de Achados, Evidências e Amostragem (NBC TA 530)',
      'Controle Interno no Poder Executivo Federal (Lei 10.180/01)',
    ];
  }
  if (normalized.includes('contabilidade') || normalized.includes('casp')) {
    return [
      'Classes 1 a 8 do PCASP (Patrimonial, Orçamentária e Controle)',
      'Balanço Orçamentário, Financeiro e Patrimonial (DCASP)',
      'Restos a Pagar (Processados vs Não Processados) e Dívida Ativa',
    ];
  }
  if (normalized.includes('desenvolvimento') || normalized.includes('arquitetura') || normalized.includes('software')) {
    return [
      'Arquitetura Limpa, Microsserviços, DDD e Mensageria (Kafka)',
      'Segurança Web (OWASP Top 10, OAuth 2.0, OIDC e JWT)',
      'CI/CD, Containers (Docker/Kubernetes) e Testes Automatizados',
    ];
  }
  if (normalized.includes('segurança') || normalized.includes('criptografia')) {
    return [
      'Criptografia Simétrica/Assimétrica, TLS 1.3 e ICP-Brasil',
      'Gestão de Riscos e Continuidade (ISO 27001 / 27002 / NIST)',
      'Zero Trust, Mitigação de DDoS e Resposta a Incidentes',
    ];
  }
  if (normalized.includes('financeiro') || normalized.includes('sfn') || normalized.includes('bacen')) {
    return [
      'Composição do SFN: CMN, BACEN, CVM, SUSEP e PREVIC',
      'Ecossistema Pix: Liquidação Bruta em Tempo Real (SPI) e DICT',
      'Política Monetária (SELIC, Compulsório, Open Market) e Basileia',
    ];
  }
  if (normalized.includes('administrativo') || normalized.includes('licita')) {
    return [
      'Nova Lei de Licitações (Lei 14.133/2021) e Contratações de TI',
      'Atos Administrativos, Poderes e Agentes Públicos (Lei 8.112/90)',
      'Controle da Administração Pública e Improbidade Administrativa',
    ];
  }
  return [
    'Conceitos Fundamentais e Letra da Lei / Normativos',
    'Jurisprudência das Cortes Superiores / TCU',
    'Estudos de Caso e Pegadinhas Recorrentes da Banca',
  ];
}

/** Multiplicador da estratégia escolhida no Wizard (1 = neutra). */
export function calculateStrategyMultiplier(params: {
  strategy: StudyStrategy | null;
  subject: Subject;
  avgTopicHeat: number;
  meanExamWeight: number;
}): number {
  const { strategy, subject, avgTopicHeat, meanExamWeight } = params;
  if (strategy === 'BASE_COMUM') return STRATEGY_FACTORS.BASE_COMUM[subject.category] ?? 1;
  if (strategy === 'MAIS_COBRADOS') return 1 + STRATEGY_FACTORS.MAIS_COBRADOS_HEAT_FACTOR * avgTopicHeat;
  if (strategy === 'ALTO_PESO_CURTO' && meanExamWeight > 0) {
    return Math.pow(subject.exam_weight / meanExamWeight, STRATEGY_FACTORS.ALTO_PESO_CURTO_EXPONENT);
  }
  return 1;
}

/** Soma os termos do detalhamento — é a mesma conta usada para `elasticScore`. */
export function composeSubjectScore(b: SubjectScoreBreakdown): number {
  return (
    b.examWeight *
    (1 + b.coldStart + b.affinity + b.masteryNeed + b.unvisitedCoverage + b.topicHeat + b.friction) *
    b.strategyMultiplier
  );
}

export function composeTopicHeat(b: TopicHeatBreakdown): number {
  const raw =
    (b.masteryDeficit + b.diagnosisSignal + b.prerequisiteBoost + b.forgettingBoost) *
    b.examWeightMultiplier;
  return Math.max(TOPIC_HEAT_WEIGHTS.min, Math.min(TOPIC_HEAT_WEIGHTS.max, raw));
}

function pickDominantReason(params: {
  subject: Subject;
  studiedTopicsMastery: number;
  coveragePercent: number;
}): string {
  const { subject, studiedTopicsMastery, coveragePercent } = params;
  if (studiedTopicsMastery < 50) {
    return `Prioridade alta no Mapa de Calor (Domínio ${studiedTopicsMastery}% • Cobertura ${coveragePercent}%)`;
  }
  if (studiedTopicsMastery >= 80 && coveragePercent >= 80) {
    return `Base consolidada (${studiedTopicsMastery}%) — Modo manutenção espaçada`;
  }
  if (subject.initial_affinity_level === 1) {
    return 'Baixa afinidade inicial — Sessões curtas e frequentes';
  }
  return `Peso ${subject.exam_weight}x no edital • Cobertura ${coveragePercent}%`;
}

/**
 * Motor do Ciclo de Estudos (prioridade por disciplina + Orçamento Fixo Soma Zero).
 * Combina confiança da amostra (curva de saturação) e curva de esquecimento por tópico.
 */
export function calculateDynamicStudyCycle(params: {
  plan: StudyPlan;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  attempts: QuestionAttempt[];
  sessions: StudySession[];
  topicLinks: TopicLink[];
  now?: Date;
}): CycleCalculationResult {
  const { plan, subjects, topicsBySubject, attempts, sessions, topicLinks } = params;
  const now = params.now ?? new Date();
  const nowMs = now.getTime();
  const strategy = plan.strategy_mode ?? null;

  const totalWeeklyMinutesBudget = Math.max(60, Math.round(plan.weekly_hours_target * 60));
  const dailyAverageMinutes = Math.round(totalWeeklyMinutesBudget / 7);

  // 1. Dias até a prova
  let daysUntilExam: number | null = null;
  if (plan.exam_date) {
    const examMs = new Date(`${plan.exam_date}T00:00:00`).getTime();
    const diffDays = Math.ceil((examMs - nowMs) / DAY_MS);
    daysUntilExam = diffDays > 0 ? diffDays : 0;
  }

  // 2. Sobrecarga cognitiva (< 180 min/semana por disciplina com 5+ disciplinas)
  const avgMinutesPerSubject = subjects.length > 0 ? totalWeeklyMinutesBudget / subjects.length : 0;
  const isOverloaded = subjects.length >= 5 && avgMinutesPerSubject < 180;
  const overloadMessage = isOverloaded
    ? `Você está com ${subjects.length} disciplinas simultâneas para ${plan.weekly_hours_target}h/semana (~${Math.round((avgMinutesPerSubject / 60) * 10) / 10}h por matéria). Considere focar em 4 a 5 matérias principais neste ciclo para não pulverizar sua retenção.`
    : null;

  // 3. Tópicos "pai" (que têm subtópicos) são agrupadores: ficam fora do calor e da cobertura
  const allTopicsMap = new Map<string, Topic>();
  const parentTopicIds = new Set<string>();
  for (const subj of subjects) {
    for (const t of topicsBySubject[subj.id] || []) {
      allTopicsMap.set(t.id, t);
      if (t.parent_id) parentTopicIds.add(t.parent_id);
    }
  }
  const studyableTopics = (subjectId: string) =>
    (topicsBySubject[subjectId] || []).filter((t) => !parentTopicIds.has(t.id));

  // 4. Mapa de Calor de Tópicos
  const topicHeatmapRanking: TopicHeatItem[] = [];
  const prerequisiteBoostByTopic = new Map<string, number>();

  for (const subj of subjects) {
    for (const topic of studyableTopics(subj.id)) {
      const baseGapCount = attempts.filter(
        (a) => a.topic_id === topic.id && a.self_diagnosis === 'BASE_GAP'
      ).length;
      if (baseGapCount > 0 || topic.mastery_score < 50) {
        for (const link of topicLinks.filter((l) => l.target_topic_id === topic.id)) {
          const prev = prerequisiteBoostByTopic.get(link.source_topic_id) || 0;
          prerequisiteBoostByTopic.set(link.source_topic_id, prev + TOPIC_HEAT_WEIGHTS.prerequisitePerLink);
        }
      }
    }
  }

  for (const subj of subjects) {
    const subjTopics = studyableTopics(subj.id);
    for (const topic of subjTopics) {
      const topicAttempts = attempts.filter((a) => a.topic_id === topic.id);
      const attemptsCount = topicAttempts.length;
      const baseGapCount = topicAttempts.filter((a) => a.self_diagnosis === 'BASE_GAP').length;
      const doubtCount = topicAttempts.filter((a) => a.self_diagnosis === 'DOUBT').length;
      const boardTrapCount = topicAttempts.filter((a) => a.self_diagnosis === 'BOARD_TRAP').length;
      const masteredCount = topicAttempts.filter((a) => a.self_diagnosis === 'MASTERED').length;

      const sampleConfidencePercent = calculateSampleConfidencePercent(attemptsCount, subjTopics.length);
      const isReverseStudyDiscovery = sampleConfidencePercent < 35 && topic.status !== 'MASTERED';

      const { memoryHalfLifeDays, daysSinceLastStudy, decayHeatBoost } = calculateMemoryDecayBoost({
        lastStudiedAt: topic.last_studied_at,
        masteredCount,
        baseGapCount,
        daysUntilExam,
        nowMs,
      });

      const rawDiagnosisSignal =
        baseGapCount * TOPIC_HEAT_WEIGHTS.baseGap +
        doubtCount * TOPIC_HEAT_WEIGHTS.doubt +
        boardTrapCount * TOPIC_HEAT_WEIGHTS.boardTrap -
        masteredCount * TOPIC_HEAT_WEIGHTS.mastered;

      const heatBreakdown: TopicHeatBreakdown = {
        masteryDeficit: (100 - topic.mastery_score) / TOPIC_HEAT_WEIGHTS.masteryDeficitDivisor,
        diagnosisSignal: Math.max(0, rawDiagnosisSignal),
        prerequisiteBoost: prerequisiteBoostByTopic.get(topic.id) || 0,
        forgettingBoost: decayHeatBoost,
        examWeightMultiplier:
          TOPIC_HEAT_WEIGHTS.examWeightBase + subj.exam_weight * TOPIC_HEAT_WEIGHTS.examWeightFactor,
      };

      const relatedPrerequisiteTitles = topicLinks
        .filter((l) => l.target_topic_id === topic.id || l.source_topic_id === topic.id)
        .map((l) => {
          const otherId = l.source_topic_id === topic.id ? l.target_topic_id : l.source_topic_id;
          const other = allTopicsMap.get(otherId);
          return other ? `${other.code} ${other.title}` : null;
        })
        .filter((x): x is string => Boolean(x));

      topicHeatmapRanking.push({
        topic,
        subjectName: subj.name,
        subjectColor: subj.color,
        attemptsCount,
        baseGapCount,
        doubtCount,
        boardTrapCount,
        masteredCount,
        sampleConfidencePercent,
        memoryHalfLifeDays,
        daysSinceLastStudy,
        isReverseStudyDiscovery,
        heatScore: Number(composeTopicHeat(heatBreakdown).toFixed(1)),
        heatBreakdown,
        relatedPrerequisiteTitles,
      });
    }
  }

  topicHeatmapRanking.sort((a, b) => b.heatScore - a.heatScore);

  // 5. Minutos já estudados nesta semana (desde segunda-feira), por disciplina
  const weekStart = startOfWeek(now);
  const studiedThisWeekBySubject = new Map<string, number>();
  for (const session of sessions) {
    if (session.was_skipped || new Date(session.started_at).getTime() < weekStart.getTime()) continue;
    studiedThisWeekBySubject.set(
      session.subject_id,
      (studiedThisWeekBySubject.get(session.subject_id) || 0) + session.duration_minutes
    );
  }

  // 6. Prioridade por disciplina e normalização (soma = orçamento semanal)
  const meanExamWeight =
    subjects.length > 0 ? subjects.reduce((acc, s) => acc + s.exam_weight, 0) / subjects.length : 1;
  const W = SUBJECT_SCORE_WEIGHTS;

  const rawSubjectScores = subjects.map((subj) => {
    const subjTopics = topicHeatmapRanking.filter((t) => t.topic.subject_id === subj.id);
    const avgTopicHeat =
      subjTopics.length > 0
        ? subjTopics.reduce((acc, item) => acc + item.heatScore, 0) / subjTopics.length
        : 4.0;

    // Separa Cobertura do Edital de Domínio dos Tópicos Estudados (evita média diluída!)
    const startedTopics = subjTopics.filter(
      (t) => t.topic.mastery_score > 0 || t.attemptsCount > 0 || t.topic.status !== 'PENDING'
    );
    const coveragePercent =
      subjTopics.length > 0 ? Math.round((startedTopics.length / subjTopics.length) * 100) : 0;
    const studiedTopicsMastery =
      startedTopics.length > 0
        ? Math.round(startedTopics.reduce((acc, t) => acc + t.topic.mastery_score, 0) / startedTopics.length)
        : subj.measured_mastery_score;

    const scoreBreakdown: SubjectScoreBreakdown = {
      examWeight: subj.exam_weight,
      coldStart: (5 - subj.initial_knowledge_level) * W.coldStartPerLevel,
      affinity: (4 - subj.initial_affinity_level) * W.affinityPerLevel,
      masteryNeed: ((100 - studiedTopicsMastery) / W.masteryNeedDivisor) * W.masteryNeedFactor,
      unvisitedCoverage: ((100 - coveragePercent) / 100) * W.unvisitedCoverage,
      topicHeat: avgTopicHeat * W.topicHeat,
      friction: subj.behavioral_friction_score * W.friction,
      strategyMultiplier: calculateStrategyMultiplier({ strategy, subject: subj, avgTopicHeat, meanExamWeight }),
    };

    return {
      subject: subj,
      elasticScore: Number(composeSubjectScore(scoreBreakdown).toFixed(2)),
      scoreBreakdown,
      coveragePercent,
      studiedTopicsMastery,
      dominantReason: pickDominantReason({ subject: subj, studiedTopicsMastery, coveragePercent }),
    };
  });

  const totalElasticScore = rawSubjectScores.reduce((acc, item) => acc + item.elasticScore, 0) || 1;
  const totalCurrentCycleMinutes = subjects.reduce((acc, s) => acc + s.cycle_allocated_minutes, 0) || 1;

  const allocations: SubjectCycleAllocation[] = rawSubjectScores.map((item) => {
    const shareRatio = item.elasticScore / totalElasticScore;
    const recommendedWeeklyMinutes = Math.max(30, Math.round((shareRatio * totalWeeklyMinutesBudget) / 15) * 15);
    const currentWeeklyMinutes = Math.round(
      (item.subject.cycle_allocated_minutes / totalCurrentCycleMinutes) * totalWeeklyMinutesBudget
    );
    const studiedThisWeekMinutes = studiedThisWeekBySubject.get(item.subject.id) || 0;

    return {
      subject: item.subject,
      elasticScore: item.elasticScore,
      scoreBreakdown: item.scoreBreakdown,
      sharePercent: Math.round(shareRatio * 100),
      coveragePercent: item.coveragePercent,
      studiedTopicsMastery: item.studiedTopicsMastery,
      currentWeeklyMinutes,
      recommendedWeeklyMinutes,
      deltaMinutes: recommendedWeeklyMinutes - currentWeeklyMinutes,
      blocksPerWeek: Math.max(1, Math.round(recommendedWeeklyMinutes / 60)),
      studiedThisWeekMinutes,
      remainingThisWeekMinutes: Math.max(0, currentWeeklyMinutes - studiedThisWeekMinutes),
      dominantReason: item.dominantReason,
    };
  });

  // 7. Sugestões não-invasivas para o próximo ciclo
  const suggestions: CycleSuggestion[] = [];

  const needMoreTime = [...allocations].sort((a, b) => b.deltaMinutes - a.deltaMinutes)[0];
  const canDonateTime = [...allocations].sort((a, b) => a.deltaMinutes - b.deltaMinutes)[0];

  if (
    needMoreTime &&
    canDonateTime &&
    needMoreTime.subject.id !== canDonateTime.subject.id &&
    Math.abs(needMoreTime.deltaMinutes) >= 30
  ) {
    suggestions.push({
      id: 'sug-rebalance',
      type: 'REBALANCE',
      title: `Sugestão para o Próximo Ciclo: Rebalancear ${Math.abs(needMoreTime.deltaMinutes)} min/sem`,
      description: `O Mapa de Calor aponta maior urgência em "${needMoreTime.subject.name}" (Prioridade ${needMoreTime.elasticScore}) enquanto "${canDonateTime.subject.name}" já está com ${canDonateTime.studiedTopicsMastery}% de domínio nos tópicos estudados. Você pode transferir ~${Math.abs(needMoreTime.deltaMinutes)} min/sem entre elas mantendo suas ${plan.weekly_hours_target}h/semana fixas!`,
      actionLabel: 'Aplicar Equilíbrio Sugerido ao Próximo Ciclo',
    });
  }

  if (overloadMessage) {
    suggestions.push({
      id: 'sug-overload',
      type: 'OVERLOAD_WARNING',
      title: '⚠️ Alerta de Diluição de Ciclo (Muitas Matérias Simultâneas)',
      description: overloadMessage,
    });
  }

  const hotTopicWithPrereq = topicHeatmapRanking.find(
    (t) => t.heatScore >= 6.0 && t.relatedPrerequisiteTitles.length > 0
  );
  if (hotTopicWithPrereq) {
    suggestions.push({
      id: 'sug-prereq',
      type: 'PREREQUISITE_ALERT',
      title: `🔗 Conexão Detectada: ${hotTopicWithPrereq.topic.code} ${hotTopicWithPrereq.topic.title}`,
      description: `Este tópico está quente no Mapa de Calor (${hotTopicWithPrereq.heatScore}/10) e possui vínculo direto com: ${hotTopicWithPrereq.relatedPrerequisiteTitles.join(', ')}. Revisar o pré-requisito destrava os acertos aqui!`,
    });
  }

  suggestions.push({
    id: 'sug-reverse-study',
    type: 'REVERSE_STUDY_INFO',
    title: '🛡️ Confiança Amostral Progressiva & Estudo Reverso',
    description:
      'Sua proficiência é ponderada pela maturidade da amostra de questões resolvidas e pela curva de esquecimento, sem nunca estourar seu limite de horas semanais.',
  });

  return {
    daysUntilExam,
    totalWeeklyMinutesBudget,
    dailyAverageMinutes,
    isOverloaded,
    overloadMessage,
    strategy,
    weekStartIso: weekStart.toISOString(),
    allocations,
    topicHeatmapRanking,
    suggestions,
  };
}
