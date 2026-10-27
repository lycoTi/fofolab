import { useEffect, useRef, useState } from 'react';
import type { ChatTurn } from '../../lib/aiRouter';
import { askFofoIa } from '../../lib/fofoia/ask';
import type { FofoContext } from '../../lib/fofoia/context';
import { replyTail } from '../../lib/fofoia/cut';
import { matchEditalTopics, type EditalTopicEntry } from '../../lib/fofoia/editalMatch';
import { readLessonPart } from '../../lib/fofoia/lessonPart';
import { chooseMode, shouldSuggestLesson, type FofoMode, type ModeSignals } from '../../lib/fofoia/signals';
import { smallTalkReply } from '../../lib/fofoia/smallTalk';
import { parseSummary, type ReviewSummary } from '../../lib/fofoia/summary';

export interface FofoTurn {
  id: string;
  role: 'student' | 'tutor' | 'notice';
  content: string;
  mode?: FofoMode;
  simulated?: boolean;
  failed?: boolean;
  suggestLesson?: boolean;
  /** Aula em partes: "Parte N de M" lido da resposta. */
  part?: { n: number; total: number } | null;
  summary?: ReviewSummary | null;
  /** Para "Tentar de novo" quando o provedor falha. */
  retry?: { message: string; requested: FofoMode | null; options?: SendOptions };
  /** Cumprimento/agradecimento respondido pelo app: fica fora do histórico mandado à IA e da contagem de perguntas. */
  smallTalk?: boolean;
  /** A IA bateu no teto de tamanho: o texto vai até a última frase completa e dá para pedir o resto. */
  cut?: boolean;
}

export interface SendOptions {
  /** Próxima parte da aula e o total anunciado na Parte 1. */
  part?: number;
  partTotal?: number;
  /** Resposta cortada que a IA deve continuar de onde parou. */
  resumeOf?: FofoTurn;
}

export type BaseSignals = Omit<ModeSignals, 'requested' | 'text' | 'followUps'>;

const isQuestionOpen = (s: BaseSignals) => s.activeQuestion !== null && !s.activeQuestion.answered;

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${(seq += 1)}`;

/** Conversa em andamento neste computador: um F5 (ou fechar e abrir o app) no meio do estudo não a perde. */
export const FOFO_CONVERSATION_KEY = 'fofolab_fofoia_conversa_v1';
/** Depois disso a conversa é dada como encerrada (contado da última mensagem). */
const RESTORE_WINDOW_MS = 20 * 60 * 1000;

function loadSavedTurns(topicKey: string): FofoTurn[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FOFO_CONVERSATION_KEY) ?? 'null') as {
      topicKey?: string;
      savedAt?: number;
      turns?: FofoTurn[];
    } | null;
    if (!raw || raw.topicKey !== topicKey || typeof raw.savedAt !== 'number' || !Array.isArray(raw.turns)) return [];
    if (Date.now() - raw.savedAt > RESTORE_WINDOW_MS) return [];
    return raw.turns;
  } catch {
    return [];
  }
}

/**
 * Conversa da FofoIA (spec 11 §5.3): recomeça quando o tópico muda (o histórico gastaria o limite de uso) e volta
 * depois de recarregar a página por até 20 minutos. Escolhe o jeito pelos sinais, monta o filtro do edital quando é o
 * caso e chama a IA.
 */
export function useFofoConversation(input: {
  topicKey: string;
  topicLabel: string;
  ctx: FofoContext;
  baseSignals: BaseSignals;
  editalTopics: EditalTopicEntry[];
}) {
  const [turns, setTurns] = useState<FofoTurn[]>(() => loadSavedTurns(input.topicKey));
  const [loading, setLoading] = useState(false);
  const previousKey = useRef(input.topicKey);
  // Muda a cada troca de tópico: resposta que chega depois pertence à conversa anterior e é descartada
  const generation = useRef(0);

  useEffect(() => {
    if (previousKey.current === input.topicKey) return;
    previousKey.current = input.topicKey;
    generation.current += 1;
    setLoading(false);
    // Ao recarregar, o painel pode abrir num tópico e só depois ir para o do bloco: a conversa guardada dele volta
    const saved = loadSavedTurns(input.topicKey);
    setTurns((prev) => {
      if (saved.length > 0) return saved;
      return prev.length > 0 ? [{ id: nextId('notice'), role: 'notice', content: `Nova conversa sobre ${input.topicLabel}.` }] : [];
    });
  }, [input.topicKey, input.topicLabel]);

  // Guarda a cada fala, com o tópico dono dessas falas (previousKey já é o novo quando a conversa recomeça)
  useEffect(() => {
    if (turns.length === 0) return;
    try {
      localStorage.setItem(FOFO_CONVERSATION_KEY, JSON.stringify({ topicKey: previousKey.current, savedAt: Date.now(), turns }));
    } catch {
      // Sem localStorage (janela privada): a conversa só não volta depois de recarregar
    }
  }, [turns]);

  const send = async (message: string, requested: FofoMode | null = null, options: SendOptions = {}) => {
    const text = message.trim();
    if (!text || loading) return;
    // Pedido de botão nunca é cumprimento; texto livre que é só "oi" ou "valeu" o próprio app responde
    const local = requested === null ? smallTalkReply(text, { topicLabel: input.topicLabel, questionOpen: isQuestionOpen(input.baseSignals) }) : null;
    if (local) {
      setTurns((prev) => [
        ...prev,
        { id: nextId('s'), role: 'student', content: text, smallTalk: true },
        { id: nextId('t'), role: 'tutor', content: local, smallTalk: true },
      ]);
      return;
    }
    const conversation: ChatTurn[] = turns
      .filter((t) => t.role !== 'notice' && !t.failed && !t.smallTalk)
      .map((t) => ({ id: t.id, role: t.role === 'student' ? 'student' : 'tutor', content: t.content, createdAt: '' }));
    const followUps = turns.filter((t) => t.role === 'student' && !t.smallTalk).length;
    const signals: ModeSignals = { ...input.baseSignals, requested, text, followUps };
    const mode = chooseMode(signals);
    const editalCandidates = mode === 'EDITAL' ? matchEditalTopics(text, input.editalTopics) : undefined;
    const resumeAfter = options.resumeOf ? replyTail(options.resumeOf.content) : undefined;

    setTurns((prev) => [...prev, { id: nextId('s'), role: 'student', content: text }]);
    setLoading(true);
    const myGeneration = generation.current;
    try {
      const hintsGiven = turns.filter((t) => t.mode === 'HINT' && !t.failed).length;
      const reply = await askFofoIa({
        mode,
        ctx: input.ctx,
        conversation,
        message: text,
        extra: { editalCandidates, part: options.part, partTotal: options.partTotal, hintsGiven, resumeAfter },
      });
      if (myGeneration !== generation.current) return;
      if (reply.failed) console.warn('FofoIA: nenhum provedor respondeu.');
      // O resto de uma parte cortada não tem "Parte N de M" no topo: herda a parte, para o "Continuar" aparecer
      const part = mode === 'LESSON' ? (readLessonPart(reply.reply) ?? options.resumeOf?.part ?? null) : null;
      const tutor: FofoTurn = {
        id: nextId('t'),
        role: 'tutor',
        content: reply.reply,
        mode,
        simulated: reply.simulated,
        failed: reply.failed,
        suggestLesson: !reply.failed && mode !== 'HINT' && !options.resumeOf && shouldSuggestLesson(signals),
        part,
        summary: mode === 'SUMMARY' ? parseSummary(reply.reply) : null,
        retry: reply.failed ? { message: text, requested, options } : undefined,
        ...(reply.cut ? { cut: true } : {}),
      };
      setTurns((prev) => [...prev, tutor]);
    } finally {
      if (myGeneration === generation.current) setLoading(false);
    }
  };

  /** Pede o resto de uma resposta cortada no teto de tamanho, no mesmo jeito. */
  const resume = (turn: FofoTurn) => send('Continue de onde parou.', turn.mode ?? null, { resumeOf: turn });

  return { turns, loading, send, resume };
}
