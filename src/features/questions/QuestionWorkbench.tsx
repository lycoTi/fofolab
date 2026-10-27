import { useEffect, useMemo, useRef, useState } from 'react';
import { getQuestionComplexityProfile } from '../../lib/aiRouter';
import { deriveDiagnosis } from '../../lib/dailyReview';
import type { QuestionsView } from '../../lib/acervo/topicQuestions';
import type { AiDissection, Question, ReviewConfidence, SelfDiagnosisType } from '../../types/database';
import { AcervoLinkBar } from './AcervoLinkBar';
import { EmptyTopicQuestions } from './EmptyTopicQuestions';
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

/** Aba Questões (spec 11): uma questão por vez, confiança antes de responder e a correção logo embaixo. */
export function QuestionWorkbench(props: QuestionWorkbenchProps) {
  const { questions, onAnswer, onAskFofoIa, onActiveQuestionChange } = props;
  const [board, setBoard] = useState('ALL');
  const [complexity, setComplexity] = useState('ALL');
  const [search, setSearch] = useState('');
  const [index, setIndex] = useState(0);
  // Uma tentativa por questão enquanto a aba está aberta: voltar a uma respondida mostra a correção travada
  const [attempts, setAttempts] = useState<Record<string, AttemptState>>({});
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
  // A tentativa é por tópico: o mesmo item do acervo em dois tópicos se responde em cada um (spec 12c §5.5)
  const activeId = active ? `${active.question.topic_id ?? ''}:${active.question.id}` : undefined;
  const current = (activeId && attempts[activeId]) || FRESH;
  const answered = current.picked !== null || current.firstContact;
  const setCurrent = (next: AttemptState) => {
    if (activeId) setAttempts((all) => ({ ...all, [activeId]: next }));
  };

  // Questão nova na tela: o cronômetro e a ajuda da IA contam de novo
  useEffect(() => {
    shownAt.current = Date.now();
    usedAi.current = false;
  }, [activeId]);

  useEffect(() => {
    onActiveQuestionChange?.(active ? { question: active.question, answered } : null);
    // O objeto da questão muda a cada recarga dos dados; o que importa é qual questão e se já foi respondida
  }, [activeId, answered]);

  // Saiu da aba Questões: não há mais questão ativa (a FofoIA não fica presa nela nem dá pista fora daqui)
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
      board={board}
      boards={boards}
      onBoard={setBoard}
      complexity={complexity}
      onComplexity={setComplexity}
      search={search}
      onSearch={setSearch}
      onOpenImport={props.onOpenImport}
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
    // Tópico sem nenhuma questão (não só sem resultado para o filtro de banca/busca)
    const emptyTopic = inTopic && questions.length === 0;
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
          <EmptyTopicQuestions groupCode={acervo?.view.groupCode ?? null} onShowGroup={acervo?.onShowGroup} canImport={Boolean(props.onOpenImport)} />
        )}
        {!emptyTopic && (
          <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-xs text-slate-400">
            <p>Nenhuma questão encontrada para o filtro selecionado. Experimente "Toda a matéria" ou "Todo o plano".</p>
            {props.onOpenImport && <p>Ou traga as questões das suas provas em "Importar Questões".</p>}
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
