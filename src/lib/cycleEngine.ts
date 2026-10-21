import type {
  QuestionAttempt,
  StudyPlan,
  StudySession,
  Subject,
  Topic,
  TopicLink,
} from '../types/database';

export interface TopicHeatItem {
  topic: Topic;
  subjectName: string;
  subjectColor: string;
  attemptsCount: number;
  baseGapCount: number;
  doubtCount: number;
  boardTrapCount: number;
  masteredCount: number;
  sampleConfidencePercent: number;  // Confiança amostral contínua estilo BM25 (0..100%)
  memoryHalfLifeDays: number;       // Meia-vida da memória (Duolingo HLR, em dias)
  daysSinceLastStudy: number | null;
  isReverseStudyDiscovery: boolean; // Derivado de sampleConfidencePercent < 35% (sem número mágico fixo!)
  heatScore: number;                // Pontuação estilo Elasticsearch (_score de urgência 0..10)
  relatedPrerequisiteTitles: string[];
}

export interface SubjectCycleAllocation {
  subject: Subject;
  elasticScore: number;             // _score bruto calculado estilo Elasticsearch
  sharePercent: number;             // % da pizza no ciclo (soma = 100%)
  coveragePercent: number;          // % de tópicos do edital já iniciados (evita média diluída)
  studiedTopicsMastery: number;     // Domínio médio real dos tópicos já estudados
  currentWeeklyMinutes: number;     // Minutos atuais alocados na semana
  recommendedWeeklyMinutes: number; // Minutos sugeridos pelo Score mantendo o teto fixo semanal
  deltaMinutes: number;             // Diferença sugerida para o próximo ciclo (soma zero!)
  blocksPerWeek: number;            // Quantidade de blocos de estudo sugeridos na semana
  dominantReason: string;           // Explicação transparente do _score
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
  allocations: SubjectCycleAllocation[];
  topicHeatmapRanking: TopicHeatItem[];
  suggestions: CycleSuggestion[];
}

/**
 * Calcula a Confiança Amostral Contínua estilo BM25 (Mandinach & Gummer, 2016).
 * Substitui números mágicos fixos (como `< 3 questões`) por uma curva de saturação:
 * C_n = W / (W + k), onde k escala com a extensão da disciplina.
 */
export function calculateSampleConfidencePercent(
  attemptsCount: number,
  topicCountInSubject = 4
): number {
  if (attemptsCount <= 0) return 0;
  // Constante de saturação k cresce conforme a amplitude da matéria (mínimo 8, padrão 10-14)
  const saturationK = Math.max(8, 6 + topicCountInSubject * 1.5);
  const confidenceRatio = attemptsCount / (attemptsCount + saturationK);
  return Math.round(confidenceRatio * 100);
}

/**
 * Calcula a Meia-Vida da Memória (Duolingo Half-Life Regression — Settles & Meeder, 2016)
 * combinada com a Regra dos 10–20% do Horizonte até a Prova (Cepeda et al., 2006).
 */
export function calculateMemoryDecayBoost(params: {
  lastStudiedAt: string | null;
  masteredCount: number;
  baseGapCount: number;
  daysUntilExam: number | null;
}): { memoryHalfLifeDays: number; daysSinceLastStudy: number | null; decayHeatBoost: number } {
  const { lastStudiedAt, masteredCount, baseGapCount, daysUntilExam } = params;

  // Intervalo ótimo base segundo Cepeda et al. (10-20% do horizonte até a prova, entre 3 e 21 dias)
  const optimalHorizonDays =
    daysUntilExam && daysUntilExam > 0
      ? Math.max(3, Math.min(21, Math.round(daysUntilExam * 0.12)))
      : 7;

  // Cada recuperação bem-sucedida expande a meia-vida; lacunas reduzem
  const rawHalfLife = optimalHorizonDays * Math.pow(1.45, masteredCount) * Math.pow(0.75, baseGapCount);
  const memoryHalfLifeDays = Math.max(2, Math.min(45, Math.round(rawHalfLife)));

  if (!lastStudiedAt) {
    return { memoryHalfLifeDays, daysSinceLastStudy: null, decayHeatBoost: 0 };
  }

  const elapsedMs = Date.now() - new Date(lastStudiedAt).getTime();
  const daysSinceLastStudy = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));

  // Probabilidade de retenção R(t) = 2^(-t / h). O risco de esquecimento é 1 - R(t)
  const recallProbability = Math.pow(2, -daysSinceLastStudy / memoryHalfLifeDays);
  const forgettingRisk = 1 - recallProbability;
  const decayHeatBoost = Number((forgettingRisk * 2.2).toFixed(2));

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

/**
 * Motor Matemático do Ciclo de Estudos (Estilo Elasticsearch `_score` + Orçamento Fixo Soma Zero).
 * Incorpora Confiança Amostral Contínua (BM25 saturation) e Meia-Vida da Memória (Duolingo HLR).
 */
export function calculateDynamicStudyCycle(params: {
  plan: StudyPlan;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  attempts: QuestionAttempt[];
  sessions: StudySession[];
  topicLinks: TopicLink[];
}): CycleCalculationResult {
  const { plan, subjects, topicsBySubject, attempts, topicLinks } = params;

  const totalWeeklyMinutesBudget = Math.max(60, Math.round(plan.weekly_hours_target * 60));
  const dailyAverageMinutes = Math.round(totalWeeklyMinutesBudget / 7);

  // 1. Cálculo de dias até a prova
  let daysUntilExam: number | null = null;
  if (plan.exam_date) {
    const examMs = new Date(`${plan.exam_date}T00:00:00`).getTime();
    const nowMs = Date.now();
    const diffDays = Math.ceil((examMs - nowMs) / (1000 * 60 * 60 * 24));
    daysUntilExam = diffDays > 0 ? diffDays : 0;
  }

  // 2. Detecção de Sobrecarga Cognitiva (< 180 min/semana por disciplina ativa)
  const avgMinutesPerSubject = subjects.length > 0 ? totalWeeklyMinutesBudget / subjects.length : 0;
  const isOverloaded = subjects.length >= 5 && avgMinutesPerSubject < 180;
  const overloadMessage = isOverloaded
    ? `Você está com ${subjects.length} disciplinas simultâneas para ${plan.weekly_hours_target}h/semana (~${Math.round((avgMinutesPerSubject / 60) * 10) / 10}h por matéria). Considere focar em 4 a 5 matérias principais neste ciclo para não pulverizar sua retenção.`
    : null;

  // 3. Mapa rápido de todos os tópicos para cruzar pré-requisitos (topic_links)
  const allTopicsMap = new Map<string, Topic>();
  for (const subj of subjects) {
    for (const t of topicsBySubject[subj.id] || []) {
      allTopicsMap.set(t.id, t);
    }
  }

  // 4. Construção do Mapa de Calor de Tópicos (Heatmap Ranking)
  const topicHeatmapRanking: TopicHeatItem[] = [];
  const prerequisiteBoostByTopic = new Map<string, number>();

  for (const subj of subjects) {
    const subjTopics = topicsBySubject[subj.id] || [];
    for (const topic of subjTopics) {
      const topicAttempts = attempts.filter((a) => a.topic_id === topic.id);
      const baseGapCount = topicAttempts.filter((a) => a.self_diagnosis === 'BASE_GAP').length;

      if (baseGapCount > 0 || topic.mastery_score < 50) {
        const incomingPrereqs = topicLinks.filter((l) => l.target_topic_id === topic.id);
        for (const link of incomingPrereqs) {
          const prev = prerequisiteBoostByTopic.get(link.source_topic_id) || 0;
          prerequisiteBoostByTopic.set(link.source_topic_id, prev + 1.2);
        }
      }
    }
  }

  for (const subj of subjects) {
    const subjTopics = topicsBySubject[subj.id] || [];
    for (const topic of subjTopics) {
      const topicAttempts = attempts.filter((a) => a.topic_id === topic.id);
      const attemptsCount = topicAttempts.length;
      const baseGapCount = topicAttempts.filter((a) => a.self_diagnosis === 'BASE_GAP').length;
      const doubtCount = topicAttempts.filter((a) => a.self_diagnosis === 'DOUBT').length;
      const boardTrapCount = topicAttempts.filter((a) => a.self_diagnosis === 'BOARD_TRAP').length;
      const masteredCount = topicAttempts.filter((a) => a.self_diagnosis === 'MASTERED').length;

      const sampleConfidencePercent = calculateSampleConfidencePercent(
        attemptsCount,
        subjTopics.length
      );
      const isReverseStudyDiscovery =
        sampleConfidencePercent < 35 && topic.status !== 'MASTERED';

      const { memoryHalfLifeDays, daysSinceLastStudy, decayHeatBoost } =
        calculateMemoryDecayBoost({
          lastStudiedAt: topic.last_studied_at,
          masteredCount,
          baseGapCount,
          daysUntilExam,
        });

      const masteryDeficit = (100 - topic.mastery_score) / 25; // 0.0 a 4.0
      const diagnosisSignal =
        baseGapCount * 1.35 +
        doubtCount * 0.55 +
        boardTrapCount * 0.25 -
        masteredCount * 0.4;

      const prereqBoost = prerequisiteBoostByTopic.get(topic.id) || 0;
      const rawHeat = Math.max(
        0.5,
        Math.min(
          10,
          (masteryDeficit + Math.max(0, diagnosisSignal) + prereqBoost + decayHeatBoost) *
            (0.7 + subj.exam_weight * 0.2)
        )
      );

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
        heatScore: Number(rawHeat.toFixed(1)),
        relatedPrerequisiteTitles,
      });
    }
  }

  topicHeatmapRanking.sort((a, b) => b.heatScore - a.heatScore);

  // 5. Cálculo do Score estilo Elasticsearch por Disciplina e Normalização (Soma = Orçamento Semanal)
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
      subjTopics.length > 0
        ? Math.round((startedTopics.length / subjTopics.length) * 100)
        : 0;
    const studiedTopicsMastery =
      startedTopics.length > 0
        ? Math.round(
            startedTopics.reduce((acc, t) => acc + t.topic.mastery_score, 0) /
              startedTopics.length
          )
        : subj.measured_mastery_score;

    const coldStartFactor = (5 - subj.initial_knowledge_level) * 0.35;
    const affinityFactor = (4 - subj.initial_affinity_level) * 0.2;
    const masteryNeed = (100 - studiedTopicsMastery) / 35;
    const unvisitedCoverageBoost = ((100 - coveragePercent) / 100) * 0.45;
    const frictionBoost = subj.behavioral_friction_score * 0.8;

    const elasticScore = Number(
      (
        subj.exam_weight *
        (1.0 +
          coldStartFactor +
          affinityFactor +
          masteryNeed * 0.6 +
          unvisitedCoverageBoost +
          avgTopicHeat * 0.25 +
          frictionBoost)
      ).toFixed(2)
    );

    let dominantReason = `Peso ${subj.exam_weight}x no edital • Cobertura ${coveragePercent}%`;
    if (studiedTopicsMastery < 50) {
      dominantReason = `Prioridade alta no Mapa de Calor (Domínio ${studiedTopicsMastery}% • Cobertura ${coveragePercent}%)`;
    } else if (studiedTopicsMastery >= 80 && coveragePercent >= 80) {
      dominantReason = `Base consolidada (${studiedTopicsMastery}%) — Modo manutenção espaçada`;
    } else if (subj.initial_affinity_level === 1) {
      dominantReason = `Baixa afinidade inicial — Sessões curtas e frequentes`;
    }

    return {
      subject: subj,
      elasticScore,
      coveragePercent,
      studiedTopicsMastery,
      dominantReason,
    };
  });

  const totalElasticScore =
    rawSubjectScores.reduce((acc, item) => acc + item.elasticScore, 0) || 1;

  const totalCurrentCycleMinutes =
    subjects.reduce((acc, s) => acc + s.cycle_allocated_minutes, 0) || 1;

  const allocations: SubjectCycleAllocation[] = rawSubjectScores.map((item) => {
    const shareRatio = item.elasticScore / totalElasticScore;
    const sharePercent = Math.round(shareRatio * 100);
    const recommendedWeeklyMinutes = Math.max(
      30,
      Math.round((shareRatio * totalWeeklyMinutesBudget) / 15) * 15
    );
    const currentWeeklyMinutes = Math.round(
      (item.subject.cycle_allocated_minutes / totalCurrentCycleMinutes) * totalWeeklyMinutesBudget
    );
    const deltaMinutes = recommendedWeeklyMinutes - currentWeeklyMinutes;
    const blocksPerWeek = Math.max(1, Math.round(recommendedWeeklyMinutes / 60));

    return {
      subject: item.subject,
      elasticScore: item.elasticScore,
      sharePercent,
      coveragePercent: item.coveragePercent,
      studiedTopicsMastery: item.studiedTopicsMastery,
      currentWeeklyMinutes,
      recommendedWeeklyMinutes,
      deltaMinutes,
      blocksPerWeek,
      dominantReason: item.dominantReason,
    };
  });

  // 6. Geração de Sugestões Não-Invasivas para o Próximo Ciclo
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
    allocations,
    topicHeatmapRanking,
    suggestions,
  };
}
