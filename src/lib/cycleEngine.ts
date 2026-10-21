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
  isReverseStudyDiscovery: boolean; // True quando <= 3 questões (1º contato no Estudo Reverso)
  heatScore: number;                // Pontuação estilo Elasticsearch (_score de urgência 0..10)
  relatedPrerequisiteTitles: string[];
}

export interface SubjectCycleAllocation {
  subject: Subject;
  elasticScore: number;             // _score bruto calculado estilo Elasticsearch
  sharePercent: number;             // % da pizza no ciclo (soma = 100%)
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
 * Nunca estoura o limite de horas semanais do estudante!
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
    ? `Você está com ${subjects.length} disciplinas simultâneas para ${plan.weekly_hours_target}h/semana (~${Math.round(avgMinutesPerSubject / 60 * 10) / 10}h por matéria). Considere focar em 4 a 5 matérias principais neste ciclo para não pulverizar sua retenção.`
    : null;

  // Mapa rápido de todos os tópicos para cruzar pré-requisitos (topic_links)
  const allTopicsMap = new Map<string, Topic>();
  for (const subj of subjects) {
    for (const t of topicsBySubject[subj.id] || []) {
      allTopicsMap.set(t.id, t);
    }
  }

  // 3. Construção do Mapa de Calor de Tópicos (Heatmap Ranking)
  const topicHeatmapRanking: TopicHeatItem[] = [];
  const prerequisiteBoostByTopic = new Map<string, number>();

  // Primeiro passo: contabilizar tentativas por tópico e propagar calor para pré-requisitos
  for (const subj of subjects) {
    const subjTopics = topicsBySubject[subj.id] || [];
    for (const topic of subjTopics) {
      const topicAttempts = attempts.filter((a) => a.topic_id === topic.id);
      const baseGapCount = topicAttempts.filter((a) => a.self_diagnosis === 'BASE_GAP').length;

      if (baseGapCount > 0 || topic.mastery_score < 50) {
        // Se este tópico tem lacuna de base, propaga um boost para os seus tópicos pré-requisitos!
        const incomingPrereqs = topicLinks.filter((l) => l.target_topic_id === topic.id);
        for (const link of incomingPrereqs) {
          const prev = prerequisiteBoostByTopic.get(link.source_topic_id) || 0;
          prerequisiteBoostByTopic.set(link.source_topic_id, prev + 1.2);
        }
      }
    }
  }

  // Segundo passo: calcular o heatScore de cada tópico
  for (const subj of subjects) {
    const subjTopics = topicsBySubject[subj.id] || [];
    for (const topic of subjTopics) {
      const topicAttempts = attempts.filter((a) => a.topic_id === topic.id);
      const attemptsCount = topicAttempts.length;
      const baseGapCount = topicAttempts.filter((a) => a.self_diagnosis === 'BASE_GAP').length;
      const doubtCount = topicAttempts.filter((a) => a.self_diagnosis === 'DOUBT').length;
      const boardTrapCount = topicAttempts.filter((a) => a.self_diagnosis === 'BOARD_TRAP').length;
      const masteredCount = topicAttempts.filter((a) => a.self_diagnosis === 'MASTERED').length;

      // No Estudo Reverso, até 3 questões resolvidas no tópico é fase de Mapeamento/Descoberta!
      const isReverseStudyDiscovery = attemptsCount <= 3 && topic.status !== 'MASTERED';

      // Score de Calor estilo Elasticsearch (BM25-like saturation):
      const masteryDeficit = (100 - topic.mastery_score) / 25; // 0.0 a 4.0
      const diagnosisSignal =
        baseGapCount * 1.35 +
        doubtCount * 0.55 +
        boardTrapCount * 0.25 -
        masteredCount * 0.4;

      const prereqBoost = prerequisiteBoostByTopic.get(topic.id) || 0;
      const rawHeat = Math.max(
        0.5,
        Math.min(10, (masteryDeficit + Math.max(0, diagnosisSignal) + prereqBoost) * (0.7 + subj.exam_weight * 0.2))
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
        isReverseStudyDiscovery,
        heatScore: Number(rawHeat.toFixed(1)),
        relatedPrerequisiteTitles,
      });
    }
  }

  topicHeatmapRanking.sort((a, b) => b.heatScore - a.heatScore);

  // 4. Cálculo do Score estilo Elasticsearch por Disciplina e Normalização (Soma = Orçamento Semanal)
  const rawSubjectScores = subjects.map((subj) => {
    const subjTopics = topicHeatmapRanking.filter((t) => t.topic.subject_id === subj.id);
    const avgTopicHeat =
      subjTopics.length > 0
        ? subjTopics.reduce((acc, item) => acc + item.heatScore, 0) / subjTopics.length
        : 4.0;

    // Fator de partida a frio (Nível inicial 1..4 -> quanto menor a base, maior o impulso inicial)
    const coldStartFactor = (5 - subj.initial_knowledge_level) * 0.35;
    // Fator de afinidade (Afinidade 1..3 -> matérias com maior resistência recebem blocos mais bem distribuídos)
    const affinityFactor = (4 - subj.initial_affinity_level) * 0.2;
    // Fator de domínio medido (quanto menor o domínio, maior a necessidade)
    const masteryNeed = (100 - subj.measured_mastery_score) / 35;
    // Fricção comportamental (pausas/pulos no Pomodoro)
    const frictionBoost = subj.behavioral_friction_score * 0.8;

    const elasticScore = Number(
      (
        subj.exam_weight *
        (1.0 + coldStartFactor + affinityFactor + masteryNeed * 0.6 + avgTopicHeat * 0.25 + frictionBoost)
      ).toFixed(2)
    );

    let dominantReason = `Peso ${subj.exam_weight}x no edital`;
    if (subj.measured_mastery_score < 50) {
      dominantReason = `Prioridade alta no Mapa de Calor (Domínio ${subj.measured_mastery_score}%)`;
    } else if (subj.measured_mastery_score >= 80) {
      dominantReason = `Base consolidada (${subj.measured_mastery_score}%) — Modo manutenção/revisão`;
    } else if (subj.initial_affinity_level === 1) {
      dominantReason = `Alta fricção / baixa afinidade — Sessões curtas mais frequentes`;
    }

    return {
      subject: subj,
      elasticScore,
      dominantReason,
    };
  });

  const totalElasticScore =
    rawSubjectScores.reduce((acc, item) => acc + item.elasticScore, 0) || 1;

  // Normaliza as fatias atuais da semana para que possamos comparar com o recomendado na mesma base semanal
  const totalCurrentCycleMinutes =
    subjects.reduce((acc, s) => acc + s.cycle_allocated_minutes, 0) || 1;

  const allocations: SubjectCycleAllocation[] = rawSubjectScores.map((item) => {
    const shareRatio = item.elasticScore / totalElasticScore;
    const sharePercent = Math.round(shareRatio * 100);
    // Arredonda para múltiplos de 15 min
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
      currentWeeklyMinutes,
      recommendedWeeklyMinutes,
      deltaMinutes,
      blocksPerWeek,
      dominantReason: item.dominantReason,
    };
  });

  // 5. Geração de Sugestões Não-Invasivas para o Próximo Ciclo
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
      description: `O Mapa de Calor aponta maior urgência em "${needMoreTime.subject.name}" (Score ${needMoreTime.elasticScore}) enquanto "${canDonateTime.subject.name}" já está com ${canDonateTime.subject.measured_mastery_score}% de domínio. Você pode transferir ~${Math.abs(needMoreTime.deltaMinutes)} min/sem entre elas no próximo ciclo sem aumentar 1 minuto na sua rotina de ${plan.weekly_hours_target}h/semana!`,
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
      title: `🔗 Conexão Detectada no Grafo: ${hotTopicWithPrereq.topic.code} ${hotTopicWithPrereq.topic.title}`,
      description: `Este tópico está quente no Mapa de Calor (${hotTopicWithPrereq.heatScore}/10) e possui vínculo direto com: ${hotTopicWithPrereq.relatedPrerequisiteTitles.join(', ')}. Revisar o pré-requisito destrava os acertos aqui!`,
    });
  }

  suggestions.push({
    id: 'sug-reverse-study',
    type: 'REVERSE_STUDY_INFO',
    title: '🛡️ Estudo Reverso (Mapeamento sem Pressão)',
    description:
      'Errar questões no primeiro contato com um tópico nunca aumenta suas horas semanais: os diagnósticos apenas priorizam os assuntos que você mais precisa revisar no próximo ciclo.',
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

