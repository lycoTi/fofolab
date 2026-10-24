import { useMemo } from 'react';
import { Play, Sun } from 'lucide-react';
import { getStudySessionsSince, getTopicFirstStudyDates } from '../../lib/database';
import type { SubjectCycleAllocation, TopicHeatItem } from '../../lib/cycleEngine';
import { REVIEW_LOOKBACK_DAYS } from '../../lib/dailyReview';
import { examSituation, greeting, moodLine } from '../../lib/goodMorning';
import { summarizeExamParts } from '../workbench-shell/headerSummary';
import type { ExamPart, QuestionAttempt, QuestionLog, RecallCheck, StudyPlan, StudySession, Subject, Topic } from '../../types/database';
import { DailyReviewCard } from './DailyReviewCard';
import { SituationCard } from './SituationCard';
import { useDailyReview } from './useDailyReview';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GoodMorningViewProps {
  dbReady: boolean;
  plan: StudyPlan;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  heat: TopicHeatItem[];
  allocations: SubjectCycleAllocation[];
  examParts: ExamPart[];
  attempts: QuestionAttempt[];
  questionLogs: QuestionLog[];
  recallChecks: RecallCheck[];
  /** Sessões da semana (o App já carrega): mudam quando algo é gravado, e a linha de ânimo é refeita. */
  weekSessions: StudySession[];
  dataVersion: number;
  /** Bloco atual do roteiro (nulo com o roteiro cumprido ou sem plano calibrado). */
  nextBlock: { subjectName: string } | null;
  onStartNextBlock: () => void;
  onRecorded: () => void;
  /** "Fiz questões fora do app" na revisão: abre o registro rápido da coluna com o tópico. */
  onLogOutside: (topicId: string) => void;
  now?: () => Date;
}

/**
 * Aba "Início" (spec 09 §5.3 + spec 07 §5.5): o que o estudante vê ao abrir o app — saudação, uma linha com fatos do
 * último dia de estudo, a Revisão do dia e a Situação das provas. O "Hoje" fica na coluna; daqui só um atalho.
 */
export function GoodMorningView(props: GoodMorningViewProps) {
  const { dbReady, plan, subjects, topicsBySubject, weekSessions, dataVersion } = props;
  const now = props.now ?? (() => new Date());
  const review = useDailyReview({
    dbReady,
    plan,
    subjects,
    topicsBySubject,
    heat: props.heat,
    attempts: props.attempts,
    questionLogs: props.questionLogs,
    recallChecks: props.recallChecks,
    dataVersion,
    onRecorded: props.onRecorded,
    now: props.now,
  });

  const mood = useMemo(() => {
    if (!dbReady) return null;
    void weekSessions;
    void dataVersion;
    const topicsById = Object.fromEntries(Object.values(topicsBySubject).flat().map((t) => [t.id, t]));
    const sinceIso = new Date(now().getTime() - REVIEW_LOOKBACK_DAYS * DAY_MS).toISOString();
    return moodLine({ sessions: getStudySessionsSince(sinceIso), firstStudyDates: getTopicFirstStudyDates(), topicsById, now: now() });
    // now() fica fora das dependências: a linha muda com os dados, não com o relógio
  }, [dbReady, weekSessions, dataVersion, topicsBySubject]);

  const situation = examSituation({
    plan,
    parts: props.examParts,
    progress: summarizeExamParts(props.allocations, props.examParts),
    now: now(),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
          <Sun size={20} className="text-amber-400" />
          {greeting(now())}
        </h1>
        {mood && <p className="text-sm text-slate-300">{mood}</p>}
      </div>

      <DailyReviewCard
        enabled={review.enabled}
        items={review.items}
        doneCount={review.doneCount}
        skipped={review.skipped}
        current={review.current}
        onAnswer={review.answerQuestion}
        onRate={review.rateRecall}
        onSkip={review.skip}
        onOutside={props.onLogOutside}
      />

      <SituationCard daysLine={situation.daysLine} parts={situation.parts} warning={situation.warning} />

      {props.nextBlock && (
        <button
          type="button"
          onClick={props.onStartNextBlock}
          className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400"
        >
          <Play size={15} />
          {`Começar o bloco de ${props.nextBlock.subjectName}`}
        </button>
      )}
    </div>
  );
}
