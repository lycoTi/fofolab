import { normalizeText } from './signals';

export type OffTopicCategory =
  | 'CULINARY'
  | 'BETTING_GAMBLING'
  | 'ESOTERIC'
  | 'ENTERTAINMENT_SPORTS'
  | 'HEALTH_PRESCRIPTION';

export interface OffTopicOptions {
  currentTopicTitle?: string;
  currentTopicCode?: string | null;
  editalTopics?: { code?: string | null; title: string }[];
}

export interface OffTopicResult {
  isOffTopic: boolean;
  category?: OffTopicCategory;
  reply?: string;
}

interface PatternRule {
  category: OffTopicCategory;
  phrases: string[];
  exemptIfTopicIncludes?: string[];
}

const OFF_TOPIC_RULES: PatternRule[] = [
  {
    category: 'CULINARY',
    phrases: [
      'receita de',
      'como fazer bolo',
      'bolo de',
      'modo de preparo',
      'ingredientes para',
      'strogonoff',
      'como cozinhar',
      'cozinhar feijao',
      'temperar carne',
      'panela de pressao',
      'torta de limao',
      'pudim de leite',
      'lasanha',
    ],
    exemptIfTopicIncludes: ['receita', 'orcamento', 'financeiro', 'tributario', 'nutricao', 'alimentacao'],
  },
  {
    category: 'BETTING_GAMBLING',
    phrases: [
      'jogo do bicho',
      'jogo do tigrinho',
      'tigrinho',
      'aposta esportiva',
      'dica de aposta',
      'palpite de aposta',
      'ganhar dinheiro facil',
      'ficar rico rapido',
      'robo do pix',
      'roleta de cassino',
      'bet365',
      'betano',
    ],
    exemptIfTopicIncludes: ['jogos', 'probabilidade', 'estatistica'],
  },
  {
    category: 'ESOTERIC',
    phrases: [
      'horoscopo',
      'mapa astral',
      'signo de',
      'tarot',
      'cartomante',
      'simpatia para',
      'previsao dos signos',
      'astrologia',
    ],
  },
  {
    category: 'ENTERTAINMENT_SPORTS',
    phrases: [
      'quem ganhou o jogo',
      'placar do jogo',
      'resultado do flamengo',
      'resultado do corinthians',
      'resultado do palmeiras',
      'escalacao do',
      'eliminado do bbb',
      'fofoca de celebridades',
      'fofoca dos famosos',
    ],
    exemptIfTopicIncludes: ['educacao fisica', 'esporte'],
  },
  {
    category: 'HEALTH_PRESCRIPTION',
    phrases: [
      'qual remedio tomar',
      'remedio para dor',
      'sem receita medica',
      'remedio caseiro',
      'prescricao medica',
      'posologia de',
      'dosagem de dipirona',
      'como curar infeccao com',
    ],
    exemptIfTopicIncludes: ['farmacologia', 'medicina', 'saude publica', 'enfermagem', 'toxicologia'],
  },
];

/**
 * Cria a resposta acolhedora da FofoIA redirecionando o estudante para o edital.
 * Respeita a regra Anti-IA de não usar emojis decorativos em callouts/UI.
 */
export function formatOffTopicReply(category: OffTopicCategory, currentTopicTitle?: string): string {
  const topicLabel = currentTopicTitle ? `**${currentTopicTitle}**` : 'o tópico do seu edital';

  const categoryContext: Record<OffTopicCategory, string> = {
    CULINARY: 'receitas culinárias ou preparo de pratos',
    BETTING_GAMBLING: 'apostas ou promessas de dinheiro rápido',
    ESOTERIC: 'horóscopo, previsões ou simpatias',
    ENTERTAINMENT_SPORTS: 'resultados esportivos ou fofocas',
    HEALTH_PRESCRIPTION: 'prescrições médicas ou diagnósticos de saúde',
  };

  const contextStr = categoryContext[category] ?? 'assuntos fora do concurso';

  return `Ei! Como seu tutor focado no edital, meu compromisso é com a sua aprovação: meu combustível são matérias da prova, questões e revisões, não ${contextStr}.

Vamos manter o foco e os tokens no que realmente cai no seu concurso?

Podemos continuar estudando ${topicLabel} ou tirar qualquer dúvida sobre o conteúdo da prova.`;
}

/**
 * Verifica se a mensagem é um desvio temático flagrante e gera a resposta imediata
 * a custo zero de tokens.
 */
export function checkOffTopic(message: string, opts: OffTopicOptions = {}): OffTopicResult {
  const normalized = normalizeText(message);
  const topicTitleNorm = normalizeText(opts.currentTopicTitle ?? '');

  // 1. Se a mensagem bate em termos específicos do tópico ativo, não é desvio
  if (topicTitleNorm.length > 3 && normalized.includes(topicTitleNorm)) {
    return { isOffTopic: false };
  }

  // 2. Avalia cada regra de categoria
  for (const rule of OFF_TOPIC_RULES) {
    // Se o tópico ativo contém termos de isenção, pula a regra
    if (rule.exemptIfTopicIncludes?.some((term) => topicTitleNorm.includes(term))) {
      continue;
    }

    const matched = rule.phrases.some((phrase) => normalized.includes(phrase));
    if (matched) {
      return {
        isOffTopic: true,
        category: rule.category,
        reply: formatOffTopicReply(rule.category, opts.currentTopicTitle),
      };
    }
  }

  return { isOffTopic: false };
}

export function isOffTopicQuery(message: string, opts: OffTopicOptions = {}): boolean {
  return checkOffTopic(message, opts).isOffTopic;
}
