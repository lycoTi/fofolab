import { useEffect, useMemo, useRef, useState } from 'react';
import { getQuestionComplexityProfile } from '../../lib/aiRouter';
import { deriveDiagnosis } from '../../lib/dailyReview';
import { parseQuestionOptions } from '../../lib/questionOptions';
import type { QuestionAttemptSummary, QuestionsView } from '../../lib/acervo/topicQuestions';
import type { AiDissection, Question, ReviewConfidence, SelfDiagnosisType } from '../../types/database';
import { isCertoErradoOptions } from '../answer-flow/AnswerOptions';
import { AcervoLinkBar } from './AcervoLinkBar';
import { EmptyTopicQuestions } from './EmptyTopicQuestions';
import { QuestionCard } from './QuestionCard';
import { QuestionCorrection } from './QuestionCorrection';
import {
  QuestionFilters,
  type QuestionFormatFilter,
  type QuestionScope,
  type QuestionStatusFilter,
} from './QuestionFilters';

export interface AnswerSubmission {
  question: Question;
  /** `null` = 1º contato (abriu a explicação sem responder). */
  selectedOptionLetter: string | null;
  isCorrect: boolean;
  confidence: ReviewConfidence | null;
  diagnosis: SelfDiagnosisType;
  timeSpentSeconds: number;
  usedAiReview: boolean;
}

export type FofoQuestionRequest = { kind: 'deepen' | 'hint'; question: Question };

export interface QuestionWorkbenchProps {
  questions: { question: Question; dissection: AiDissection | null; attemptSummary?: QuestionAttemptSummary | null }[];
  scopeFilter: QuestionScope;
  onChangeScopeFilter: (scope: QuestionScope) => void;
  /** Grava a tentativa assim que o estudante responde (trocar de questão não perde nada). */
  onAnswer: (submission: AnswerSubmission) => { attemptId: string } | null;
  /** Troca o diagnóstico da mesma tentativa (o "trocável" e o "Por quê?" do erro). */
  onChangeDiagnosis: (attemptId: string, diagnosis: SelfDiagnosisType) => void;
  lastDiagnosisFeedback: string | null;
  onAskFofoIa?: (request: FofoQuestionRequest) => void;
  /** A questão na tela (a FofoIA usa; o gabarito só vai junto depois de respondida). */
  onActiveQuestionChange?: (active: { question: Question; answered: boolean } | null) => void;
  onGenerateDissection?: (question: Question) => Promise<{ ok: boolean; message?: string }>;
  onOpenImport?: () => void;
  aiConfigured?: boolean;
  /** Acervo da Cebraspe (spec 12c): de onde vêm os itens do tópico, o que foi tirado e o grupo, com as ações. */
  acervo?: {
    view: Pick<QuestionsView, 'links' | 'excluded' | 'groupCode' | 'acervoMissing'>;
    onDisableLink: (assuntoId: string) => void;
    onExcludeItem: (question: Question) => void;
    onRestoreItem: (itemId: string) => void;
    onShowGroup: () => void;
  };
  /** O acervo ainda está abrindo (primeira vez na sessão): ainda não dá para dizer que o tópico não tem questões. */
  loading?: boolean;
}

interface AttemptState {
  confidence: ReviewConfidence | null;
  picked: string | null;
  firstContact: boolean;
  attemptId: string | null;
  diagnosis: SelfDiagnosisType | null;
}

const FRESH: AttemptState = { confidence: null, picked: null, firstContact: false, attemptId: null, diagnosis: null };
const itemKey = (q: Question) => `${q.topic_id ?? ''}:${q.id}`;

function isCertoErrado(question: Question): boolean {
  return isCertoErradoOptions(parseQuestionOptions(question.options_json));
}

/** Aba Questões (spec 11 e 12d): fila de inéditas por padrão, Certo/Errado primeiro e correção logo embaixo. */
export function QuestionWorkbench(props: QuestionWorkbenchProps) {
  const { questions, onAnswer, onAskFofoIa, onActiveQuestionChange } = props;
  const [statusFilter, setStatusFilter] = useState<QuestionStatusFilter>('UNSOLVED');
  const [formatFilter, setFormatFilter] = useState<QuestionFormatFilter>('ALL');
  const [board, setBoard] = useState('ALL');
  const [complexity, setComplexity] = useState('ALL');
  const [search, setSearch] = useState('');
  const [index, setIndex] = useState(0);
  // Uma tentativa por questão na leva atual: responder não tira a questão da tela antes de o estudante avançar
  const [attempts, setAttempts] = useState<Record<string, AttemptState>>({});
  const shownAt = useRef(Date.now());
  const usedAi = useRef(false);

  const enriched = useMemo(
    () =>
      questions.map((item) => ({
        ...item,
        attemptSummary: item.attemptSummary ?? null,
        isCE: isCertoErrado(item.question),
        complexity: getQuestionComplexityProfile(item.question, item.dissection),
      })),
    [questions]
  );

  const counts = useMemo(() => {
    let unsolved = 0;
    let retry = 0;
    const all = enriched.length;
    for (const item of enriched) {
      if (item.question.is_annulled === 1) continue;
      const touchedInSession = Boolean(attempts[itemKey(item.question)]);
      if (!item.attemptSummary || touchedInSession) unsolved += 1;
      if (item.attemptSummary?.needsRetry) retry += 1;
    }
    return { unsolved, retry, all };
  }, [enriched, attempts]);

  const boards = useMemo(() => [...new Set(questions.map((q) => q.question.exam_board))].sort((a, b) => a.localeCompare(b)), [questions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = enriched.filter((item) => {
      const annulled = item.question.is_annulled === 1;
      const touched = Boolean(attempts[itemKey(item.question)]);
      if (statusFilter === 'UNSOLVED') {
        if (annulled) return false;
        if (item.attemptSummary && !touched) return false;
      } else if (statusFilter === 'RETRY') {
        if (annulled) return false;
        if (!item.attemptSummary?.needsRetry && !touched) return false;
      }
      if (formatFilter === 'CE' && !item.isCE) return false;
      if (formatFilter === 'ME' && item.isCE) return false;
      if (board !== 'ALL' && item.question.exam_board.toUpperCase() !== board.toUpperCase()) return false;
      if (complexity !== 'ALL' && item.complexity.levelLabel !== complexity) return false;
      return !term || item.question.statement.toLowerCase().includes(term);
    });

    if (formatFilter === 'ALL') {
      // Ordenação estável: Certo/Errado primeiro (formato principal da prova), mantendo a ordem original dentro de cada grupo
      return [...list].sort((a, b) => Number(b.isCE) - Number(a.isCE));
    }
    return list;
  }, [enriched, attempts, statusFilter, formatFilter, board, complexity, search]);

  // Mudar filtros limpa a memória da leva atual (para "Errei ou chutei" abrir desbloqueado) e volta ao começo
  useEffect(() => {
    setIndex(0);
    setAttempts({});
  }, [statusFilter, formatFilter, board, complexity, search, props.scopeFilter]);

  const safeIndex = filtered.length > 0 ? Math.min(index, filtered.length - 1) : 0;
  const active = filtered[safeIndex] ?? null;
  const activeId = active ? itemKey(active.question) : undefined;
  const current = (activeId && attempts[activeId]) || FRESH;
  const answered = current.picked !== null || current.firstContact;
  const setCurrent = (next: AttemptState) => {
    if (activeId) setAttempts((all) => ({ ...all, [activeId]: next }));
  };

  useEffect(() => {
    shownAt.current = Date.now();
    usedAi.current = false;
  }, [activeId]);

  useEffect(() => {
    onActiveQuestionChange?.(active ? { question: active.question, answered } : null);
  }, [activeId, answered]);

  useEffect(() => () => onActiveQuestionChange?.(null), []);

  const record = (picked: string | null, confidence: ReviewConfidence | null) => {
    if (!active) return;
    const isCorrect = picked !== null && picked === active.question.final_answer.trim().toUpperCase();
    const diagnosis = confidence && picked ? deriveDiagnosis(confidence, isCorrect) : 'BASE_GAP';
    const saved = onAnswer({
      question: active.question,
      selectedOptionLetter: picked,
      isCorrect,
      confidence,
      diagnosis,
      timeSpentSeconds: Math.round((Date.now() - shownAt.current) / 1000),
      usedAiReview: usedAi.current || picked === null,
    });
    setCurrent({ confidence, picked, firstContact: picked === null, attemptId: saved?.attemptId ?? null, diagnosis });
  };

  const changeDiagnosis = (diagnosis: SelfDiagnosisType) => {
    setCurrent({ ...current, diagnosis });
    if (current.attemptId) props.onChangeDiagnosis(current.attemptId, diagnosis);
  };

  const filters = (
    <QuestionFilters
      scope={props.scopeFilter}
      onScope={props.onChangeScopeFilter}
      statusFilter={statusFilter}
      onStatusFilter={setStatusFilter}
      counts={counts}
      formatFilter={formatFilter}
      onFormatFilter={setFormatFilter}
      board={board}
      boards={boards}
      onBoard={setBoard}
      complexity={complexity}
      onComplexity={setComplexity}
      search={search}
      onSearch={setSearch}
      position={{ index: safeIndex, total: filtered.length }}
      groupCode={props.acervo?.view.groupCode ?? null}
      onPrev={() => setIndex(Math.max(0, safeIndex - 1))}
      onNext={() => setIndex(Math.min(filtered.length - 1, safeIndex + 1))}
    />
  );

  const inTopic = props.scopeFilter === 'topic';
  const acervo = props.acervo;
  const linkBar = inTopic && acervo && (
    <AcervoLinkBar view={acervo.view} onDisableLink={acervo.onDisableLink} onRestoreItem={acervo.onRestoreItem} />
  );

  if (!active) {
    const emptyTopic = inTopic && questions.length === 0;
    const allSolvedInTopic = statusFilter === 'UNSOLVED' && counts.unsolved === 0 && counts.all > 0;
    return (
      <div className="space-y-4">
        {filters}
        {linkBar}
        {emptyTopic && props.loading && (
          <p className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-xs text-slate-400">
            Carregando as questões do acervo…
          </p>
        )}
        {emptyTopic && !props.loading && (
          <EmptyTopicQuestions
            groupCode={acervo?.view.groupCode ?? null}
            onShowGroup={acervo?.onShowGroup}
            onShowSubject={() => props.onChangeScopeFilter('subject')}
            canImport={Boolean(props.onOpenImport)}
          />
        )}
        {!emptyTopic && allSolvedInTopic && (
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-xs text-slate-400">
            <p className="text-sm text-slate-200">
              {inTopic
                ? 'Você já respondeu todas as questões inéditas deste tópico.'
                : 'Você já respondeu todas as questões inéditas desta seleção.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {counts.retry > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('RETRY')}
                  className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 font-medium text-orange-200 hover:bg-orange-500/20"
                >
                  {`Refazer as que errei ou chutei (${counts.retry})`}
                </button>
              )}
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-orange-500/40 hover:text-orange-200"
              >
                {`Ver todas (${counts.all})`}
              </button>
              {inTopic && acervo?.view.groupCode && acervo.onShowGroup && (
                <button
                  type="button"
                  onClick={acervo.onShowGroup}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-orange-500/40 hover:text-orange-200"
                >
                  {`Ver do tópico ${acervo.view.groupCode}`}
                </button>
              )}
            </div>
          </div>
        )}
        {!emptyTopic && !allSolvedInTopic && (
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-xs text-slate-400">
            <p>Nenhuma questão encontrada para o filtro selecionado. Experimente "Toda a matéria" ou "Todo o plano".</p>
            {props.scopeFilter === 'group' && (
              <div>
                <button
                  type="button"
                  onClick={() => props.onChangeScopeFilter('subject')}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-orange-500/40 hover:text-orange-200"
                >
                  Ver toda a matéria
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const isCorrect = current.picked !== null && current.picked === active.question.final_answer.trim().toUpperCase();
  const hasNext = safeIndex < filtered.length - 1;
  const onNotThisTopic = inTopic && acervo && active.question.acervo_item_id ? () => acervo.onExcludeItem(active.question) : undefined;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {filters}
      {linkBar}
      <QuestionCard
        question={active.question}
        complexity={active.complexity}
        attemptSummary={active.attemptSummary}
        confidence={current.confidence}
        picked={current.picked}
        locked={answered}
        onConfidence={(confidence) => setCurrent({ ...current, confidence })}
        onPick={(key) => {
          if (!current.confidence || answered) return;
          record(key, current.confidence);
        }}
        onFirstContact={() => record(null, null)}
        onNotThisTopic={onNotThisTopic}
        onHint={
          onAskFofoIa
            ? () => {
                usedAi.current = true;
                onAskFofoIa({ kind: 'hint', question: active.question });
              }
            : undefined
        }
      />
      {answered && current.diagnosis && (
        <QuestionCorrection
          question={active.question}
          dissection={active.dissection}
          isCorrect={isCorrect}
          firstContact={current.firstContact}
          confidence={current.confidence}
          diagnosis={current.diagnosis}
          onDiagnosis={changeDiagnosis}
          feedback={props.lastDiagnosisFeedback}
          aiConfigured={props.aiConfigured ?? false}
          onGenerateDissection={props.onGenerateDissection}
          onDeepen={onAskFofoIa ? () => onAskFofoIa({ kind: 'deepen', question: active.question }) : undefined}
          onNextQuestion={hasNext ? () => setIndex(safeIndex + 1) : undefined}
        />
      )}
    </div>
  );
}
