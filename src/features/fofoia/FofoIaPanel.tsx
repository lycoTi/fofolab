import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import type { StudentContextSnapshot } from '../../lib/aiRouter';
import { buildFofoContext } from '../../lib/fofoia/context';
import type { EditalTopicEntry } from '../../lib/fofoia/editalMatch';
import type { FofoMode } from '../../lib/fofoia/signals';
import type { AiDissection, Question, SelfDiagnosisType } from '../../types/database';
import { CurrentFofo } from '../mascot/FofoOutfitContext';
import { FofoMessage } from './FofoMessage';
import { useFofoConversation } from './useFofoConversation';
import { WarmupInvite } from './WarmupInvite';
import { markWarmupSeen, warmupSeen } from './warmup';

/** Largura mínima da coluna enquanto se lê uma aula completa (spec 11 §5.1). */
export const LESSON_MIN_WIDTH = 560;

export interface FofoActiveQuestion {
  question: Question;
  answered: boolean;
  dissection: AiDissection | null;
  diagnosis: SelfDiagnosisType | null;
  falseCertainty: boolean;
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
}

const shortcut = 'rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-orange-500/50 hover:text-white';

/** FofoIA (spec 11): um só professor na coluna direita, com jeitos de ensinar escolhidos pelos sinais do estudante. */
export function FofoIaPanel(props: FofoIaPanelProps) {
  const { activeQuestion, topicLabel } = props;
  const ctx = buildFofoContext({
    context: props.context,
    notebook: props.notebook,
    activeQuestion: activeQuestion ? { question: activeQuestion.question, answered: activeQuestion.answered, dissection: activeQuestion.dissection } : null,
    prerequisites: props.prerequisites,
  });
  const { turns, loading, send, resume } = useFofoConversation({
    topicKey: props.topicKey,
    topicLabel,
    ctx,
    baseSignals: {
      topicMastery: props.context.currentTopicMastery,
      firstContact: props.firstContact,
      activeQuestion: activeQuestion ? { answered: activeQuestion.answered, diagnosis: activeQuestion.diagnosis, falseCertainty: activeQuestion.falseCertainty } : null,
    },
    editalTopics: props.editalTopics,
  });
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<FofoMode | null>(null);
  const [warmup, setWarmup] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const handledRequest = useRef<number | null>(null);
  const unanswered = activeQuestion !== null && !activeQuestion.answered;

  // Rola só a lista de mensagens (scrollIntoView rolaria também as colunas de fora e deslocaria a tela)
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns.length, loading]);

  const startLesson = (part?: number, guess = '', partTotal?: number) => {
    props.onWiden(LESSON_MIN_WIDTH);
    const palpite = guess.trim() ? ` Meu palpite antes da aula: ${guess.trim()}` : '';
    void send(part ? `Continue a aula (Parte ${part})` : `Aula completa sobre ${topicLabel}.${palpite}`, 'LESSON', { part, partTotal });
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
    void send(text, pending);
    setDraft('');
    setPending(null);
  };

  return (
    <section aria-label="FofoIA" className="flex h-full min-w-0 flex-col bg-slate-900/75">
      <div className="flex items-center gap-2.5 border-b border-slate-800 p-3.5">
        <CurrentFofo decorative />
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-white">FofoIA</h3>
          <p className="truncate text-[10px] text-slate-400">{props.aiConfigured ? `Conversando sobre ${topicLabel}` : 'Modo demonstração — respostas de exemplo até a IA ser configurada'}</p>
        </div>
      </div>

      <div ref={listRef} role="log" aria-label="Conversa com a FofoIA" className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
        {turns.length === 0 && (
          <p className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs leading-relaxed text-slate-300">
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
            onSummary={() => void send(`Resumo de revisão de ${topicLabel}`, 'SUMMARY')}
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
            <Loader2 size={12} className="animate-spin" />
            A FofoIA está pensando…
          </p>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-800 bg-slate-950/60 p-3">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => lesson()} className={shortcut}>
            Aula completa
          </button>
          <button type="button" aria-pressed={pending === 'EDITAL'} onClick={() => setPending(pending === 'EDITAL' ? null : 'EDITAL')} className={`${shortcut} ${pending === 'EDITAL' ? 'border-orange-500 text-orange-200' : ''}`}>
            Cai no meu edital?
          </button>
          {unanswered && (
            <button type="button" onClick={hint} className={shortcut}>
              Pedir pista
            </button>
          )}
        </div>
        {pending === 'EDITAL' && (
          <p className="flex items-center gap-1.5 text-[11px] text-orange-200">
            Descreva o assunto e eu digo se está no seu edital.
            <button type="button" onClick={() => setPending(null)} aria-label="Cancelar" className="text-slate-400 hover:text-white">
              <X size={11} />
            </button>
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={pending === 'EDITAL' ? 'Ex.: mensageria com filas…' : 'Pergunte sobre o tópico ou a questão…'}
            aria-label="Pergunte à FofoIA"
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
          />
          <button type="submit" disabled={loading || !draft.trim()} aria-label="Enviar pergunta" className="rounded-xl bg-orange-500 p-2 text-white hover:bg-orange-600 disabled:opacity-40">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>
        <p className="text-[10px] text-slate-500">Suas anotações deste tópico vão junto com a pergunta para a IA.</p>
      </div>
    </section>
  );
}
