import { useEffect, useRef, useState } from 'react';
import type { ChatTurn } from '../../lib/aiRouter';
import { askFofoIa } from '../../lib/fofoia/ask';
import type { FofoContext } from '../../lib/fofoia/context';
import { matchEditalTopics, type EditalTopicEntry } from '../../lib/fofoia/editalMatch';
import { readLessonPart } from '../../lib/fofoia/lessonPart';
import { chooseMode, shouldSuggestLesson, type FofoMode, type ModeSignals } from '../../lib/fofoia/signals';
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
  retry?: { message: string; requested: FofoMode | null; part?: number };
}

export type BaseSignals = Omit<ModeSignals, 'requested' | 'text' | 'followUps'>;

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${(seq += 1)}`;

/**
 * Conversa da FofoIA (spec 11 §5.3): fica só na memória e recomeça quando o tópico muda (o histórico gastaria o limite
 * de uso). Escolhe o jeito pelos sinais, monta o filtro do edital quando é o caso e chama a IA.
 */
export function useFofoConversation(input: {
  topicKey: string;
  topicLabel: string;
  ctx: FofoContext;
  baseSignals: BaseSignals;
  editalTopics: EditalTopicEntry[];
}) {
  const [turns, setTurns] = useState<FofoTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const previousKey = useRef(input.topicKey);
  // Muda a cada troca de tópico: resposta que chega depois pertence à conversa anterior e é descartada
  const generation = useRef(0);

  useEffect(() => {
    if (previousKey.current === input.topicKey) return;
    previousKey.current = input.topicKey;
    generation.current += 1;
    setLoading(false);
    setTurns((prev) => (prev.length > 0 ? [{ id: nextId('notice'), role: 'notice', content: `Nova conversa sobre ${input.topicLabel}.` }] : []));
  }, [input.topicKey, input.topicLabel]);

  const send = async (message: string, requested: FofoMode | null = null, part?: number) => {
    const text = message.trim();
    if (!text || loading) return;
    const conversation: ChatTurn[] = turns
      .filter((t) => t.role !== 'notice' && !t.failed)
      .map((t) => ({ id: t.id, role: t.role === 'student' ? 'student' : 'tutor', content: t.content, createdAt: '' }));
    const followUps = turns.filter((t) => t.role === 'student').length;
    const signals: ModeSignals = { ...input.baseSignals, requested, text, followUps };
    const mode = chooseMode(signals);
    const editalCandidates = mode === 'EDITAL' ? matchEditalTopics(text, input.editalTopics) : undefined;

    setTurns((prev) => [...prev, { id: nextId('s'), role: 'student', content: text }]);
    setLoading(true);
    const myGeneration = generation.current;
    try {
      const hintsGiven = turns.filter((t) => t.mode === 'HINT' && !t.failed).length;
      const reply = await askFofoIa({ mode, ctx: input.ctx, conversation, message: text, extra: { editalCandidates, part, hintsGiven } });
      if (myGeneration !== generation.current) return;
      if (reply.failed) console.warn('FofoIA: nenhum provedor respondeu.');
      const tutor: FofoTurn = {
        id: nextId('t'),
        role: 'tutor',
        content: reply.reply,
        mode,
        simulated: reply.simulated,
        failed: reply.failed,
        suggestLesson: !reply.failed && mode !== 'HINT' && shouldSuggestLesson(signals),
        part: mode === 'LESSON' ? readLessonPart(reply.reply) : null,
        summary: mode === 'SUMMARY' ? parseSummary(reply.reply) : null,
        retry: reply.failed ? { message: text, requested, part } : undefined,
      };
      setTurns((prev) => [...prev, tutor]);
    } finally {
      if (myGeneration === generation.current) setLoading(false);
    }
  };

  return { turns, loading, send };
}
