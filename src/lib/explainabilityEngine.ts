import {
  sampleSaturationK,
  STRATEGY_LABELS,
  SUBJECT_SCORE_WEIGHTS as W,
  TOPIC_HEAT_WEIGHTS as H,
  type SubjectCycleAllocation,
  type TopicHeatItem,
} from './cycleEngine';
import type { QuestionComplexityProfile } from './aiRouter';
import type { StudyStrategy } from '../types/database';

/**
 * Explicabilidade sob demanda (docs/specs/05): Nível 1 em linguagem do dia a dia, Nível 2 com a
 * conta. Os números do Nível 2 vêm do detalhamento calculado pelo próprio motor
 * (`scoreBreakdown` / `heatBreakdown`), então a fórmula exibida é a que o código executa.
 */
export interface MetricExplanation {
  title: string;
  humanSummary: string;
  bulletPoints: string[];
  formulaDetails?: {
    formulaLabel: string;
    variables: { label: string; value: string | number; description: string }[];
  };
}

/** Número em formato brasileiro com casas fixas (0.35 → "0,35"). */
export function formatDecimal(value: number, digits = 2): string {
  return value.toFixed(digits).replace('.', ',');
}

function describeStrategy(strategy: StudyStrategy | null | undefined): string {
  return strategy ? STRATEGY_LABELS[strategy] : 'Neutra (ainda não escolhida no assistente)';
}

export function explainSubjectAllocation(
  allocation: SubjectCycleAllocation,
  weeklyTargetHours: number,
  daysUntilExam: number | null,
  strategy: StudyStrategy | null = null
): MetricExplanation {
  const { subject, sharePercent, recommendedWeeklyMinutes, elasticScore, scoreBreakdown: b } = allocation;
  const weeklyHours = (recommendedWeeklyMinutes / 60).toFixed(1);

  const humanSummary =
    `Dedicamos ${sharePercent}% do seu ciclo semanal (${weeklyHours}h das suas ${weeklyTargetHours}h disponíveis) ` +
    `para ${subject.name}. Essa recomendação prioriza matérias que valem mais pontos na sua prova ` +
    `e equilibra o seu nível atual de domínio (${allocation.studiedTopicsMastery}% nos tópicos iniciados).`;

  const bulletPoints = [
    `Peso no Edital: ${subject.exam_weight}x (matérias com mais questões recebem prioridade natural).`,
    `Cobertura do Edital: ${allocation.coveragePercent}% dos tópicos verticalizados já foram iniciados.`,
    `Afinidade: ${subject.initial_affinity_level}/3 (matérias de menor afinidade recebem um pouco mais de prioridade e sessões espaçadas).`,
    daysUntilExam !== null
      ? `Horizonte de Prova: faltam ${daysUntilExam} dias (as revisões são espaçadas em função desse prazo).`
      : 'Horizonte de Prova: sem data definida, priorizando construção sólida de base.',
    `Estratégia: ${describeStrategy(strategy)}.`,
  ];

  return {
    title: `Por que ${subject.name} recebeu ${weeklyHours}h no seu ciclo?`,
    humanSummary,
    bulletPoints,
    formulaDetails: {
      formulaLabel:
        'Prioridade = Peso × (1 + Base inicial + Afinidade + Necessidade de domínio + Edital não iniciado + Calor médio + Atrito) × Estratégia',
      variables: [
        { label: 'Peso no edital', value: formatDecimal(b.examWeight, 1), description: 'Multiplica todos os termos' },
        {
          label: 'Base inicial',
          value: formatDecimal(b.coldStart),
          description: `(5 − nível ${subject.initial_knowledge_level}) × ${formatDecimal(W.coldStartPerLevel)}`,
        },
        {
          label: 'Afinidade',
          value: formatDecimal(b.affinity),
          description: `(4 − afinidade ${subject.initial_affinity_level}) × ${formatDecimal(W.affinityPerLevel, 1)}`,
        },
        {
          label: 'Necessidade de domínio',
          value: formatDecimal(b.masteryNeed),
          description: `(100 − ${allocation.studiedTopicsMastery}%) ÷ ${W.masteryNeedDivisor} × ${formatDecimal(W.masteryNeedFactor, 1)}`,
        },
        {
          label: 'Edital não iniciado',
          value: formatDecimal(b.unvisitedCoverage),
          description: `(100% − ${allocation.coveragePercent}%) × ${formatDecimal(W.unvisitedCoverage)}`,
        },
        {
          label: 'Calor médio dos tópicos',
          value: formatDecimal(b.topicHeat),
          description: `calor médio × ${formatDecimal(W.topicHeat)}`,
        },
        {
          label: 'Atrito (pausas e pulos)',
          value: formatDecimal(b.friction),
          description: `atrito ${formatDecimal(subject.behavioral_friction_score)} × ${formatDecimal(W.friction, 1)}`,
        },
        {
          label: 'Estratégia',
          value: `× ${formatDecimal(b.strategyMultiplier)}`,
          description: describeStrategy(strategy),
        },
        {
          label: 'Prioridade final',
          value: formatDecimal(elasticScore),
          description: 'Resultado da conta acima',
        },
        {
          label: 'Fatia da semana',
          value: `${sharePercent}% (${recommendedWeeklyMinutes} min)`,
          description: 'Esta prioridade ÷ soma das prioridades de todas as matérias',
        },
      ],
    },
  };
}

export function explainSampleConfidence(
  confidencePercent: number,
  attemptsCount: number,
  subjectTopicCount = 4
): MetricExplanation {
  const isCalibrating = confidencePercent < 55;
  const k = sampleSaturationK(subjectTopicCount);

  const humanSummary = isCalibrating
    ? `Sua confiança amostral está em ${confidencePercent}% porque você resolveu ${attemptsCount} questão(ões) deste assunto. ` +
      'Nesta fase inicial de calibração, eventuais erros servem para mapear o conteúdo e NÃO derrubam bruscamente sua pontuação.'
    : `Sua confiança amostral está em ${confidencePercent}% (${attemptsCount} questões resolvidas). ` +
      'Com essa quantidade de questões, o domínio estimado já é um retrato razoável do seu nível neste assunto.';

  return {
    title: `O que significa ${confidencePercent}% de Confiança da Amostra?`,
    humanSummary,
    bulletPoints: [
      `Questões resolvidas neste tópico: ${attemptsCount}.`,
      `Extensão da disciplina: cerca de ${subjectTopicCount} tópicos — matérias maiores exigem mais questões para a mesma confiança.`,
      isCalibrating
        ? 'Status: fase de calibração (proteção contra desmotivação ao errar no 1º contato).'
        : 'Status: amostra razoável (o domínio estimado já reflete bem o seu desempenho).',
    ],
    formulaDetails: {
      formulaLabel: 'Confiança = Questões ÷ (Questões + k)',
      variables: [
        { label: 'Questões feitas', value: attemptsCount, description: 'Tentativas registradas no tópico' },
        {
          label: 'k (saturação)',
          value: formatDecimal(k, 1),
          description: `máx(8; 6 + ${subjectTopicCount} tópicos × 1,5)`,
        },
        { label: 'Confiança resultante', value: `${confidencePercent}%`, description: 'Quanto a amostra de questões já pesa na estimativa' },
      ],
    },
  };
}

export function explainTopicHeat(item: TopicHeatItem): MetricExplanation {
  const b = item.heatBreakdown;
  const isHighHeat = item.heatScore >= 6.5;
  const humanSummary = isHighHeat
    ? `O tópico "${item.topic.code} ${item.topic.title}" está com alta temperatura (Urgência ${item.heatScore}) ` +
      'porque combina pouco domínio, lacunas nas questões ou tempo sem revisão, numa matéria de peso na prova.'
    : `O tópico "${item.topic.code} ${item.topic.title}" está em temperatura estável (Urgência ${item.heatScore}), ` +
      'indicando que seu conhecimento está consolidado ou que ele foi revisado recentemente.';

  const bulletPoints = [
    `Domínio estimado: ${item.topic.mastery_score}% (sobe com "Dominei"/"Acertei na dúvida" e desce com "Lacuna").`,
    item.daysSinceLastStudy !== null
      ? `Último contato: há ${item.daysSinceLastStudy} dia(s). Meia-vida estimada da memória: ${item.memoryHalfLifeDays} dias.`
      : 'Último contato: ainda não estudado.',
    item.baseGapCount > 0
      ? `Lacunas de base: ${item.baseGapCount} questão(ões) marcadas como 1º Contato/Lacuna.`
      : 'Nenhuma lacuna de base registrada.',
    item.relatedPrerequisiteTitles.length > 0
      ? `Conectado a: ${item.relatedPrerequisiteTitles.join(', ')}.`
      : 'Conceito direto e autocontido no edital.',
  ];

  return {
    title: `Por que este tópico tem Urgência ${item.heatScore} no Mapa de Calor?`,
    humanSummary,
    bulletPoints,
    formulaDetails: {
      formulaLabel:
        'Urgência = (Déficit de domínio + Sinais das questões + Pré-requisitos + Esquecimento) × Peso da matéria — limitada entre 0,5 e 10',
      variables: [
        {
          label: 'Déficit de domínio',
          value: formatDecimal(b.masteryDeficit),
          description: `(100 − ${item.topic.mastery_score}%) ÷ ${H.masteryDeficitDivisor}`,
        },
        {
          label: 'Sinais das questões',
          value: formatDecimal(b.diagnosisSignal),
          description: `lacunas × ${formatDecimal(H.baseGap)} + dúvidas × ${formatDecimal(H.doubt)} + pegadinhas × ${formatDecimal(H.boardTrap)} − domínios × ${formatDecimal(H.mastered, 1)} (mínimo 0)`,
        },
        {
          label: 'Pré-requisitos',
          value: formatDecimal(b.prerequisiteBoost),
          description: `${formatDecimal(H.prerequisitePerLink, 1)} por tópico dependente com dificuldade`,
        },
        {
          label: 'Esquecimento',
          value: formatDecimal(b.forgettingBoost),
          description: `(1 − 2^(−dias ÷ ${item.memoryHalfLifeDays})) × ${formatDecimal(H.forgettingScale, 1)} — curva inspirada no modelo de revisão do Duolingo (regra fixa, não treinada)`,
        },
        {
          label: 'Peso da matéria',
          value: `× ${formatDecimal(b.examWeightMultiplier)}`,
          description: `${formatDecimal(H.examWeightBase, 1)} + peso × ${formatDecimal(H.examWeightFactor, 1)}`,
        },
        { label: 'Urgência final', value: item.heatScore, description: 'De 0,5 a 10 (quanto maior, mais indicado para hoje)' },
      ],
    },
  };
}

export function explainQuestionComplexity(
  profile: QuestionComplexityProfile,
  examBoard: string
): MetricExplanation {
  const humanSummary =
    `Esta questão foi classificada com ${profile.stars}/5 estrelas (${profile.levelLabel}). ` +
    `Contamos o tamanho do enunciado, quantos conceitos ela cruza e o estilo da banca ${examBoard} (estudos de caso longos).`;

  const bulletPoints = [
    `Carga de leitura: ${profile.linguisticLoad} (enunciados longos pedem foco no comando final da questão).`,
    `Conceitos cruzados: ${profile.topicCount} conceito(s) identificado(s) na explicação.`,
    `Dica: ${profile.summaryTip}`,
  ];

  return {
    title: `Como calculamos ${profile.stars} estrelas para esta questão?`,
    humanSummary,
    bulletPoints,
    formulaDetails: {
      formulaLabel: 'Estrelas = 2 + (enunciado > 250 caracteres) + (cruza 2+ conceitos) + (FGV com enunciado > 200 caracteres)',
      variables: [
        {
          label: 'Tamanho do enunciado',
          value: profile.statementLength !== undefined ? `${profile.statementLength} caracteres` : '—',
          description: 'Carga de leitura',
        },
        { label: 'Conceitos cruzados', value: profile.topicCount, description: 'Pré-requisitos listados na explicação' },
        { label: 'Estrelas', value: profile.stars, description: 'De 1 a 5' },
      ],
    },
  };
}
