import { useMemo } from 'react';
import type { StudentContextSnapshot } from '../../lib/aiRouter';
import type { CycleCalculationResult } from '../../lib/cycleEngine';
import { getNotebookForTopic, saveTopicNotebook } from '../../lib/database';
import { isFalseCertainty } from '../../lib/diagnosis';
import type { EditalTopicEntry } from '../../lib/fofoia/editalMatch';
import type { AiDissection, ExamPart, Notebook, Question, QuestionAttempt, QuestionLog, Subject, Topic } from '../../types/database';
import type { FofoActiveQuestion, FofoIaPanelProps, FofoStudentAttempt } from './FofoIaPanel';
import { useLawExcerpts } from './useLawExcerpts';

function topicLabel(topic: Topic): string {
  return topic.code ? `${topic.code} ${topic.title}` : topic.title;
}

/**
 * Monta o que a FofoIA precisa a partir dos dados do App (spec 11 §5.3): o tópico da conversa é o da questão ativa,
 * senão o selecionado; o caderno é o desse tópico; a questão ativa vem com o último diagnóstico (para os sinais).
 */
export function useFofoIaInputs(params: {
  studentContext: StudentContextSnapshot | undefined;
  cycleData: CycleCalculationResult | null;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
  examParts: ExamPart[];
  activeQuestion: {
    question: Question;
    answered: boolean;
    onNextSameSubject?: () => void;
    nextSameSubjectLabel?: string | null;
  } | null;
  topicQuestions: { question: Question; dissection: AiDissection | null }[];
  attempts: QuestionAttempt[];
  questionLogs: QuestionLog[];
  currentTopic: Topic | null;
  currentNotebookDraft: string;
  appendToCurrentNotebook: (markdown: string) => void;
  /** Cadernos do plano (o de outro tópico vem daqui, sempre atual). */
  notebooks: Notebook[];
  /** Salvou no caderno de outro tópico: o App recarrega a lista de cadernos. */
  onNotebookSaved: () => void;
}): Omit<FofoIaPanelProps, 'aiConfigured' | 'request' | 'onWiden' | 'warmupEnabled' | 'topicHasQuestions' | 'onTryQuestions' | 'onRequestHandled'> | null {
  const { studentContext, cycleData, subjects, topicsBySubject, examParts, activeQuestion, attempts, questionLogs, currentTopic } = params;
  const allTopics = useMemo(() => Object.values(topicsBySubject).flat(), [topicsBySubject]);
  const topic = allTopics.find((t) => t.id === activeQuestion?.question.topic_id) ?? currentTopic;

  const editalTopics = useMemo<EditalTopicEntry[]>(() => {
    const parents = new Set(allTopics.map((t) => t.parent_id).filter(Boolean));
    return allTopics
      .filter((t) => !parents.has(t.id))
      .map((t) => {
        const subject = subjects.find((s) => s.id === t.subject_id);
        const part = examParts.find((p) => p.id === subject?.exam_part_id);
        return { topic: t, subjectName: subject?.name ?? '', examPartCode: part?.code ?? null, weight: subject?.exam_weight ?? 1 };
      });
  }, [allTopics, subjects, examParts]);

  const otherNotebook = topic && topic.id !== currentTopic?.id ? (params.notebooks.find((n) => n.topic_id === topic.id)?.content_markdown ?? null) : null;

  const lawExcerpts = useLawExcerpts({
    question: activeQuestion?.question,
    topicTitle: topic?.title,
  });

  if (!studentContext || !topic) return null;

  // 1. Contexto do tópico da conversa (pode ser outro que o selecionado, quando a questão é do grupo ou da matéria)
  const heat = cycleData?.topicHeatmapRanking.find((h) => h.topic.id === topic.id);
  const subject = subjects.find((s) => s.id === topic.subject_id);
  const context: StudentContextSnapshot = {
    ...studentContext,
    currentSubjectName: subject?.name ?? studentContext.currentSubjectName,
    currentTopicCode: topic.code || studentContext.currentTopicCode,
    currentTopicTitle: topic.title,
    currentTopicMastery: topic.mastery_score,
    currentTopicConfidence: heat?.sampleConfidencePercent ?? 0,
    relatedPrerequisites: heat?.relatedPrerequisiteTitles ?? [],
  };

  // 2. Questão ativa com o último diagnóstico dela (sinais de "Do zero": falsa certeza, "confundi")
  let active: FofoActiveQuestion | null = null;
  if (activeQuestion) {
    const last = activeQuestion.answered
      ? [...attempts].filter((a) => a.question_id === activeQuestion.question.id).sort((a, b) => b.attempted_at.localeCompare(a.attempted_at))[0]
      : undefined;
    const attempt: FofoStudentAttempt | null = last
      ? {
          selectedOption: last.selected_option,
          isCorrect: last.is_correct === 1,
          confidence: last.confidence ?? null,
          diagnosis: last.self_diagnosis ?? null,
          timeSpentSeconds: last.time_spent_seconds,
          falseCertainty: isFalseCertainty(last),
        }
      : null;
    active = {
      question: activeQuestion.question,
      answered: activeQuestion.answered,
      dissection: params.topicQuestions.find((q) => q.question.id === activeQuestion.question.id)?.dissection ?? null,
      diagnosis: last?.self_diagnosis ?? null,
      falseCertainty: last ? isFalseCertainty(last) : false,
      attempt,
      onNextSameSubject: activeQuestion.onNextSameSubject,
      nextSameSubjectLabel: activeQuestion.nextSameSubjectLabel,
    };
  }

  const isCurrent = topic.id === currentTopic?.id;
  const firstContact =
    topic.last_studied_at === null && !attempts.some((a) => a.topic_id === topic.id) && !questionLogs.some((l) => l.topic_id === topic.id);

  return {
    context,
    topicKey: topic.id,
    topicLabel: topicLabel(topic),
    notebook: isCurrent ? params.currentNotebookDraft : otherNotebook,
    activeQuestion: active,
    prerequisites: context.relatedPrerequisites,
    editalTopics,
    firstContact,
    lawExcerpts,
    onSaveSummary: (markdown) => {
      if (isCurrent) {
        params.appendToCurrentNotebook(markdown);
        return;
      }
      const existing = getNotebookForTopic(topic.id)?.content_markdown ?? '';
      saveTopicNotebook({ subjectId: topic.subject_id, topicId: topic.id, title: topicLabel(topic), contentMarkdown: existing ? `${existing}\n\n${markdown}` : markdown });
      params.onNotebookSaved();
    },
  };
}
