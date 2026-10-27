import type { TopicHeatItem } from './cycleEngine';
import { localDateKey } from './timeFormat';
import type {
  QuestionAttempt,
  QuestionLog,
  RecallCheck,
  ReviewConfidence,
  ReviewItem,
  SelfDiagnosisType,
} from '../types/database';

/**
 * Revisão do dia (spec 09 §5.3): poucos tópicos já estudados, intercalados, que o estudante está esquecendo.
 * Regras puras — o banco grava a seleção do dia e as respostas; o progresso é derivado delas.
 */

export const REVIEW_MAX_ITEMS = 5;
/** Do último dia de estudo entram no máximo 2: o resto da revisão é dos que mais esfriaram. */
export const REVIEW_LAST_DAY_MAX = 2;
/** Com 90% ou mais de chance de lembrar o tópico ainda está "quente": revisar agora seria cedo demais (Cepeda). */
export const COOLING_RECALL_BELOW = 0.9;
/** Até onde a revisão olha para trás ao montar as datas de estudo de cada tópico. */
export const REVIEW_LOOKBACK_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface QuestionCandidate {
  questionId: string;
  lastAttemptAt: string | null;
}

/** Nunca respondida primeiro (prova real de que lembrou, sem efeito de reconhecimento); senão a respondida há mais tempo. */
export function chooseReviewQuestion(candidates: QuestionCandidate[]): string | null {
  if (candidates.length === 0) return null;
  const fresh = candidates.find((c) => c.lastAttemptAt === null);
  if (fresh) return fresh.questionId;
  const oldest = [...candidates].sort((a, b) => (a.lastAttemptAt ?? '').localeCompare(b.lastAttemptAt ?? ''))[0];
  return oldest.questionId;
}

/** Sem duas seguidas da mesma matéria quando der: a intercalação é o que faz a revisão treinar a discriminação. */
export function interleaveBySubject(items: ReviewItem[]): ReviewItem[] {
  const remaining = [...items];
  const ordered: ReviewItem[] = [];
  while (remaining.length > 0) {
    const previous = ordered[ordered.length - 1]?.subjectId;
    const index = remaining.findIndex((i) => i.subjectId !== previous);
    ordered.push(remaining.splice(index === -1 ? 0 : index, 1)[0]);
  }
  return ordered;
}

export function selectDailyReview(input: {
  heat: TopicHeatItem[];
  leafTopicIds: Set<string>;
  /** Datas locais (YYYY-MM-DD) em que cada tópico foi estudado nos últimos 30 dias, por qualquer origem. */
  studiedDates: Record<string, string[]>;
  /**
   * As mesmas datas sem o que veio só da própria revisão: elas decidem o "último dia de estudo" (senão um dia só de
   * revisão faria a revisão de amanhã repetir os tópicos revisados hoje). Ausente = `studiedDates`.
   */
  learningDates?: Record<string, string[]>;
  questionCandidates: Record<string, QuestionCandidate[]>;
  now: Date;
}): ReviewItem[] {
  const today = localDateKey(input.now);
  const datesOf = (topicId: string) => input.studiedDates[topicId] ?? [];

  // 1. Elegíveis: tópico folha, já estudado e não estudado hoje
  const eligible = input.heat.filter((h) => {
    if (!input.leafTopicIds.has(h.topic.id)) return false;
    const studied = h.topic.last_studied_at !== null || datesOf(h.topic.id).length > 0;
    if (!studied) return false;
    const studiedToday = datesOf(h.topic.id).includes(today) || (h.topic.last_studied_at !== null && localDateKey(new Date(h.topic.last_studied_at)) === today);
    return !studiedToday;
  });

  // 2. Chance de lembrar R = 2^(−Δt/h); sem data no tópico, Δt vem da última data de estudo conhecida
  const recall = (h: TopicHeatItem) => {
    const days = h.daysSinceLastStudy ?? daysSinceLatest(datesOf(h.topic.id), input.now);
    return Math.pow(2, -days / Math.max(1, h.memoryHalfLifeDays));
  };
  const byColdest = (a: TopicHeatItem, b: TopicHeatItem) =>
    recall(a) - recall(b) || (b.daysSinceLastStudy ?? 0) - (a.daysSinceLastStudy ?? 0);

  // 3. Até 2 do último dia de estudo antes de hoje; o resto, dos que mais esfriaram
  const learningOf = (topicId: string) => (input.learningDates ?? input.studiedDates)[topicId] ?? [];
  const previousDays = eligible.flatMap((h) => learningOf(h.topic.id)).filter((d) => d < today);
  const lastDay = previousDays.length > 0 ? previousDays.reduce((a, b) => (a > b ? a : b)) : null;
  const lastDayPicks = eligible
    .filter((h) => lastDay !== null && learningOf(h.topic.id).includes(lastDay))
    .sort(byColdest)
    .slice(0, REVIEW_LAST_DAY_MAX);
  const picked = new Set(lastDayPicks.map((h) => h.topic.id));
  const coolingPicks = eligible
    .filter((h) => !picked.has(h.topic.id) && recall(h) < COOLING_RECALL_BELOW)
    .sort(byColdest)
    .slice(0, REVIEW_MAX_ITEMS - lastDayPicks.length);

  // 4. Questão do app quando houver; senão a pergunta aberta
  const toItem = (h: TopicHeatItem, reason: ReviewItem['reason']): ReviewItem => {
    const questionId = chooseReviewQuestion(input.questionCandidates[h.topic.id] ?? []);
    return { topicId: h.topic.id, subjectId: h.topic.subject_id, kind: questionId ? 'QUESTION' : 'OPEN', questionId, reason };
  };
  return interleaveBySubject([
    ...lastDayPicks.map((h) => toItem(h, 'LAST_DAY')),
    ...coolingPicks.map((h) => toItem(h, 'COOLING')),
  ]);
}

function daysSinceLatest(dates: string[], now: Date): number {
  if (dates.length === 0) return Number.POSITIVE_INFINITY;
  const latest = dates.reduce((a, b) => (a > b ? a : b));
  const [y, m, d] = latest.split('-').map(Number);
  return Math.max(0, Math.floor((now.getTime() - new Date(y, m - 1, d).getTime()) / DAY_MS));
}

/**
 * O que já foi feito da revisão de hoje, a partir do que foi gravado desde que ela foi sorteada: questão respondida
 * na revisão, autoavaliação da pergunta aberta ou questões registradas de fora do app no tópico.
 */
export function reviewProgress(
  items: ReviewItem[],
  today: { attempts: QuestionAttempt[]; recallChecks: RecallCheck[]; questionLogs: QuestionLog[] },
  sinceIso: string
): { doneTopicIds: Set<string>; nextIndex: number | null } {
  const doneTopicIds = new Set<string>();
  for (const item of items) {
    const byLog = today.questionLogs.some((l) => l.topic_id === item.topicId && l.logged_at >= sinceIso);
    const byAnswer =
      item.kind === 'QUESTION' &&
      today.attempts.some((a) => a.source === 'DAILY_REVIEW' && a.question_id === item.questionId && a.attempted_at >= sinceIso);
    // Vale também para item de questão: se a questão sumiu depois do sorteio, a tela cai na pergunta aberta
    const byRecall = today.recallChecks.some((c) => c.topic_id === item.topicId && c.checked_at >= sinceIso);
    if (byLog || byAnswer || byRecall) doneTopicIds.add(item.topicId);
  }
  const next = items.findIndex((i) => !doneTopicIds.has(i.topicId));
  return { doneTopicIds, nextIndex: next === -1 ? null : next };
}

/** Diagnóstico já marcado depois da correção (spec 09 §5.3.1); o estudante troca num toque. */
export function deriveDiagnosis(confidence: ReviewConfidence, isCorrect: boolean): SelfDiagnosisType {
  if (!isCorrect) return 'BASE_GAP';
  if (confidence === 'SURE') return 'MASTERED';
  if (confidence === 'RECENT') return 'STUDYING';
  // Chute certo não é saber: quase não sobe o domínio e o tópico continua na fila (spec 11 §5.5)
  return confidence === 'GUESS' ? 'LUCKY_GUESS' : 'DOUBT';
}
