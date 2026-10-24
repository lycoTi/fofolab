import type { Topic } from '../../types/database';
import { normalizeText } from './signals';

/**
 * "Cai no meu edital?" (spec 11 §5.2.1): antes de chamar a IA, o app filtra localmente os tópicos do plano pelas palavras
 * em comum com o que o estudante descreveu e manda só esses candidatos — nunca o edital inteiro (limite de uso).
 */
export interface EditalTopicEntry {
  topic: Topic;
  subjectName: string;
  examPartCode: string | null;
  weight: number;
}

export interface EditalCandidate extends EditalTopicEntry {
  score: number;
}

export const EDITAL_MAX_CANDIDATES = 20;

const STOPWORDS = new Set([
  'sobre', 'entre', 'para', 'como', 'qual', 'quais', 'isso', 'esse', 'essa', 'este', 'esta', 'cair', 'cai', 'edital',
  'estudar', 'preciso', 'questao', 'questoes', 'materia', 'assunto', 'tema', 'prova', 'dentro', 'parte', 'mais', 'muito',
]);

/** Palavras com 4+ letras, sem acento, fora da lista de palavras vazias; corta no 6º caractere para casar plural. */
function keywords(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
      .map((w) => w.slice(0, 6))
  );
}

export function matchEditalTopics(text: string, entries: EditalTopicEntry[]): EditalCandidate[] {
  const query = keywords(text);
  if (query.size === 0) return [];
  return entries
    .map((entry) => {
      const words = keywords(`${entry.topic.code ?? ''} ${entry.topic.title} ${entry.subjectName}`);
      const score = [...query].filter((w) => words.has(w)).length;
      return { ...entry, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || b.weight - a.weight)
    .slice(0, EDITAL_MAX_CANDIDATES);
}
