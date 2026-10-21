import type { SubjectCycleAllocation, TopicHeatItem } from './cycleEngine';
import type { QuestionComplexityProfile } from './aiRouter';

export interface MetricExplanation {
  title: string;
  humanSummary: string;
  bulletPoints: string[];
  formulaDetails?: {
    formulaLabel: string;
    variables: { label: string; value: string | number; description: string }[];
  };
}

/**
 * Explicação em linguagem humana (Nível 1) e fórmula detalhada (Nível 2)
 * para a Prioridade e Tempo Alocado de uma disciplina no Ciclo.
 */
export function explainSubjectAllocation(
  allocation: SubjectCycleAllocation,
  weeklyTargetHours: number,
  daysUntilExam: number | null
): MetricExplanation {
  const { subject, sharePercent, recommendedWeeklyMinutes, elasticScore } = allocation;
  const weeklyHours = (recommendedWeeklyMinutes / 60).toFixed(1);

  const humanSummary =
    `Dedicamos ${sharePercent}% do seu ciclo semanal (${weeklyHours}h das suas ${weeklyTargetHours}h disponíveis) ` +
    `para ${subject.name}. Essa recomendação prioriza matérias que valem mais pontos na sua prova ` +
    `e equilibra o seu nível atual de domínio (${allocation.studiedTopicsMastery}% nos tópicos iniciados).`;

  const bulletPoints = [
    `Peso no Edital: ${subject.exam_weight}x (matérias com mais questões recebem prioridade natural).`,
    `Cobertura do Edital: ${allocation.coveragePercent}% dos tópicos verticalizados já foram iniciados.`,
    `Afinidade e Facilidade: Nível ${subject.initial_affinity_level}/3 (matérias com maior atrito comportamental ganham suporte espaçado).`,
    daysUntilExam !== null
      ? `Horizonte de Prova: Faltam ${daysUntilExam} dias para o exame, acelerando revisões de matérias de maior peso.`
      : 'Horizonte de Prova: Modo Pré-Edital / Aberto, priorizando construção sólida de base.',
  ];

  return {
    title: `Por que ${subject.name} recebeu ${weeklyHours}h no seu ciclo?`,
    humanSummary,
    bulletPoints,
    formulaDetails: {
      formulaLabel: 'Score de Relevância = (Peso × 1.8) + (Lacunas × 1.2) + (Tempo sem Revisar) + Ajuste de Afinidade',
      variables: [
        { label: 'Score Calculado', value: elasticScore.toFixed(1), description: 'Pontuação relativa na semana' },
        { label: 'Fatia da Pizza', value: `${sharePercent}%`, description: 'Proporção do tempo semanal total' },
        { label: 'Carga Semanal Sugerida', value: `${weeklyHours}h (${recommendedWeeklyMinutes}m)`, description: 'Distribuído em blocos de estudo' },
      ],
    },
  };
}

/**
 * Explicação da Confiança da Amostra (BM25 Saturation).
 */
export function explainSampleConfidence(
  confidencePercent: number,
  attemptsCount: number,
  subjectTopicCount = 4
): MetricExplanation {
  const isCalibrating = confidencePercent < 55;

  const humanSummary = isCalibrating
    ? `Sua confiança amostral está em ${confidencePercent}% porque você resolveu ${attemptsCount} questão(ões) deste assunto. ` +
      `Nesta fase inicial de calibração, eventuais erros servem apenas para mapear o conteúdo e NÃO derrubam bruscamente sua pontuação.`
    : `Sua confiança amostral está em ${confidencePercent}% (${attemptsCount} questões resolvidas). ` +
      `Essa amostra já é estatisticamente sólida para prever seu desempenho real na banca da prova.`;

  const bulletPoints = [
    `Evidências acumuladas: ${attemptsCount} questão(ões) resolvidas com gabarito oficial.`,
    `Extensão da disciplina: A matéria possui cerca de ${subjectTopicCount} subtópicos, exigindo volume proporcional de questões para saturação.`,
    isCalibrating
      ? 'Status: Fase de Calibração Ativa (Proteção contra desmotivação ao errar no 1º contato).'
      : 'Status: Amostra Confiável (Diagnóstico consistente do seu nível de retenção).',
  ];

  return {
    title: `O que significa ${confidencePercent}% de Confiança da Amostra?`,
    humanSummary,
    bulletPoints,
    formulaDetails: {
      formulaLabel: 'Confiança = Questões / (Questões + k_saturação)',
      variables: [
        { label: 'Questões Feitas (W)', value: attemptsCount, description: 'Número total de tentativas no tópico' },
        { label: 'Constante de Saturação (k)', value: Math.max(8, 6 + subjectTopicCount * 1.5).toFixed(0), description: 'Cresce com a amplitude da matéria' },
        { label: 'Confiança Resultante', value: `${confidencePercent}%`, description: 'Percentual de certeza estatística da sua nota' },
      ],
    },
  };
}

/**
 * Explicação do Mapa de Calor de um Tópico (Urgência de Estudo).
 */
export function explainTopicHeat(item: TopicHeatItem): MetricExplanation {
  const isHighHeat = item.heatScore >= 6.5;
  const humanSummary = isHighHeat
    ? `O tópico "${item.topic.code} ${item.topic.title}" está com alta temperatura (Urgência ${item.heatScore}) ` +
      `porque apresenta lacunas recentes ou tempo sem revisão, combinadas com alta probabilidade de cobrança pela banca.`
    : `O tópico "${item.topic.code} ${item.topic.title}" está em temperatura estável (Urgência ${item.heatScore}), ` +
      `indicando que seu conhecimento está consolidado ou que ele foi revisado recentemente.`;

  const bulletPoints = [
    `Domínio medido: ${item.topic.mastery_score}% de acerto nas questões.`,
    item.daysSinceLastStudy !== null
      ? `Último contato: Há ${item.daysSinceLastStudy} dia(s). Meia-vida estimada de memória: ${item.memoryHalfLifeDays} dias.`
      : 'Último contato: Ainda não iniciado formalmente nesta sessão de estudos.',
    item.baseGapCount > 0
      ? `Lacunas de base detectadas: ${item.baseGapCount} questão(ões) marcadas como 1º Contato/Lacuna.`
      : 'Nenhuma lacuna crítica aberta recentemente.',
    item.relatedPrerequisiteTitles.length > 0
      ? `Pré-requisitos conectados: Este tópico serve de alicerce para: ${item.relatedPrerequisiteTitles.join(', ')}.`
      : 'Conceito direto e autocontido no edital.',
  ];

  return {
    title: `Por que este tópico tem Urgência ${item.heatScore} no Mapa de Calor?`,
    humanSummary,
    bulletPoints,
    formulaDetails: {
      formulaLabel: 'Urgência = (100 - Domínio) × 0.4 + (Lacunas × 1.5) + Risco_Esquecimento(HLR) + Conexões',
      variables: [
        { label: 'Pontuação de Urgência', value: item.heatScore, description: 'De 0 a 10 (quanto maior, mais indicado para hoje)' },
        { label: 'Meia-Vida da Memória', value: `${item.memoryHalfLifeDays} dias`, description: 'Estimativa científica de esquecimento (Duolingo HLR)' },
      ],
    },
  };
}

/**
 * Explicação do Perfil de Complexidade da Questão.
 */
export function explainQuestionComplexity(
  profile: QuestionComplexityProfile,
  examBoard: string
): MetricExplanation {
  const humanSummary =
    `Esta questão foi classificada com ${profile.stars}/5 estrelas (${profile.levelLabel}). ` +
    `Avaliamos o tamanho do enunciado, a densidade de termos jurídicos/técnicos e o estilo tradicional da banca ${examBoard}.`;

  const bulletPoints = [
    `Carga Linguística: ${profile.linguisticLoad} (enunciados longos demandam maior foco na leitura da pergunta final).`,
    `Conceitos Cruzados: Exige domínio de ${profile.topicCount} conceito(s) deste tópico do edital.`,
    `Dica da Banca: ${profile.summaryTip}`,
  ];

  return {
    title: `Como calculamos ${profile.stars} estrelas para esta questão?`,
    humanSummary,
    bulletPoints,
  };
}

