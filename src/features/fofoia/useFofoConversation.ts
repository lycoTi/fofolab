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

/** Conversas em andamento neste computador: mapa indexado por questão ou tópico para não perder nem misturar contextos. */
export const FOFO_CONVERSATION_KEY = 'fofolab_fofoia_conversa_v1';
/** Depois disso a conversa é dada como encerrada (contado da última mensagem). */
const RESTORE_WINDOW_MS = 20 * 60 * 1000;

interface SavedSession {
  savedAt: number;
  turns: FofoTurn[];
}

type SavedSessionsMap = Record<string, SavedSession>;

function loadAllSavedSessions(): SavedSessionsMap {
  try {
    const raw = JSON.parse(localStorage.getItem(FOFO_CONVERSATION_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return {};
    // Retrocompatibilidade se tiver formato legado { topicKey, savedAt, turns }
    if ('topicKey' in raw && Array.isArray((raw as { turns?: unknown }).turns)) {
      const leg = raw as { topicKey?: string; savedAt?: number; turns: FofoTurn[] };
      return { [`t:${leg.topicKey}`]: { savedAt: leg.savedAt ?? Date.now(), turns: leg.turns } };
    }
    return raw as SavedSessionsMap;
  } catch {
    return {};
  }
}

export function loadSavedTurns(sessionKey: string): FofoTurn[] {
  const sessions = loadAllSavedSessions();
  const session = sessions[sessionKey];
  if (!session || typeof session.savedAt !== 'number' || !Array.isArray(session.turns)) return [];
  if (Date.now() - session.savedAt > RESTORE_WINDOW_MS) return [];
  return session.turns;
}

function saveSessionTurns(sessionKey: string, turns: FofoTurn[]) {
  try {
    const sessions = loadAllSavedSessions();
    if (turns.length === 0) {
      delete sessions[sessionKey];
    } else {
      sessions[sessionKey] = { savedAt: Date.now(), turns };
    }
    // Retém até 50 sessões recentes ativas no limite de 20 minutos para segurar espaço
    const entries = Object.entries(sessions)
      .filter(([, s]) => Date.now() - s.savedAt <= RESTORE_WINDOW_MS)
      .sort((a, b) => b[1].savedAt - a[1].savedAt)
      .slice(0, 50);
    localStorage.setItem(FOFO_CONVERSATION_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Sem localStorage (janela privada)
  }
}

/**
 * Conversa da FofoIA: isolada por questão ativa (ou tópico em navegação livre) para não poluir
 * o contexto nem gastar tokens desnecessários. Limpa a lousa ao avançar para nova questão e restaura ao voltar.
 */
export function useFofoConversation(input: {
  sessionKey?: string;
  topicKey: string;
  topicLabel: string;
  ctx: FofoContext;
  baseSignals: BaseSignals;
  editalTopics: EditalTopicEntry[];
}) {
  const currentKey = input.sessionKey ?? `t:${input.topicKey}`;
  const [turns, setTurns] = useState<FofoTurn[]>(() => loadSavedTurns(currentKey));
  const [loading, setLoading] = useState(false);
  const previousSessionKey = useRef(currentKey);
  const previousTopicKey = useRef(input.topicKey);
  // Muda a cada troca de contexto: resposta que chega depois pertence à conversa anterior e é descartada
  const generation = useRef(0);

  useEffect(() => {
    const key = input.sessionKey ?? `t:${input.topicKey}`;
    if (previousSessionKey.current === key) return;
    const topicChanged = previousTopicKey.current !== input.topicKey;
    previousSessionKey.current = key;
    previousTopicKey.current = input.topicKey;
    generation.current += 1;
    setLoading(false);

    const saved = loadSavedTurns(key);
    setTurns((prev) => {
      if (saved.length > 0) return saved;
      if (topicChanged && prev.length > 0) {
        return [{ id: nextId('notice'), role: 'notice', content: `Nova conversa sobre ${input.topicLabel}.` }];
      }
      return [];
    });
  }, [input.sessionKey, input.topicKey, input.topicLabel]);

  // Guarda a cada fala na sessão ativa correspondente
  useEffect(() => {
    saveSessionTurns(previousSessionKey.current, turns);
  }, [turns]);

  const clear = () => {
    setTurns([]);
    saveSessionTurns(previousSessionKey.current, []);
  };

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

  const sendStored = (studentText: string, replyText: string) => {
    const student = studentText.trim();
    const reply = replyText.trim();
    if (!student || !reply) return;
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'tutor' && last.content.includes(reply)) return prev;
      return [
        ...prev,
        { id: nextId('s'), role: 'student', content: student },
        {
          id: nextId('t'),
          role: 'tutor',
          content: reply,
          mode: 'QUICK',
          simulated: false,
        },
      ];
    });
  };

  return { turns, loading, send, sendStored, resume, clear };
}
