import { useEffect, useMemo, useState } from 'react';
import {
  flushDatabase,
  getDailyReview,
  getNotebookForTopic,
  getQuestionWithDissection,
  getReviewQuestionCandidates,
  getStudySessionsSince,
  recordQuestionDiagnosis,
  recordRecallCheck,
  recordStudySession,
  saveDailyReview,
  skipDailyReview,
} from '../../lib/database';
import type { TopicHeatItem } from '../../lib/cycleEngine';
import { REVIEW_LOOKBACK_DAYS, reviewProgress, selectDailyReview } from '../../lib/dailyReview';
import { localDateKey } from '../../lib/timeFormat';
import type {
  AiDissection,
  Question,
  QuestionAttempt,
  QuestionLog,
  RecallCheck,
  RecallRating,
  ReviewItem,
  StudyPlan,
  Subject,
  Topic,
} from '../../types/database';
import type { ReviewQuestionResult } from './ReviewQuestion';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Trecho do caderno mostrado depois de tentar lembrar: o começo das anotações basta para conferir. */
const NOTEBOOK_EXCERPT_CHARS = 900;

export interface CurrentReview {
  item: ReviewItem;
  topicLabel: string;
  subjectName: string;
  /** Nulo na pergunta aberta (ou se a questão sorteada não existe mais). */
  question: { question: Question; dissection: AiDissection | null } | null;
  notebookExcerpt: string | null;
}

function topicLabel(topic: Topic): string {
  return topic.code ? `${topic.code} ${topic.title}` : topic.title;
}

/** Tempo da revisão na meta da semana: pelo menos 1 minuto por item feito. */
function reviewMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Revisão do dia (spec 09 §5.3): sorteada e congelada na primeira abertura do dia (por plano); o progresso vem do que
 * foi gravado desde então. A data é recalculada a cada render: virar a meia-noite com o app aberto sorteia a do dia novo.
 */
export function useDailyReview(params: {
  dbReady: boolean;
  plan: StudyPlan | null;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  heat: TopicHeatItem[];
  attempts: QuestionAttempt[];
  questionLogs: QuestionLog[];
  recallChecks: RecallCheck[];
  dataVersion: number;
  /** Depois de gravar: o App recarrega domínio, calor e semana. */
  onRecorded: () => void;
  now?: () => Date;
}) {
  const { dbReady, plan, subjects, topicsBySubject, heat, attempts, questionLogs, recallChecks, dataVersion, onRecorded } = params;
  const now = params.now ?? (() => new Date());
  const dateKey = localDateKey(now());
  const enabled = plan !== null && plan.daily_review_enabled !== 0;
  const [version, setVersion] = useState(0);

  const saved = useMemo(() => {
    if (!dbReady || !plan) return null;
    // dataVersion e version não aparecem no corpo: estão aqui para reler depois de gravar ou restaurar backup
    void dataVersion;
    void version;
    return getDailyReview(plan.id, dateKey);
  }, [dbReady, plan, dateKey, dataVersion, version]);

  // 1. Primeira abertura do dia com a revisão ligada: sorteia e congela
  useEffect(() => {
    if (!dbReady || !plan || !enabled || saved || heat.length === 0) return;
    const allTopics = Object.values(topicsBySubject).flat();
    const parents = new Set(allTopics.map((t) => t.parent_id).filter((id): id is string => id !== null));
    const leafTopicIds = new Set(allTopics.filter((t) => !parents.has(t.id)).map((t) => t.id));
    const items = selectDailyReview({
      heat,
      leafTopicIds,
      studiedDates: studiedDatesByTopic({ topics: allTopics, attempts, questionLogs, recallChecks, now: now() }),
      questionCandidates: getReviewQuestionCandidates([...leafTopicIds]),
      now: now(),
    });
    saveDailyReview(plan.id, dateKey, items);
    setVersion((v) => v + 1);
    // now() fica fora das dependências (muda a cada chamada): o que importa é o dia, `dateKey`
  }, [dbReady, plan, enabled, saved, heat, topicsBySubject, attempts, questionLogs, recallChecks, dateKey]);

  const items = useMemo(() => saved?.items ?? [], [saved]);
  const progress = useMemo(
    () => reviewProgress(items, { attempts, recallChecks, questionLogs }, saved?.createdAt ?? ''),
    [items, attempts, recallChecks, questionLogs, saved]
  );
  const currentItem = progress.nextIndex === null ? null : items[progress.nextIndex];

  // 2. O item da vez com o que a tela precisa (questão ou trecho do caderno)
  const current = useMemo<CurrentReview | null>(() => {
    if (!currentItem) return null;
    void dataVersion;
    const topic = (topicsBySubject[currentItem.subjectId] ?? []).find((t) => t.id === currentItem.topicId);
    if (!topic) return null;
    const question = currentItem.kind === 'QUESTION' && currentItem.questionId ? getQuestionWithDissection(currentItem.questionId) : null;
    const notes = getNotebookForTopic(currentItem.topicId)?.content_markdown.trim() ?? '';
    return {
      item: currentItem,
      topicLabel: topicLabel(topic),
      subjectName: subjects.find((s) => s.id === currentItem.subjectId)?.name ?? '',
      question,
      notebookExcerpt: notes ? notes.slice(0, NOTEBOOK_EXCERPT_CHARS) : null,
    };
  }, [currentItem, topicsBySubject, subjects, dataVersion]);

  const afterRecord = (item: ReviewItem, seconds: number) => {
    recordStudySession({ subjectId: item.subjectId, topicId: item.topicId, durationMinutes: reviewMinutes(seconds), sessionType: 'REVIEW', pausesCount: 0, wasSkipped: false });
    // Gravação imediata: fechar o app logo depois de responder não pode perder a revisão
    void flushDatabase();
    setVersion((v) => v + 1);
    onRecorded();
  };

  const answerQuestion = (result: ReviewQuestionResult) => {
    if (!current?.question) return;
    recordQuestionDiagnosis({
      questionId: current.question.question.id,
      topicId: current.item.topicId,
      selectedOption: result.selectedOption,
      isCorrect: result.isCorrect,
      selfDiagnosis: result.diagnosis,
      timeSpentSeconds: result.timeSpentSeconds,
      confidence: result.confidence,
      source: 'DAILY_REVIEW',
    });
    afterRecord(current.item, result.timeSpentSeconds);
  };

  const rateRecall = (rating: RecallRating, secondsSpent: number) => {
    if (!current) return;
    recordRecallCheck({ subjectId: current.item.subjectId, topicId: current.item.topicId, rating });
    afterRecord(current.item, secondsSpent);
  };

  const skip = () => {
    if (!plan) return;
    skipDailyReview(plan.id, dateKey);
    setVersion((v) => v + 1);
  };

  return {
    enabled,
    items,
    doneCount: progress.doneTopicIds.size,
    skipped: saved?.skipped ?? false,
    current,
    answerQuestion,
    rateRecall,
    skip,
  };
}

/** Datas locais em que cada tópico foi estudado nos últimos 30 dias (sessões, questões, registros, autoavaliações). */
function studiedDatesByTopic(input: {
  topics: Topic[];
  attempts: QuestionAttempt[];
  questionLogs: QuestionLog[];
  recallChecks: RecallCheck[];
  now: Date;
}): Record<string, string[]> {
  const sinceIso = new Date(input.now.getTime() - REVIEW_LOOKBACK_DAYS * DAY_MS).toISOString();
  const marks: { topicId: string | null; at: string | null }[] = [
    ...getStudySessionsSince(sinceIso).map((s) => ({ topicId: s.topic_id, at: s.started_at })),
    ...input.attempts.map((a) => ({ topicId: a.topic_id, at: a.attempted_at })),
    ...input.questionLogs.map((l) => ({ topicId: l.topic_id, at: l.logged_at })),
    ...input.recallChecks.map((c) => ({ topicId: c.topic_id, at: c.checked_at })),
    ...input.topics.map((t) => ({ topicId: t.id, at: t.last_studied_at })),
  ];
  const dates: Record<string, Set<string>> = {};
  for (const mark of marks) {
    if (!mark.topicId || !mark.at || mark.at < sinceIso) continue;
    (dates[mark.topicId] ??= new Set()).add(localDateKey(new Date(mark.at)));
  }
  return Object.fromEntries(Object.entries(dates).map(([id, set]) => [id, [...set]]));
}
