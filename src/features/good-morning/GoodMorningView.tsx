import { useMemo } from 'react';
import { Gauge, Play, Sun } from 'lucide-react';
import { getLastOpenedPdf, getStudySessionsSince, getTopicFirstStudyDates } from '../../lib/database';
import type { SubjectCycleAllocation, TopicHeatItem } from '../../lib/cycleEngine';
import { REVIEW_LOOKBACK_DAYS } from '../../lib/dailyReview';
import { examSituation, greeting, moodLine } from '../../lib/goodMorning';
import { confidenceCalibration, editalProgress, studyCalendar } from '../../lib/goodMorningStats';
import { localDateKey } from '../../lib/timeFormat';
import { summarizeExamParts } from '../workbench-shell/headerSummary';
import type { ExamPart, Notebook, QuestionAttempt, QuestionLog, RecallCheck, StudyPlan, StudySession, Subject, Topic } from '../../types/database';
import { CalibrationCard } from './CalibrationCard';
import { DailyReviewCard } from './DailyReviewCard';
import { ResumeCard, type ResumeTarget } from './ResumeCard';
import { SituationCard } from './SituationCard';
import { StudyCalendar } from './StudyCalendar';
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
  /** Cadernos do plano (a última anotação vira atalho em "Continuar de onde parou"). */
  notebooks: Notebook[];
  onOpenPdf: (subjectId: string, topicId: string) => void;
  onOpenNotes: (subjectId: string, topicId: string) => void;
  /** Abre o simulador de tempo e ritmo de prova real */
  onOpenPacingModal?: () => void;
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

  // O dia entra nas dependências: com o Início aberto na virada da meia-noite, "Ontem" passa a ser o dia certo
  const today = localDateKey(now());
  // Fatos do banco que o Início usa (último mês de sessões, primeira vez de cada tópico, último PDF)
  const facts = useMemo(() => {
    if (!dbReady) return null;
    void weekSessions;
    void dataVersion;
    void today;
    const sinceIso = new Date(now().getTime() - REVIEW_LOOKBACK_DAYS * DAY_MS).toISOString();
    return { sessions: getStudySessionsSince(sinceIso), firstStudyDates: getTopicFirstStudyDates(), lastPdf: getLastOpenedPdf(plan.id) };
    // now() fica fora das dependências: os fatos mudam com os dados e com o dia, não a cada segundo
  }, [dbReady, weekSessions, dataVersion, plan.id, today]);

  const allTopics = useMemo(() => Object.values(topicsBySubject).flat(), [topicsBySubject]);
  const topicsById = useMemo(() => Object.fromEntries(allTopics.map((t) => [t.id, t])), [allTopics]);
  const mood = facts ? moodLine({ sessions: facts.sessions, firstStudyDates: facts.firstStudyDates, topicsById, now: now() }) : null;
  const progress = useMemo(() => {
    const parents = new Set(allTopics.map((t) => t.parent_id).filter(Boolean));
    const leafTopics = allTopics.filter((t) => !parents.has(t.id));
    return editalProgress({ leafTopics, firstStudyDates: facts?.firstStudyDates ?? {}, examDate: plan.exam_date, now: now() });
    // now() fica fora: o ritmo muda com os dados e com o dia
  }, [allTopics, facts, plan.exam_date]);
  const resume = resumeTargets(facts?.lastPdf ?? null, props.notebooks, topicsById);

  const situation = examSituation({
    plan,
    parts: props.examParts,
    progress: summarizeExamParts(props.allocations, props.examParts),
    now: now(),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-7 pb-12">
      <div className="space-y-1 border-b border-slate-800/60 pb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
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

      <ResumeCard pdf={resume.pdf} note={resume.note} onOpenPdf={props.onOpenPdf} onOpenNotes={props.onOpenNotes} />

      <SituationCard daysLine={situation.daysLine} parts={situation.parts} warning={situation.warning} progress={progress} />

      <div className="grid gap-6 border-t border-slate-800/60 pt-6 sm:grid-cols-2">
        <StudyCalendar days={studyCalendar(facts?.sessions ?? [], now())} />
        <CalibrationCard lines={confidenceCalibration(props.attempts)} />
      </div>

      {props.onOpenPacingModal && (
        <aside
          aria-label="Simulador de prova e ritmo"
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 text-xs"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-[var(--fofo-accent)]" />
              <h3 className="font-semibold text-slate-100">Inteligência de Ritmo & Simulação de Prova Real</h3>
            </div>
            <p className="text-slate-400">
              Analise se a sua velocidade de leitura e resolução garante terminar a prova sem esgotar o tempo.
            </p>
          </div>
          <button
            type="button"
            onClick={props.onOpenPacingModal}
            className="rounded-lg border border-[var(--fofo-accent)]/40 bg-[var(--fofo-accent)]/10 px-3.5 py-1.5 font-medium text-[var(--fofo-accent-text)] transition-colors hover:bg-[var(--fofo-accent)]/20"
          >
            Simular tempo de prova
          </button>
        </aside>
      )}

      {props.nextBlock && (
        <div className="border-t border-slate-800/60 pt-6">
          <button
            type="button"
            onClick={props.onStartNextBlock}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform duration-100 hover:bg-orange-400 active:scale-[0.98]"
          >
          <Play size={15} />
          {`Começar o bloco de ${props.nextBlock.subjectName}`}
          </button>
        </div>
      )}
    </div>
  );
}

function topicLabel(topic: Topic): string {
  return topic.code ? `${topic.code} ${topic.title}` : topic.title;
}

/** O último PDF aberto e a última anotação com texto, se o tópico ainda existe. */
function resumeTargets(
  lastPdf: { subject_id: string; topic_id: string | null; title: string; current_page: number; total_pages: number } | null,
  notebooks: Notebook[],
  topicsById: Record<string, Topic>
): { pdf: (ResumeTarget & { title: string; page: number; totalPages: number }) | null; note: ResumeTarget | null } {
  const pdfTopic = lastPdf?.topic_id ? topicsById[lastPdf.topic_id] : undefined;
  const pdf =
    lastPdf && pdfTopic
      ? { title: lastPdf.title, page: Math.max(1, lastPdf.current_page), totalPages: lastPdf.total_pages, topicLabel: topicLabel(pdfTopic), subjectId: lastPdf.subject_id, topicId: pdfTopic.id }
      : null;
  const lastNote = [...notebooks]
    .filter((n) => n.topic_id && topicsById[n.topic_id] && n.content_markdown.trim() !== '')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const note = lastNote?.topic_id
    ? { topicLabel: topicLabel(topicsById[lastNote.topic_id]), subjectId: lastNote.subject_id, topicId: lastNote.topic_id }
    : null;
  return { pdf, note };
}
