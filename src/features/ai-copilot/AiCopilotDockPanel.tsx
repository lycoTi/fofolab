import { useState } from 'react';
import { BookPlus, CheckCircle2, Loader2, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import {
  askContextualStudyCopilot,
  type ChatTurn,
  type StudentContextSnapshot,
} from '../../lib/aiRouter';
import type { Question } from '../../types/database';

interface AiCopilotDockPanelProps {
  width?: number;
  context: StudentContextSnapshot;
  activeQuestion?: Question | null;
  notebookExcerpt?: string;
  onSaveToNotebook: (markdownToAppend: string) => void;
  onCloseDock?: () => void;
  aiConfigured?: boolean;
}

function buildWelcome(context: StudentContextSnapshot, aiConfigured: boolean): ChatTurn {
  const demoNote = aiConfigured
    ? ''
    : '\n\n🧪 **Modo demonstração:** a IA ainda não foi configurada, então minhas respostas por enquanto são exemplos de como vou te ajudar.';
  return {
    id: 'welcome-copilot',
    role: 'tutor',
    content:
      `🐹 **Olá! Sou seu Copiloto Contextual para a prova da ${context.organ} (${context.examBoard}).**\n\n` +
      `Estou acompanhando seu estudo em **${context.currentSubjectName} → ${context.currentTopicCode} ${context.currentTopicTitle}** ` +
      `(Domínio: **${context.currentTopicMastery}%** | Confiança da Amostra: **${context.currentTopicConfidence}%**).\n\n` +
      `Posso relacionar este tópico com o que você já domina ou montar seu foco de hoje com base no Mapa de Calor!${demoNote}`,
    createdAt: new Date().toISOString(),
  };
}

export function AiCopilotDockPanel({
  width = 384,
  context,
  activeQuestion,
  notebookExcerpt,
  onSaveToNotebook,
  onCloseDock,
  aiConfigured = false,
}: AiCopilotDockPanelProps) {
  const [turns, setTurns] = useState<ChatTurn[]>(() => [buildWelcome(context, aiConfigured)]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [savedTurnId, setSavedTurnId] = useState<string | null>(null);

  const handleSend = async (promptText: string) => {
    if (!promptText.trim() || isLoading) return;
    setIsLoading(true);

    const studentTurn: ChatTurn = {
      id: `cop-s-${Date.now()}`,
      role: 'student',
      content: promptText.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      const { reply, simulated } = await askContextualStudyCopilot({
        context,
        promptText: promptText.trim(),
        activeQuestion,
        notebookExcerpt,
      });
      const tutorTurn: ChatTurn = {
        id: `cop-t-${Date.now() + 1}`,
        role: 'tutor',
        content: reply,
        createdAt: new Date().toISOString(),
        simulated,
      };
      setTurns((prev) => [...prev, studentTurn, tutorTurn]);
      setInputPrompt('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      aria-label="Painel Copiloto IA Contextual"
      style={{ width }}
      className="border-l border-slate-800 bg-slate-900/75 flex flex-col shrink-0 h-full min-w-0"
    >
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400">
            <Sparkles size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Copiloto IA Contextual</h3>
            <p className="text-[10px] text-slate-400">
              {aiConfigured
                ? 'Conectado ao seu Edital, Desempenho e Tópicos'
                : 'Modo demonstração — respostas de exemplo até a IA ser configurada'}
            </p>
          </div>
        </div>

        {onCloseDock && (
          <button
            type="button"
            onClick={onCloseDock}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Recolher Copiloto IA"
            aria-label="Recolher Copiloto IA"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Resumo de Contexto Ativo (Visível para o estudante saber o que a IA enxerga) */}
      <div className="px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800/80 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between text-slate-300">
          <span className="font-semibold text-orange-300">
            🎯 {context.organ} ({context.examBoard})
          </span>
          <span>
            Domínio: <strong>{context.currentTopicMastery}%</strong> • Amostra:{' '}
            <strong>{context.currentTopicConfidence}%</strong>
          </span>
        </div>
        <div className="text-slate-400 truncate">
          📍 Tópico: <strong className="text-slate-200">{context.currentTopicCode}</strong> {context.currentTopicTitle}
        </div>
        {context.strongTopics.length > 0 && (
          <div className="text-[10px] text-emerald-300/90 truncate">
            🔗 Ponto forte p/ analogia: {context.strongTopics[0]}
          </div>
        )}
      </div>

      <div className="px-3.5 py-2.5 border-b border-slate-800/60 flex flex-wrap gap-1.5">
        {[
          'Relacione este tópico com o que já domino',
          'O que priorizar hoje para meu edital?',
          'Como a banca cobra este assunto?',
        ].map((quickPrompt) => (
          <button
            key={quickPrompt}
            type="button"
            onClick={() => handleSend(quickPrompt)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/40 text-[10px] text-slate-300 hover:text-orange-200 transition disabled:opacity-50"
          >
            {quickPrompt}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`p-3 rounded-xl text-xs whitespace-pre-line leading-relaxed space-y-2 ${
              turn.role === 'student'
                ? 'bg-orange-500/15 border border-orange-500/30 text-orange-100 ml-6'
                : 'bg-slate-950 border border-slate-800 text-slate-200'
            }`}
          >
            {turn.simulated && (
              <div className="text-[10px] font-semibold text-amber-300">
                Exemplo simulado — a IA ainda não está configurada
              </div>
            )}
            <div>{turn.content}</div>
            {turn.role === 'tutor' && turn.id !== 'welcome-copilot' && !turn.simulated && (
              <div className="pt-1.5 border-t border-slate-900 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onSaveToNotebook(turn.content);
                    setSavedTurnId(turn.id);
                    setTimeout(() => setSavedTurnId(null), 2500);
                  }}
                  className="text-[10px] px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-orange-300 flex items-center gap-1 transition"
                >
                  {savedTurnId === turn.id ? (
                    <>
                      <CheckCircle2 size={11} className="text-emerald-400" />
                      <span className="text-emerald-300">Salvo no Caderno!</span>
                    </>
                  ) : (
                    <>
                      <BookPlus size={11} />
                      <span>Enviar para o Caderno</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(inputPrompt);
        }}
        className="p-3 border-t border-slate-800 flex items-center gap-2 bg-slate-950/60"
      >
        <MessageSquare size={14} className="text-slate-500 shrink-0" />
        <input
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Pergunte sobre o tópico, banca ou seu ciclo..."
          aria-label="Perguntar ao Copiloto IA"
          className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:border-orange-500 outline-none"
        />
        <button
          type="submit"
          disabled={isLoading || !inputPrompt.trim()}
          className="p-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white transition"
          title="Enviar mensagem ao Copiloto"
          aria-label="Enviar mensagem ao Copiloto"
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </form>
    </section>
  );
}
