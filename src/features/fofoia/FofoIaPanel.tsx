import { useEffect, useRef, useState } from 'react';
import type { StudentContextSnapshot } from '../../lib/aiRouter';
import { buildFofoContext, type LawExcerpt } from '../../lib/fofoia/context';
import type { EditalTopicEntry } from '../../lib/fofoia/editalMatch';
import type { AiProviderUsed, Question } from '../../types/database';
import { CurrentFofo } from '../mascot/FofoOutfitContext';
import { LawPillsBar } from '../laws/LawPillsBar';
import { CreateFlashcardModal } from './CreateFlashcardModal';
import { FofoInputArea } from './FofoInputArea';
import { FofoMessage } from './FofoMessage';
import { FofoPanelHeader } from './FofoPanelHeader';
import { useFofoConversation, type FofoTurn } from './useFofoConversation';
import { WarmupInvite } from './WarmupInvite';
import { markWarmupSeen, warmupSeen } from './warmup';
import type { FofoActiveQuestion, FofoStudentAttempt } from './fofoTypes';

export type { FofoActiveQuestion, FofoStudentAttempt };

/** Largura mínima da coluna enquanto se lê uma aula completa (spec 11 §5.1). */
export const LESSON_MIN_WIDTH = 560;

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
  onRequestHandled: () => void;
  lawExcerpts?: LawExcerpt[];
  onAutoSaveDissection?: (params: { question: Question; provider: AiProviderUsed; dissectionMarkdown: string }) => void;
  /** Cria um flashcard na revisão do dia a partir de uma resposta da FofoIA */
  onCreateFlashcard?: (params: {
    topicId: string;
    statement: string;
    finalAnswer: string;
    dissectionMarkdown: string;
    options?: string[];
  }) => void;
}

/** FofoIA (spec 11): um só professor na coluna direita, com jeitos de ensinar escolhidos pelos sinais do estudante. */
export function FofoIaPanel(props: FofoIaPanelProps) {
  const { activeQuestion, topicLabel } = props;
  const ctx = buildFofoContext({
    context: props.context,
    notebook: props.notebook,
    activeQuestion: activeQuestion ? { question: activeQuestion.question, answered: activeQuestion.answered, dissection: activeQuestion.dissection, attempt: activeQuestion.attempt } : null,
    prerequisites: props.prerequisites,
    lawExcerpts: props.lawExcerpts,
  });
  const sessionKey = activeQuestion?.question?.id ? `q:${activeQuestion.question.id}` : `t:${props.topicKey}`;
  const { turns, loading, send, sendStored, resume, clear } = useFofoConversation({
    sessionKey,
    topicKey: props.topicKey,
    topicLabel,
    ctx,
    baseSignals: {
      topicMastery: props.context.currentTopicMastery,
      firstContact: props.firstContact,
      activeQuestion: activeQuestion ? { answered: activeQuestion.answered, diagnosis: activeQuestion.diagnosis, falseCertainty: activeQuestion.falseCertainty } : null,
    },
    editalTopics: props.editalTopics,
    onAutoSaveDissection: props.onAutoSaveDissection && activeQuestion
      ? (d) => props.onAutoSaveDissection?.({ question: activeQuestion.question, ...d })
      : undefined,
  });
  const [draft, setDraft] = useState('');
  const [warmup, setWarmup] = useState(false);
  const [flashcardTurn, setFlashcardTurn] = useState<FofoTurn | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const handledRequest = useRef<number | null>(null);
  const unanswered = activeQuestion !== null && !activeQuestion.answered;

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns.length, loading]);

  const talked = turns.some((t) => t.role === 'student' && !t.smallTalk);
  const subject = talked ? `o que conversamos (tópico ${topicLabel})` : topicLabel;

  const startLesson = (part?: number, guess = '', partTotal?: number) => {
    props.onWiden(LESSON_MIN_WIDTH);
    const palpite = guess.trim() ? ` Meu palpite antes da aula: ${guess.trim()}` : '';
    void send(part ? `Continue a aula (Parte ${part})` : `Aula completa sobre ${subject}.${palpite}`, 'LESSON', { part, partTotal });
  };
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
    if (!request || loading || handledRequest.current === request.id) return;
    handledRequest.current = request.id;
    if (request.kind === 'hint') {
      hint();
    } else {
      const stored = activeQuestion?.dissection?.dissection_markdown;
      if (stored && stored.trim()) {
        sendStored('Me explique esta questão e por que as outras alternativas estão erradas.', `**Dissecação oficial do acervo:**\n\n${stored.trim()}`);
      } else {
        void send('Me explique esta questão e por que as outras alternativas estão erradas.', null, { saveAsDissection: true });
      }
    }
    props.onRequestHandled();
  }, [props.request, loading, activeQuestion?.dissection]);

  useEffect(() => setWarmup(false), [props.topicKey]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    void send(text);
    setDraft('');
  };

  const flashcardInitial = flashcardTurn ? (() => {
    const idx = turns.indexOf(flashcardTurn);
    const prev = idx > 0 ? turns.slice(0, idx).reverse().find((t) => t.role === 'student' && !t.smallTalk) : null;
    return {
      statement: prev ? prev.content : '',
      explanation: flashcardTurn.content,
    };
  })() : null;

  return (
    <section aria-label="FofoIA" className="relative flex h-full min-w-0 flex-col bg-slate-900/75">
      <FofoPanelHeader topicLabel={topicLabel} aiConfigured={props.aiConfigured} hasTurns={turns.length > 0} onClear={clear} />
      <LawPillsBar excerpts={props.lawExcerpts} conversationText={turns.length > 0 ? turns.map((t) => t.content).join(' ') : undefined} onWiden={props.onWiden} onSaveToNotebook={props.onSaveSummary} />

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
            onFlashcard={props.onCreateFlashcard ? (t) => setFlashcardTurn(t) : undefined}
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

      <FofoInputArea
        unanswered={unanswered}
        activeQuestion={activeQuestion}
        topicLabel={topicLabel}
        talked={talked}
        draft={draft}
        loading={loading}
        onChangeDraft={setDraft}
        onSubmit={submit}
        onHint={hint}
        onLesson={() => lesson()}
        onSend={(msg, mode, opts) => void send(msg, mode ?? null, opts)}
      />

      {flashcardTurn && (
        <CreateFlashcardModal
          open={Boolean(flashcardTurn)}
          onClose={() => setFlashcardTurn(null)}
          topicLabel={topicLabel}
          initialStatement={flashcardInitial?.statement}
          initialExplanation={flashcardInitial?.explanation}
          onSave={(params) => {
            props.onCreateFlashcard?.({
              topicId: props.topicKey,
              statement: params.statement,
              finalAnswer: params.finalAnswer,
              dissectionMarkdown: params.dissectionMarkdown,
              options: params.options,
            });
          }}
        />
      )}
    </section>
  );
}
