import { useEffect, useMemo, useState } from 'react';
import {
  BookPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  MessageSquarePlus,
  Search,
  Send,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  askReverseStudyTutor,
  getQuestionComplexityProfile,
  type ChatTurn,
  type StudentContextSnapshot,
} from '../lib/aiRouter';
import type { AiDissection, Question, SelfDiagnosisType } from '../types/database';

interface QuestionWorkbenchProps {
  questions: { question: Question; dissection: AiDissection | null }[];
  scopeFilter: 'topic' | 'subject' | 'all';
  onChangeScopeFilter: (scope: 'topic' | 'subject' | 'all') => void;
  onDiagnosis: (
    question: Question,
    selectedOptionLetter: string,
    isCorrect: boolean,
    diagnosis: SelfDiagnosisType,
    label: string
  ) => void;
  lastDiagnosisFeedback: string | null;
  onSaveToNotebook: (markdownToAppend: string) => void;
  onSaveChatHistory?: (questionId: string, chatJson: string) => void;
  studentContext?: StudentContextSnapshot;
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
}: QuestionWorkbenchProps) {
  const [boardFilter, setBoardFilter] = useState<string>('ALL');
  const [complexityFilter, setComplexityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [revealFirstContactBase, setRevealFirstContactBase] = useState<boolean>(false);
  const [savedNotebookToast, setSavedNotebookToast] = useState<boolean>(false);

  // Estado do Chat de Estudo Reverso
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isLoadingTutor, setIsLoadingTutor] = useState<boolean>(false);

  const enrichedQuestions = useMemo(() => {
    return questions.map((item) => ({
      ...item,
      complexity: getQuestionComplexityProfile(item.question, item.dissection),
    }));
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return enrichedQuestions.filter((item) => {
      if (
        boardFilter !== 'ALL' &&
        item.question.exam_board.toUpperCase() !== boardFilter.toUpperCase()
      ) {
        return false;
      }
      if (complexityFilter !== 'ALL' && item.complexity.levelLabel !== complexityFilter) {
        return false;
      }
      if (
        searchQuery.trim() &&
        !item.question.statement.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [enrichedQuestions, boardFilter, complexityFilter, searchQuery]);

  // Reseta índice apenas quando o usuário altera filtros intencionalmente (preserva índice ao diagnosticar/salvar)
  useEffect(() => {
    setCurrentIndex(0);
    setSelectedOptionIdx(null);
    setShowAnswer(false);
    setRevealFirstContactBase(false);
  }, [boardFilter, complexityFilter, searchQuery, scopeFilter]);

  const safeIndex =
    filteredQuestions.length > 0 ? Math.min(currentIndex, filteredQuestions.length - 1) : 0;
  const activeItem = filteredQuestions[safeIndex] || filteredQuestions[0] || null;

  // Carrega histórico de dúvidas salvo na questão quando muda de questão
  useEffect(() => {
    setSelectedOptionIdx(null);
    setShowAnswer(false);
    setRevealFirstContactBase(false);
    setSavedNotebookToast(false);
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
  }, [activeItem?.question.id]);

  if (!activeItem) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <Filter size={14} className="text-orange-400" />
          <select
            value={scopeFilter}
            onChange={(e) => onChangeScopeFilter(e.target.value as 'topic' | 'subject' | 'all')}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 outline-none"
          >
            <option value="topic">Questões deste Tópico</option>
            <option value="subject">Toda a Disciplina</option>
            <option value="all">Todas as Disciplinas</option>
          </select>
          <button
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
        </div>
        <div className="p-8 rounded-2xl bg-slate-900/70 border border-slate-800 text-center text-xs text-slate-400">
          Nenhuma questão encontrada para o filtro selecionado. Experimente mudar para "Toda a
          Disciplina" ou "Todas as Disciplinas".
        </div>
      </div>
    );
  }

  const { question, dissection, complexity } = activeItem;

  const parsedOptions: string[] = (() => {
    try {
      return JSON.parse(question.options_json);
    } catch {
      return [];
    }
  })();

  const prerequisites: string[] = (() => {
    if (!dissection?.prerequisites_json) return [];
    try {
      return JSON.parse(dissection.prerequisites_json);
    } catch {
      return [];
    }
  })();

  const handleAskTutor = async (promptText: string) => {
    if (!promptText.trim() || isLoadingTutor) return;
    setIsLoadingTutor(true);
    setRevealFirstContactBase(true);

    const studentTurn: ChatTurn = {
      id: `turn-s-${Date.now()}`,
      role: 'student',
      content: promptText.trim(),
      createdAt: new Date().toISOString(),
    };

    const { reply } = await askReverseStudyTutor({
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
    };

    const nextTurns = [...chatTurns, studentTurn, tutorTurn];
    setChatTurns(nextTurns);
    setCustomPrompt('');
    setIsLoadingTutor(false);

    if (onSaveChatHistory) {
      onSaveChatHistory(question.id, JSON.stringify(nextTurns));
    }
  };

  const selectedLetter =
    selectedOptionIdx !== null ? ['A', 'B', 'C', 'D', 'E'][selectedOptionIdx] || 'A' : null;
  const isSelectedCorrect = selectedLetter === question.final_answer;
  const isExplanationVisible = showAnswer || revealFirstContactBase;

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
            <option value="FGV">FGV</option>
            <option value="Cebraspe">Cebraspe</option>
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
        </div>

        {/* Paginação de Questões */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">
            Questão <strong className="text-white">{safeIndex + 1}</strong> de{' '}
            <strong className="text-white">{filteredQuestions.length}</strong>
          </span>
          <button
            disabled={safeIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-40 hover:border-slate-700"
            title="Questão anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            disabled={safeIndex >= filteredQuestions.length - 1}
            onClick={() => setCurrentIndex((i) => Math.min(filteredQuestions.length - 1, i + 1))}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-40 hover:border-slate-700"
            title="Próxima questão"
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
            {/* Cabeçalho da Questão + Indicador de Complexidade */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold">
                  {question.exam_board} ({question.exam_year}) • {question.organ}
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
              </div>

              {showAnswer && (
                <span className="text-slate-300">
                  Gabarito Oficial:{' '}
                  <strong className="text-emerald-300">Letra {question.final_answer}</strong>
                </span>
              )}
            </div>

            {/* Enunciado */}
            <p className="text-sm leading-relaxed text-slate-100">{question.statement}</p>

            {/* Alternativas */}
            <div className="space-y-2 text-xs">
              {parsedOptions.map((opt, idx) => {
                const letter = ['A', 'B', 'C', 'D', 'E'][idx];
                const isAnswer = letter === question.final_answer;
                const isSelected = selectedOptionIdx === idx;

                let styleClass =
                  'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300';
                if (showAnswer) {
                  if (isAnswer) {
                    styleClass =
                      'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-medium';
                  } else if (isSelected && !isAnswer) {
                    styleClass = 'bg-rose-500/15 border-rose-500/50 text-rose-200';
                  }
                } else if (isSelected) {
                  styleClass = 'bg-orange-500/15 border-orange-500/50 text-orange-200 font-medium';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedOptionIdx(idx);
                      setShowAnswer(true);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition ${styleClass}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* Feedback imediato ao responder */}
            {showAnswer && selectedLetter && (
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

            {/* Auto-Diagnóstico Rápido (1 Clique) */}
            <div className="pt-3 border-t border-slate-800">
              <p className="text-xs text-slate-400 mb-2">
                🏷️ <strong>Como foi resolver esta questão?</strong> (Alimenta a Confiança da Amostra
                e o Mapa de Calor sem alterar suas horas semanais):
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    id: 'MASTERED' as SelfDiagnosisType,
                    label: '🟢 Dominei / Só revisei',
                    desc: 'Assunto seguro',
                  },
                  {
                    id: 'DOUBT' as SelfDiagnosisType,
                    label: '🟡 Acertei na dúvida',
                    desc: 'Revisar em breve',
                  },
                  {
                    id: 'BOARD_TRAP' as SelfDiagnosisType,
                    label: '🟠 Pegadinha da Banca',
                    desc: 'Atenção ao enunciado',
                  },
                  {
                    id: 'BASE_GAP' as SelfDiagnosisType,
                    label: '🔴 1º Contato / Lacuna',
                    desc: 'Priorizar estudo',
                  },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() =>
                      onDiagnosis(
                        question,
                        selectedLetter || question.final_answer,
                        isSelectedCorrect,
                        btn.id,
                        btn.label
                      )
                    }
                    className="p-2.5 rounded-xl border bg-slate-950 border-slate-800 hover:border-orange-500/50 text-slate-200 text-left transition"
                  >
                    <div className="text-xs font-semibold">{btn.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{btn.desc}</div>
                  </button>
                ))}
              </div>

              {lastDiagnosisFeedback && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                  ✅ {lastDiagnosisFeedback}
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
                onClick={() => {
                  const fullNotes = [
                    dissection?.dissection_markdown || '',
                    ...chatTurns
                      .filter((t) => t.role === 'tutor')
                      .map((t) => `\n${t.content}`),
                  ]
                    .filter(Boolean)
                    .join('\n');
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

            {/* Pré-requisitos identificados */}
            {prerequisites.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Conceitos-chave:</span>
                {prerequisites.map((pre, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30"
                  >
                    {pre}
                  </span>
                ))}
              </div>
            )}

            {/* Proteção contra Descarga Cognitiva (Kapur, 2016) + Modo 1º Contato */}
            {isExplanationVisible ? (
              <div className="text-xs text-slate-200 space-y-2 leading-relaxed bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 whitespace-pre-line">
                {dissection?.dissection_markdown ||
                  'Selecione uma opção abaixo para explorar os conceitos desta questão.'}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
                <p className="text-slate-300 leading-relaxed">
                  🧠 <strong>Recuperação Ativa:</strong> Tente selecionar uma alternativa ao lado
                  para testar seu raciocínio antes de ver a resposta comentada.
                </p>
                <button
                  type="button"
                  onClick={() => setRevealFirstContactBase(true)}
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
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Por que as outras alternativas estão erradas?',
                  'Qual a pegadinha da banca aqui?',
                  'Me explique a base do zero (1º contato)',
                ].map((qPrompt) => (
                  <button
                    key={qPrompt}
                    onClick={() => handleAskTutor(qPrompt)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/40 text-[11px] text-slate-300 hover:text-orange-200 transition"
                  >
                    {qPrompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Histórico de Perguntas do Estudante nesta Questão */}
            {chatTurns.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {chatTurns.map((turn) => (
                  <div
                    key={turn.id}
                    className={`p-3 rounded-xl text-xs whitespace-pre-line leading-relaxed ${
                      turn.role === 'student'
                        ? 'bg-orange-500/15 border border-orange-500/30 text-orange-200 ml-6'
                        : 'bg-slate-950 border border-slate-800 text-slate-200'
                    }`}
                  >
                    {turn.content}
                  </div>
                ))}
              </div>
            )}

            {/* Campo para dúvida livre */}
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
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
