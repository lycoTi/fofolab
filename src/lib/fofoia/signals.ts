import type { SelfDiagnosisType } from '../../types/database';

/**
 * Jeitos de ensinar da FofoIA (spec 11 §5.2.1), escolhidos pelos sinais que o app já tem — sem chamada extra à IA.
 * Inspirados nos professores do grupo de estudos do dono (Bill, Jorge, Diana, Dora) e no "chat do edital".
 */
export type FofoMode = 'QUICK' | 'FROM_ZERO' | 'LESSON' | 'SUMMARY' | 'EDITAL' | 'HINT';

/** Selinho mostrado no topo de cada resposta. */
export const MODE_BADGE: Record<FofoMode, string> = {
  QUICK: '🐹💡 Rápida',
  FROM_ZERO: '🐹🌱 Do zero',
  LESSON: '🐹📚 Aula completa',
  SUMMARY: '🐹📝 Resumo',
  EDITAL: '🐹🧭 Cai no meu edital?',
  HINT: '🐹🔎 Pista',
};

/** Abaixo disso o tópico é tratado como "do zero" (linguagem simples, metáfora, pré-requisito). */
export const FROM_ZERO_MASTERY_BELOW = 30;
/** Perguntas seguidas na mesma conversa que sugerem a aula completa. */
export const LESSON_FOLLOW_UPS = 2;

const BASIC_PATTERNS = ['o que e', 'o que significa', 'nao entendi', 'nao sei nada', 'do zero', 'como funciona', 'nunca vi', 'me explica'];

/** Minúsculas e sem acento: "Não entendi" e "nao entendi" contam igual. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function isBasicQuestion(text: string): boolean {
  const normalized = normalizeText(text);
  return BASIC_PATTERNS.some((p) => normalized.includes(p));
}

export interface ModeSignals {
  /** Pedido explícito por botão ("Aula completa", "Salvar resumo", "Cai no meu edital?", "Pedir pista"). */
  requested: FofoMode | null;
  text: string;
  topicMastery: number;
  /** Tópico nunca estudado (sem tentativa, registro de fora nem estudo). */
  firstContact: boolean;
  activeQuestion: { answered: boolean; diagnosis: SelfDiagnosisType | null; falseCertainty: boolean } | null;
  /** Perguntas do estudante já feitas nesta conversa. */
  followUps: number;
}

function needsFromZero(s: ModeSignals): boolean {
  const q = s.activeQuestion;
  return (
    isBasicQuestion(s.text) ||
    s.topicMastery < FROM_ZERO_MASTERY_BELOW ||
    s.firstContact ||
    (q !== null && (q.falseCertainty || q.diagnosis === 'MISCONCEPTION'))
  );
}

/**
 * Precedência: pergunta livre com a questão ativa sem resposta → pista (o gabarito nunca sai antes da tentativa); pedido
 * explícito (a aula do tópico segue, sem gabarito no prompt e com a regra de não revelar a alternativa); sinais de "do
 * zero"; senão a resposta rápida. Pista sem questão aberta não faz sentido e vira resposta rápida.
 */
export function chooseMode(s: ModeSignals): FofoMode {
  const unansweredQuestion = s.activeQuestion !== null && !s.activeQuestion.answered;
  if (unansweredQuestion && (s.requested === null || s.requested === 'HINT')) return 'HINT';
  if (s.requested === 'HINT') return 'QUICK';
  if (s.requested) return s.requested;
  return needsFromZero(s) ? 'FROM_ZERO' : 'QUICK';
}

/** Destaque discreto "Parece que vale a aula completa" — quem decide é sempre o estudante. */
export function shouldSuggestLesson(s: ModeSignals): boolean {
  if (s.requested === 'LESSON' || s.requested === 'SUMMARY' || s.requested === 'EDITAL') return false;
  return needsFromZero(s) || s.followUps >= LESSON_FOLLOW_UPS;
}
