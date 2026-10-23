import { useEffect, useRef, useState } from 'react';
import type { Topic } from '../../types/database';
import type { StudyBlockController } from '../study-block/useStudyBlock';

/**
 * "Olhada" (spec 09): o estudante abre um tópico fora do bloco de hoje. Navegar não é estudar, então
 * o relógio do bloco pausa sozinho — sem penalidade — e volta a contar ao voltar para o bloco.
 */
export type PeekKind = 'none' | 'sibling' | 'outside';

/** Depois de 3 min olhando, uma única linha lembra que o bloco está esperando. */
export const PEEK_NUDGE_MS = 180_000;

export function peekKind(selected: Topic | null, blockTopic: Topic | null): PeekKind {
  if (!selected || !blockTopic || selected.id === blockTopic.id) return 'none';
  if (selected.parent_id && selected.parent_id === blockTopic.parent_id) return 'sibling';
  return 'outside';
}

export function usePeek(params: { selectedTopic: Topic | null; blockTopic: Topic | null; studyBlock: StudyBlockController }) {
  const { selectedTopic, blockTopic, studyBlock } = params;
  const kind = peekKind(selectedTopic, blockTopic);
  const peeking = kind !== 'none';
  const { running, phase, block } = studyBlock.state;

  const [pausedByPeek, setPausedByPeek] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const wasPeeking = useRef(peeking);
  const wasRunning = useRef(running);

  // 1. Entrar na olhada pausa o bloco do roteiro em foco; voltar retoma só o que a olhada pausou
  useEffect(() => {
    if (peeking === wasPeeking.current) return;
    wasPeeking.current = peeking;
    if (peeking) {
      const isRoutineBlock = block?.topicId === blockTopic?.id;
      if (phase === 'FOCUS' && running && isRoutineBlock) {
        studyBlock.pauseSilently();
        setPausedByPeek(true);
      }
      return;
    }
    if (pausedByPeek) {
      studyBlock.resume();
      setPausedByPeek(false);
    }
  }, [peeking, phase, running, block, blockTopic, pausedByPeek, studyBlock]);

  // 2. Se o estudante retomar o relógio à mão durante a olhada, a volta não mexe mais nele
  useEffect(() => {
    const resumedByHand = !wasRunning.current && running;
    wasRunning.current = running;
    if (resumedByHand && pausedByPeek) setPausedByPeek(false);
  }, [running, pausedByPeek]);

  // 3. Dica única depois de PEEK_NUDGE_MS de olhada contínua
  useEffect(() => {
    if (!peeking) {
      setShowNudge(false);
      return;
    }
    const timer = window.setTimeout(() => setShowNudge(true), PEEK_NUDGE_MS);
    return () => window.clearTimeout(timer);
  }, [peeking]);

  return { kind, pausedByPeek, showNudge };
}
