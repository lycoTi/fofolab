import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileUp,
  Filter,
  Loader2,
  MessageSquarePlus,
  Search,
  Send,
  Sparkles,
  Star,
} from 'lucide-react';
import { MetricExplainer } from './MetricExplainer';
import { RichText } from './RichText';
import { explainQuestionComplexity } from '../lib/explainabilityEngine';
import {
  askReverseStudyTutor,
  getQuestionComplexityProfile,
  type ChatTurn,
  type StudentContextSnapshot,
} from '../lib/aiRouter';
import { getAllowedDiagnoses, type AnswerState } from '../lib/diagnosis';
import { parseQuestionOptions } from '../lib/questionOptions';
import type { AiDissection, Question, SelfDiagnosisType } from '../types/database';

export interface DiagnosisSubmission {
  question: Question;
  /** `null` = 1º contato (abriu a explicação sem responder). */
  selectedOptionLetter: string | null;
  isCorrect: boolean;
  diagnosis: SelfDiagnosisType;
  label: string;
  timeSpentSeconds: number;
  usedAiReview: boolean;
}

interface QuestionWorkbenchProps {
  questions: { question: Question; dissection: AiDissection | null }[];
  scopeFilter: 'topic' | 'subject' | 'all';
  onChangeScopeFilter: (scope: 'topic' | 'subject' | 'all') => void;
  onDiagnosis: (submission: DiagnosisSubmission) => void;
  lastDiagnosisFeedback: string | null;
  onSaveToNotebook: (markdownToAppend: string) => void;
  onSaveChatHistory?: (questionId: string, chatJson: string) => void;
  studentContext?: StudentContextSnapshot;
  /** Gera a explicação-base com a IA real e guarda (questões importadas nascem sem explicação). */
  onGenerateDissection?: (question: Question) => Promise<{ ok: boolean; message?: string }>;
  onOpenImport?: () => void;
  aiConfigured?: boolean;
  /** Tópico sem questões próprias: diz de onde vieram as mostradas (grupo ou matéria). */
  sourceLabel?: string | null;
}

const DIAGNOSIS_BUTTONS: { id: SelfDiagnosisType; label: string; desc: string }[] = [
  { id: 'MASTERED', label: '🟢 Dominei / Só revisei', desc: 'Acertei com segurança' },
  { id: 'DOUBT', label: '🟡 Acertei na dúvida', desc: 'Revisar em breve' },
  { id: 'BOARD_TRAP', label: '🟠 Pegadinha da Banca', desc: 'Errei por atenção' },
  { id: 'BASE_GAP', label: '🔴 1º Contato / Lacuna', desc: 'Priorizar estudo' },
];

function resolveAnswerState(selectedLetter: string | null, isCorrect: boolean, revealedFirst: boolean): AnswerState {
  if (selectedLetter) return { kind: 'answered', isCorrect };
  if (revealedFirst) return { kind: 'first-contact' };
  return { kind: 'unanswered' };
}

function describeDiagnosisHint(state: AnswerState, alreadyDiagnosed: boolean): string {
  if (alreadyDiagnosed) return '✅ Diagnóstico registrado para esta tentativa. Siga para a próxima questão.';
  if (state.kind === 'unanswered') {
    return 'Responda a questão (ou abra a explicação de 1º contato) para registrar como foi.';
  }
  if (state.kind === 'first-contact') {
    return '1º contato: registre como lacuna para o Mapa de Calor priorizar este tópico.';
  }
  return state.isCorrect
    ? 'Você acertou: foi com segurança ou na dúvida?'
    : 'Você errou: foi pegadinha/desatenção ou lacuna de base?';
}

function describeDisabledReason(id: SelfDiagnosisType, state: AnswerState, alreadyDiagnosed: boolean): string {
  if (alreadyDiagnosed) return 'Diagnóstico já registrado';
  if (state.kind === 'unanswered') return 'Responda a questão primeiro';
  if (id === 'MASTERED' || id === 'DOUBT') return 'Disponível quando você acerta';
  return 'Disponível quando você erra';
}

export function QuestionWorkbench({
  questions,
  scopeFilter,
  onChangeScopeFilter,
  onDiagnosis,
  lastDiagnosisFeedback,
  onSaveToNotebook,
  onSaveChatHistory,
  studentContext,
  onGenerateDissection,
  onOpenImport,
  aiConfigured = false,
  sourceLabel = null,
}: QuestionWorkbenchProps) {
  const [boardFilter, setBoardFilter] = useState<string>('ALL');
  const [complexityFilter, setComplexityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [revealFirstContactBase, setRevealFirstContactBase] = useState<boolean>(false);
  const [diagnosedQuestionId, setDiagnosedQuestionId] = useState<string | null>(null);
  const [savedNotebookToast, setSavedNotebookToast] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);

  // Estado do Chat de Estudo Reverso
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isLoadingTutor, setIsLoadingTutor] = useState<boolean>(false);

  const shownAtRef = useRef<number>(Date.now());
  const answeredAtRef = useRef<number | null>(null);
  const usedAiRef = useRef<boolean>(false);

  const enrichedQuestions = useMemo(
    () =>
      questions.map((item) => ({
        ...item,
        complexity: getQuestionComplexityProfile(item.question, item.dissection),
      })),
    [questions]
  );

  const boardOptions = useMemo(
    () => [...new Set(questions.map((q) => q.question.exam_board))].sort((a, b) => a.localeCompare(b)),
    [questions]
  );

  const filteredQuestions = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return enrichedQuestions.filter((item) => {
      if (boardFilter !== 'ALL' && item.question.exam_board.toUpperCase() !== boardFilter.toUpperCase()) {
        return false;
      }
      if (complexityFilter !== 'ALL' && item.complexity.levelLabel !== complexityFilter) return false;
      return !term || item.question.statement.toLowerCase().includes(term);
    });
  }, [enrichedQuestions, boardFilter, complexityFilter, searchQuery]);

  // Reseta índice apenas quando o usuário altera filtros intencionalmente (preserva índice ao diagnosticar/salvar)
  useEffect(() => {
    setCurrentIndex(0);
  }, [boardFilter, complexityFilter, searchQuery, scopeFilter]);

  const safeIndex = filteredQuestions.length > 0 ? Math.min(currentIndex, filteredQuestions.length - 1) : 0;
  const activeItem = filteredQuestions[safeIndex] || null;
  const activeQuestionId = activeItem?.question.id;

  // Nova questão na tela: nova tentativa (zera resposta, diagnóstico e cronômetro)
  useEffect(() => {
    setSelectedLetter(null);
    setRevealFirstContactBase(false);
    setDiagnosedQuestionId(null);
    setSavedNotebookToast(false);
    setGenerateMessage(null);
    shownAtRef.current = Date.now();
    answeredAtRef.current = null;
    usedAiRef.current = false;
    if (!activeItem?.dissection?.chat_history_json) {
      setChatTurns([]);
      return;
    }
    try {
      const parsed = JSON.parse(activeItem.dissection.chat_history_json);
      setChatTurns(Array.isArray(parsed) ? parsed : []);
    } catch {
      setChatTurns([]);
    }
    // A troca de questão é o gatilho; o restante do item é lido no momento da troca
  }, [activeQuestionId]);

  if (!activeItem) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <Filter size={14} className="text-orange-400" />
          <select
            value={scopeFilter}
            onChange={(e) => onChangeScopeFilter(e.target.value as 'topic' | 'subject' | 'all')}
            aria-label="Escopo das questões"
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 outline-none"
          >
            <option value="topic">Questões deste Tópico</option>
            <option value="subject">Toda a Disciplina</option>
            <option value="all">Todas as Disciplinas</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setBoardFilter('ALL');
              setComplexityFilter('ALL');
              setSearchQuery('');
              onChangeScopeFilter('all');
            }}
            className="px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-300 font-medium"
          >
            Limpar Filtros
          </button>
          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold flex items-center gap-1.5"
            >
              <FileUp size={13} />
              Importar Questões
            </button>
          )}
        </div>
        <div className="p-8 rounded-2xl bg-slate-900/70 border border-slate-800 text-center text-xs text-slate-400 space-y-2">
          <p>
            Nenhuma questão encontrada para o filtro selecionado. Experimente mudar para "Toda a Disciplina" ou
            "Todas as Disciplinas".
          </p>
          {onOpenImport && <p>Ou traga as questões das suas provas em "Importar Questões".</p>}
        </div>
      </div>
    );
  }

  const { question, dissection, complexity } = activeItem;
  const options = parseQuestionOptions(question.options_json);

  let prerequisites: string[] = [];
  if (dissection?.prerequisites_json) {
    try {
      const parsed = JSON.parse(dissection.prerequisites_json);
      prerequisites = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      prerequisites = [];
    }
  }

  const showAnswer = selectedLetter !== null;
  const isSelectedCorrect = selectedLetter === question.final_answer.toUpperCase();
  const isExplanationVisible = showAnswer || revealFirstContactBase;
  const alreadyDiagnosed = diagnosedQuestionId === question.id;
  const answerState = resolveAnswerState(selectedLetter, isSelectedCorrect, revealFirstContactBase);
  const allowedDiagnoses = alreadyDiagnosed ? [] : getAllowedDiagnoses(answerState);

  const handleSelectOption = (letter: string) => {
    // A 1ª escolha vale: depois de ver o gabarito não dá para "corrigir" a resposta
    if (showAnswer) return;
    answeredAtRef.current = Date.now();
    setSelectedLetter(letter);
  };

  const handleRevealFirstContact = () => {
    if (!showAnswer) usedAiRef.current = true;
    setRevealFirstContactBase(true);
  };

  const handleDiagnosis = (id: SelfDiagnosisType, label: string) => {
    if (!allowedDiagnoses.includes(id)) return;
    const endedAt = answeredAtRef.current ?? Date.now();
    onDiagnosis({
      question,
      selectedOptionLetter: selectedLetter,
      isCorrect: selectedLetter !== null && isSelectedCorrect,
      diagnosis: id,
      label,
      timeSpentSeconds: Math.round((endedAt - shownAtRef.current) / 1000),
      usedAiReview: usedAiRef.current,
    });
    setDiagnosedQuestionId(question.id);
  };

  const handleAskTutor = async (promptText: string) => {
    if (!promptText.trim() || isLoadingTutor) return;
    setIsLoadingTutor(true);
    if (!showAnswer) usedAiRef.current = true;
    setRevealFirstContactBase(true);

    const studentTurn: ChatTurn = {
      id: `turn-s-${Date.now()}`,
      role: 'student',
      content: promptText.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      const { reply, simulated } = await askReverseStudyTutor({
        question,
        dissection,
        promptText: promptText.trim(),
        context: studentContext,
      });
      const tutorTurn: ChatTurn = {
        id: `turn-t-${Date.now() + 1}`,
        role: 'tutor',
        content: reply,
        createdAt: new Date().toISOString(),
        simulated,
      };
      const nextTurns = [...chatTurns, studentTurn, tutorTurn];
      setChatTurns(nextTurns);
      setCustomPrompt('');
      onSaveChatHistory?.(question.id, JSON.stringify(nextTurns));
    } finally {
      setIsLoadingTutor(false);
    }
  };

  const handleGenerateDissection = async () => {
    if (!onGenerateDissection || generating) return;
    setGenerating(true);
    setGenerateMessage(null);
    try {
      const result = await onGenerateDissection(question);
      if (!result.ok) setGenerateMessage(result.message ?? 'Não foi possível gerar a explicação agora.');
    } finally {
      setGenerating(false);
    }
  };

  const renderExplanation = () => {
    if (dissection?.dissection_markdown) {
      return (
        <div className="space-y-1.5">
          <RichText
            text={dissection.dissection_markdown}
            className="text-xs text-slate-200 leading-relaxed bg-slate-950/70 p-3.5 rounded-xl border border-slate-800"
          />
          <p className="text-[10px] text-slate-500">
            {dissection.provider_used === 'EXAMPLE'
              ? 'Explicação de exemplo, escrita à mão para demonstrar o app.'
              : 'Explicação gerada pela IA a partir do enunciado e do gabarito oficial — confira os dispositivos citados.'}
          </p>
        </div>
      );
    }
    return (
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-dashed border-slate-700 text-xs text-slate-300 space-y-2.5">
        <p>Esta questão ainda não tem explicação.</p>
        {aiConfigured && onGenerateDissection ? (
          <button
            type="button"
            onClick={handleGenerateDissection}
            disabled={generating}
            className="w-full py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-1.5 transition"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? 'Gerando explicação…' : 'Gerar explicação com IA'}
          </button>
        ) : (
          <p className="text-[11px] text-slate-500">
            Quando a IA estiver configurada, você poderá gerá-la aqui com um clique (ela fica guardada para as próximas
            vezes).
          </p>
        )}
        {generateMessage && <p className="text-[11px] text-amber-300">{generateMessage}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Cross-Banca & Complexidade */}
      <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-400 pr-1">
            <Filter size={14} className="text-orange-400" />
            <span className="font-medium">Filtrar:</span>
          </div>

          <select
            value={scopeFilter}
            onChange={(e) => onChangeScopeFilter(e.target.value as 'topic' | 'subject' | 'all')}
            aria-label="Escopo das questões"
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:border-orange-500 outline-none"
          >
            <option value="topic">Deste Tópico</option>
            <option value="subject">Toda a Disciplina</option>
            <option value="all">Todo o Acervo</option>
          </select>

          <select
            value={boardFilter}
            onChange={(e) => setBoardFilter(e.target.value)}
            aria-label="Filtrar por banca"
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:border-orange-500 outline-none"
          >
            <option value="ALL">Todas as Bancas</option>
            {boardOptions.map((board) => (
              <option key={board} value={board}>
                {board}
              </option>
            ))}
          </select>

          <select
            value={complexityFilter}
            onChange={(e) => setComplexityFilter(e.target.value)}
            aria-label="Filtrar por complexidade"
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:border-orange-500 outline-none"
          >
            <option value="ALL">Qualquer Complexidade</option>
            <option value="Direta">Direta</option>
            <option value="Intermediária">Intermediária</option>
            <option value="Densa / Estudo de Caso">Densa / Estudo de Caso</option>
          </select>

          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar termo no enunciado..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:border-orange-500 outline-none w-48"
            />
          </div>

          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/40 text-slate-300 hover:text-orange-200 flex items-center gap-1.5 transition"
            >
              <FileUp size={13} className="text-orange-400" />
              Importar Questões
            </button>
          )}
        </div>

        {/* Paginação de Questões */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">
            Questão <strong className="text-white">{safeIndex + 1}</strong> de{' '}
            <strong className="text-white">{filteredQuestions.length}</strong>
          </span>
          {sourceLabel && <span className="text-xs text-slate-400">· {sourceLabel}</span>}
          <button
            type="button"
            disabled={safeIndex === 0}
            onClick={() => setCurrentIndex(Math.max(0, safeIndex - 1))}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-40 hover:border-slate-700"
            title="Questão anterior"
            aria-label="Questão anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            disabled={safeIndex >= filteredQuestions.length - 1}
            onClick={() => setCurrentIndex(Math.min(filteredQuestions.length - 1, safeIndex + 1))}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-40 hover:border-slate-700"
            title="Próxima questão"
            aria-label="Próxima questão"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Grid Principal: Questão à esquerda + Estudo Reverso IA à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Enunciado, Alternativas e Auto-Diagnóstico */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold">
                  {question.exam_board} ({question.exam_year}){question.organ ? ` • ${question.organ}` : ''}
                </span>
                <span
                  className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-amber-300 flex items-center gap-1"
                  title={complexity.summaryTip}
                >
                  <span className="flex items-center">
                    {Array.from({ length: complexity.stars }).map((_, i) => (
                      <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
                    ))}
                  </span>
                  <span className="text-[11px] text-slate-300 ml-1">{complexity.levelLabel}</span>
                </span>
                <MetricExplainer explanation={explainQuestionComplexity(complexity, question.exam_board)} />
              </div>

              {showAnswer && (
                <span className="text-slate-300">
                  Gabarito Oficial: <strong className="text-emerald-300">Letra {question.final_answer}</strong>
                </span>
              )}
            </div>

            <p className="text-sm leading-relaxed text-slate-100 whitespace-pre-line">{question.statement}</p>

            <div className="space-y-2 text-xs">
              {options.map((opt) => {
                const isAnswer = opt.key === question.final_answer.toUpperCase();
                const isSelected = selectedLetter === opt.key;

                let styleClass = 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300';
                if (showAnswer && isAnswer) {
                  styleClass = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-medium';
                } else if (showAnswer && isSelected) {
                  styleClass = 'bg-rose-500/15 border-rose-500/50 text-rose-200';
                } else if (showAnswer) {
                  styleClass = 'bg-slate-950/40 border-slate-800 text-slate-400 cursor-default';
                }

                return (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => handleSelectOption(opt.key)}
                    aria-pressed={isSelected}
                    className={`w-full text-left p-3 rounded-xl border transition ${styleClass}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {showAnswer && (
              <div
                className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between ${
                  isSelectedCorrect
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                }`}
              >
                <span>
                  {isSelectedCorrect
                    ? `🎯 Você acertou! Gabarito oficial: Letra ${question.final_answer}.`
                    : `💡 Gabarito oficial: Letra ${question.final_answer}. No Estudo Reverso, aproveite a explicação ao lado para mapear como a ${question.exam_board} cobra este ponto!`}
                </span>
              </div>
            )}

            {/* Auto-Diagnóstico (1 por tentativa, coerente com acerto/erro) */}
            <div className="pt-3 border-t border-slate-800">
              <p className="text-xs text-slate-400 mb-2">
                🏷️ <strong>Como foi resolver esta questão?</strong> {describeDiagnosisHint(answerState, alreadyDiagnosed)}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DIAGNOSIS_BUTTONS.map((btn) => {
                  const enabled = allowedDiagnoses.includes(btn.id);
                  return (
                    <button
                      type="button"
                      key={btn.id}
                      onClick={() => handleDiagnosis(btn.id, btn.label)}
                      disabled={!enabled}
                      title={enabled ? btn.desc : describeDisabledReason(btn.id, answerState, alreadyDiagnosed)}
                      className="p-2.5 rounded-xl border bg-slate-950 border-slate-800 enabled:hover:border-orange-500/50 text-slate-200 text-left transition disabled:opacity-35 disabled:cursor-not-allowed"
                    >
                      <div className="text-xs font-semibold">{btn.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{btn.desc}</div>
                    </button>
                  );
                })}
              </div>

              {lastDiagnosisFeedback && alreadyDiagnosed && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between gap-2">
                  <span>✅ {lastDiagnosisFeedback}</span>
                  {safeIndex < filteredQuestions.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex(safeIndex + 1)}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-semibold"
                    >
                      Próxima questão →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Explicação Comentada + Chat de Estudo Reverso */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-orange-400" />
                <h3 className="text-sm font-bold text-white">Explicação & Estudo Reverso</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  const fullNotes = [
                    dissection?.dissection_markdown || '',
                    ...chatTurns.filter((t) => t.role === 'tutor' && !t.simulated).map((t) => `\n${t.content}`),
                  ]
                    .filter(Boolean)
                    .join('\n');
                  if (!fullNotes.trim()) return;
                  onSaveToNotebook(fullNotes);
                  setSavedNotebookToast(true);
                  setTimeout(() => setSavedNotebookToast(false), 3000);
                }}
                className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <BookPlus size={14} />
                Salvar Aula no Caderno
              </button>
            </div>

            {savedNotebookToast && (
              <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Anotação adicionada ao Caderno do Tópico sem sair desta questão!
              </div>
            )}

            {prerequisites.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Conceitos-chave:</span>
                {prerequisites.map((pre) => (
                  <span
                    key={pre}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30"
                  >
                    {pre}
                  </span>
                ))}
              </div>
            )}

            {/* Proteção contra Descarga Cognitiva (Kapur, 2016) + Modo 1º Contato */}
            {isExplanationVisible ? (
              renderExplanation()
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
                <p className="text-slate-300 leading-relaxed">
                  🧠 <strong>Recuperação Ativa:</strong> Tente selecionar uma alternativa ao lado para testar seu
                  raciocínio antes de ver a resposta comentada.
                </p>
                <button
                  type="button"
                  onClick={handleRevealFirstContact}
                  className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-orange-500/30 text-orange-300 font-medium flex items-center justify-center gap-1.5 transition"
                >
                  <Eye size={14} />
                  🌱 1º Contato: Ver Explicação Base Antes de Responder
                </button>
              </div>
            )}

            {/* Botões de Aprofundamento em 1 Clique (Estudo Reverso) */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                <MessageSquarePlus size={13} className="text-orange-400" />
                Aprofundar no Estudo Reverso:
                {!aiConfigured && (
                  <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    modo demonstração
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Por que as outras alternativas estão erradas?',
                  'Qual a pegadinha da banca aqui?',
                  'Me explique a base do zero (1º contato)',
                ].map((qPrompt) => (
                  <button
                    type="button"
                    key={qPrompt}
                    onClick={() => handleAskTutor(qPrompt)}
                    disabled={isLoadingTutor}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/40 text-[11px] text-slate-300 hover:text-orange-200 transition disabled:opacity-50"
                  >
                    {qPrompt}
                  </button>
                ))}
              </div>
            </div>

            {chatTurns.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {chatTurns.map((turn) => (
                  <div
                    key={turn.id}
                    className={`p-3 rounded-xl text-xs leading-relaxed ${
                      turn.role === 'student'
                        ? 'bg-orange-500/15 border border-orange-500/30 text-orange-200 ml-6'
                        : 'bg-slate-950 border border-slate-800 text-slate-200'
                    }`}
                  >
                    {turn.simulated && (
                      <div className="mb-1.5 text-[10px] font-semibold text-amber-300">
                        Exemplo simulado — a IA ainda não está configurada
                      </div>
                    )}
                    <RichText text={turn.content} />
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskTutor(customPrompt);
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Tire uma dúvida ou peça um exemplo..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-orange-500 outline-none"
              />
              <button
                type="submit"
                disabled={isLoadingTutor || !customPrompt.trim()}
                className="p-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white transition"
                title="Enviar pergunta"
                aria-label="Enviar pergunta"
              >
                {isLoadingTutor ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
