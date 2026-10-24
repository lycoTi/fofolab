import { useEffect, useMemo, useRef, useState } from 'react';
import { getQuestionComplexityProfile } from '../../lib/aiRouter';
import { deriveDiagnosis } from '../../lib/dailyReview';
import type { AiDissection, Question, ReviewConfidence, SelfDiagnosisType } from '../../types/database';
import { QuestionCard } from './QuestionCard';
import { QuestionCorrection } from './QuestionCorrection';
import { QuestionFilters, type QuestionScope } from './QuestionFilters';

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
  questions: { question: Question; dissection: AiDissection | null }[];
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
  /** Tópico sem questões próprias: diz de onde vieram as mostradas (grupo ou matéria). */
  sourceLabel?: string | null;
}

interface AttemptState {
  /** De qual questão é a tentativa: na troca de questão, a anterior nunca vale para a nova (nem por um render). */
  questionId: string | null;
  confidence: ReviewConfidence | null;
  picked: string | null;
  firstContact: boolean;
  attemptId: string | null;
  diagnosis: SelfDiagnosisType | null;
}

const FRESH: AttemptState = { questionId: null, confidence: null, picked: null, firstContact: false, attemptId: null, diagnosis: null };

/** Aba Questões (spec 11): uma questão por vez, confiança antes de responder e a correção logo embaixo. */
export function QuestionWorkbench(props: QuestionWorkbenchProps) {
  const { questions, onAnswer, onAskFofoIa, onActiveQuestionChange } = props;
  const [board, setBoard] = useState('ALL');
  const [complexity, setComplexity] = useState('ALL');
  const [search, setSearch] = useState('');
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState<AttemptState>(FRESH);
  const shownAt = useRef(Date.now());
  const usedAi = useRef(false);

  const enriched = useMemo(() => questions.map((item) => ({ ...item, complexity: getQuestionComplexityProfile(item.question, item.dissection) })), [questions]);
  const boards = useMemo(() => [...new Set(questions.map((q) => q.question.exam_board))].sort((a, b) => a.localeCompare(b)), [questions]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enriched.filter((item) => {
      if (board !== 'ALL' && item.question.exam_board.toUpperCase() !== board.toUpperCase()) return false;
      if (complexity !== 'ALL' && item.complexity.levelLabel !== complexity) return false;
      return !term || item.question.statement.toLowerCase().includes(term);
    });
  }, [enriched, board, complexity, search]);

  // Mudar filtros volta ao começo (gravar uma resposta não mexe no índice)
  useEffect(() => setIndex(0), [board, complexity, search, props.scopeFilter]);

  const safeIndex = filtered.length > 0 ? Math.min(index, filtered.length - 1) : 0;
  const active = filtered[safeIndex] ?? null;
  const activeId = active?.question.id;
  const current = attempt.questionId === activeId ? attempt : { ...FRESH, questionId: activeId ?? null };
  const answered = current.picked !== null || current.firstContact;

  // Questão nova na tela: tentativa nova (zera resposta, diagnóstico e cronômetro)
  useEffect(() => {
    setAttempt({ ...FRESH, questionId: activeId ?? null });
    shownAt.current = Date.now();
    usedAi.current = false;
  }, [activeId]);

  useEffect(() => {
    onActiveQuestionChange?.(active ? { question: active.question, answered } : null);
    // O objeto da questão muda a cada recarga dos dados; o que importa é qual questão e se já foi respondida
  }, [activeId, answered]);

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
    setAttempt({ questionId: active.question.id, confidence, picked, firstContact: picked === null, attemptId: saved?.attemptId ?? null, diagnosis });
  };

  const changeDiagnosis = (diagnosis: SelfDiagnosisType) => {
    setAttempt((a) => ({ ...a, diagnosis }));
    if (current.attemptId) props.onChangeDiagnosis(current.attemptId, diagnosis);
  };

  const filters = (
    <QuestionFilters
      scope={props.scopeFilter}
      onScope={props.onChangeScopeFilter}
      board={board}
      boards={boards}
      onBoard={setBoard}
      complexity={complexity}
      onComplexity={setComplexity}
      search={search}
      onSearch={setSearch}
      onOpenImport={props.onOpenImport}
      position={{ index: safeIndex, total: filtered.length }}
      sourceLabel={props.sourceLabel}
      onPrev={() => setIndex(Math.max(0, safeIndex - 1))}
      onNext={() => setIndex(Math.min(filtered.length - 1, safeIndex + 1))}
    />
  );

  if (!active) {
    return (
      <div className="space-y-4">
        {filters}
        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-xs text-slate-400">
          <p>Nenhuma questão encontrada para o filtro selecionado. Experimente "Toda a Disciplina" ou "Todo o Acervo".</p>
          {props.onOpenImport && <p>Ou traga as questões das suas provas em "Importar Questões".</p>}
        </div>
      </div>
    );
  }

  const isCorrect = current.picked !== null && current.picked === active.question.final_answer.trim().toUpperCase();
  const hasNext = safeIndex < filtered.length - 1;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {filters}
      <QuestionCard
        question={active.question}
        complexity={active.complexity}
        confidence={current.confidence}
        picked={current.picked}
        locked={answered}
        onConfidence={(confidence) => setAttempt({ ...current, confidence })}
        onPick={(key) => {
          if (!current.confidence || answered) return;
          record(key, current.confidence);
        }}
        onFirstContact={() => record(null, null)}
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
