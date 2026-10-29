import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import type { StudentContextSnapshot } from '../../lib/aiRouter';
import { buildFofoContext, type LawExcerpt } from '../../lib/fofoia/context';
import type { EditalTopicEntry } from '../../lib/fofoia/editalMatch';
import type { AiDissection, Question, ReviewConfidence, SelfDiagnosisType } from '../../types/database';
import { CurrentFofo } from '../mascot/FofoOutfitContext';
import { LawPillsBar } from '../laws/LawPillsBar';
import { FofoMessage } from './FofoMessage';
import { FofoPanelHeader } from './FofoPanelHeader';
import { FofoShortcuts } from './FofoShortcuts';
import { useFofoConversation } from './useFofoConversation';
import { WarmupInvite } from './WarmupInvite';
import { markWarmupSeen, warmupSeen } from './warmup';

/** Largura mínima da coluna enquanto se lê uma aula completa (spec 11 §5.1). */
export const LESSON_MIN_WIDTH = 560;

export interface FofoStudentAttempt {
  selectedOption: string;
  isCorrect: boolean;
  confidence: ReviewConfidence | null;
  diagnosis: SelfDiagnosisType | null;
  timeSpentSeconds?: number;
  falseCertainty: boolean;
}

export interface FofoActiveQuestion {
  question: Question;
  answered: boolean;
  dissection: AiDissection | null;
  diagnosis: SelfDiagnosisType | null;
  falseCertainty: boolean;
  attempt?: FofoStudentAttempt | null;
  onNextSameSubject?: () => void;
  nextSameSubjectLabel?: string | null;
}

export interface FofoIaPanelProps {
  context: StudentContextSnapshot;
  /** Tópico da conversa (o da questão ativa, senão o selecionado): mudou, a conversa recomeça. */
  topicKey: string;
  topicLabel: string;
  notebook: string | null;
  activeQuestion: FofoActiveQuestion | null;
  prerequisites: string[];
  editalTopics: EditalTopicEntry[];
  firstContact: boolean;
  aiConfigured: boolean;
  /** Pedido vindo da aba Questões ("Aprofundar com a FofoIA", "Pedir pista"). */
  request: { id: number; kind: 'deepen' | 'hint' } | null;
  onWiden: (minWidth: number) => void;
  onSaveSummary: (markdown: string) => void;
  /** Aquecimento antes da aula num tópico nunca tentado (desligado por "Tenho meu método"). */
  warmupEnabled: boolean;
  topicHasQuestions: boolean;
  onTryQuestions: () => void;
  /** O pedido foi atendido: o App o limpa (senão voltaria a ser enviado quando o painel reaparecer). */
  onRequestHandled: () => void;
  /** Fragmentos oficiais da letra da lei (Fatia 11.2.3). */
  lawExcerpts?: LawExcerpt[];
}

/** FofoIA (spec 11): um só professor na coluna direita, com jeitos de ensinar escolhidos pelos sinais do estudante. */
export function FofoIaPanel(props: FofoIaPanelProps) {
  const { activeQuestion, topicLabel } = props;
  const ctx = buildFofoContext({
    context: props.context,
    notebook: props.notebook,
    activeQuestion: activeQuestion
      ? { question: activeQuestion.question, answered: activeQuestion.answered, dissection: activeQuestion.dissection, attempt: activeQuestion.attempt }
      : null,
    prerequisites: props.prerequisites,
    lawExcerpts: props.lawExcerpts,
  });
  const sessionKey = activeQuestion?.question?.id ? `q:${activeQuestion.question.id}` : `t:${props.topicKey}`;
  const { turns, loading, send, resume, clear } = useFofoConversation({
    sessionKey,
    topicKey: props.topicKey,
    topicLabel,
    ctx,
    baseSignals: {
      topicMastery: props.context.currentTopicMastery,
      firstContact: props.firstContact,
      activeQuestion: activeQuestion
        ? { answered: activeQuestion.answered, diagnosis: activeQuestion.diagnosis, falseCertainty: activeQuestion.falseCertainty }
        : null,
    },
    editalTopics: props.editalTopics,
  });
  const [draft, setDraft] = useState('');
  const [warmup, setWarmup] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handledRequest = useRef<number | null>(null);
  const unanswered = activeQuestion !== null && !activeQuestion.answered;

  // Ajusta altura do textarea até ~35% da altura da janela com rolagem vertical
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    if (draft) {
      const maxHeight = Math.min(el.scrollHeight, Math.floor(window.innerHeight * 0.35));
      el.style.height = `${maxHeight}px`;
    }
  }, [draft]);

  // Rola só a lista de mensagens (scrollIntoView rolaria também as colunas de fora e deslocaria a tela)
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns.length, loading]);

  // Depois de conversar (uma questão colada, uma dúvida), aula e resumo são sobre isso, não o tópico genérico
  const talked = turns.some((t) => t.role === 'student' && !t.smallTalk);
  const subject = talked ? `o que conversamos (tópico ${topicLabel})` : topicLabel;

  const startLesson = (part?: number, guess = '', partTotal?: number) => {
    props.onWiden(LESSON_MIN_WIDTH);
    const palpite = guess.trim() ? ` Meu palpite antes da aula: ${guess.trim()}` : '';
    void send(part ? `Continue a aula (Parte ${part})` : `Aula completa sobre ${subject}.${palpite}`, 'LESSON', { part, partTotal });
  };
  // Tópico nunca tentado: antes da primeira aula, o aquecimento (uma vez por tópico)
  const lesson = (part?: number, partTotal?: number) => {
    if (!part && props.warmupEnabled && props.firstContact && !warmupSeen(props.topicKey)) {
      setWarmup(true);
      return;
    }
    startLesson(part, '', partTotal);
  };
  const hint = () => void send('Me dá uma pista?', 'HINT');

  useEffect(() => {
    const request = props.request;
    // Com a FofoIA pensando, o pedido espera (senão seria marcado como atendido e sumiria)
    if (!request || loading || handledRequest.current === request.id) return;
    handledRequest.current = request.id;
    if (request.kind === 'hint') hint();
    else void send('Me explique esta questão e por que as outras alternativas estão erradas.');
    props.onRequestHandled();
    // Cada pedido (id) é atendido uma vez; send/hint mudam a cada render
  }, [props.request, loading]);

  // Trocou de tópico: o convite de aquecimento era do tópico anterior
  useEffect(() => setWarmup(false), [props.topicKey]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    void send(text);
    setDraft('');
  };

  return (
    <section aria-label="FofoIA" className="flex h-full min-w-0 flex-col bg-slate-900/75">
      <FofoPanelHeader
        topicLabel={topicLabel}
        aiConfigured={props.aiConfigured}
        hasTurns={turns.length > 0}
        onClear={clear}
      />
      <LawPillsBar
        excerpts={props.lawExcerpts}
        conversationText={turns.length > 0 ? turns.map((t) => t.content).join(' ') : undefined}
        onSaveToNotebook={props.onSaveSummary}
      />

      <div ref={listRef} role="log" aria-label="Conversa com a FofoIA" className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
        {turns.length === 0 && (
          <p className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 text-xs leading-relaxed text-slate-300">
            {`Oi! Sou a FofoIA. Pergunte o que quiser sobre ${topicLabel}: eu explico rápido ou dou uma aula completa.`}
          </p>
        )}
        {turns.map((turn, index) => (
          <FofoMessage
            key={turn.id}
            turn={turn}
            reveal={index === turns.length - 1 && turn.role === 'tutor'}
            topicLabel={topicLabel}
            aiConfigured={props.aiConfigured}
            onContinue={(part, total) => lesson(part, total)}
            onResume={() => void resume(turn)}
            onAnotherHint={hint}
            onLesson={() => lesson()}
            onSummary={() => void send(talked ? `Resumo de revisão do que conversamos (tópico ${topicLabel}).` : `Resumo de revisão de ${topicLabel}`, 'SUMMARY')}
            onSaveSummary={props.onSaveSummary}
            onRetry={() => turn.retry && void send(turn.retry.message, turn.retry.requested, turn.retry.options)}
          />
        ))}
        {warmup && (
          <WarmupInvite
            topicLabel={topicLabel}
            hasQuestions={props.topicHasQuestions}
            onTryQuestions={() => {
              markWarmupSeen(props.topicKey);
              setWarmup(false);
              props.onTryQuestions();
            }}
            onLesson={(guess) => {
              markWarmupSeen(props.topicKey);
              setWarmup(false);
              startLesson(undefined, guess);
            }}
          />
        )}
        {loading && (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <CurrentFofo pose="pensando" motion="full" decorative />
            A FofoIA está pensando…
          </p>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-800/80 bg-slate-950/60 p-3">
        <FofoShortcuts
          unanswered={unanswered}
          activeQuestion={activeQuestion}
          topicLabel={topicLabel}
          talked={talked}
          onHint={hint}
          onLesson={() => lesson()}
          onSend={(msg, mode) => void send(msg, mode ?? null)}
        />
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Pergunte sobre o tópico ou a questão…"
            aria-label="Pergunte à FofoIA"
            className="max-h-[35vh] flex-1 resize-none rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white outline-none focus:border-orange-500"
          />
          <button type="submit" disabled={loading || !draft.trim()} aria-label="Enviar pergunta" className="rounded-xl bg-orange-500 p-2 text-white shadow-sm transition-transform duration-100 hover:bg-orange-600 active:scale-95 disabled:opacity-40">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>
        <p className="text-[10px] text-slate-500">Suas anotações deste tópico vão junto com a pergunta para a IA.</p>
      </div>
    </section>
  );
}
