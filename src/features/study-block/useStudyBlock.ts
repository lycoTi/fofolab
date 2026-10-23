import { useCallback, useEffect, useRef, useState } from 'react';
import {
  initialBlockState,
  stepBlock,
  type BlockAction,
  type BlockMode,
  type BlockState,
  type BlockTarget,
  type RecordedSession,
} from './studyBlockMachine';

const TICK_MS = 500;
const MESSAGE_MS = 5000;

export interface StudyBlockController {
  state: BlockState;
  now: number;
  message: string | null;
  start: (block: BlockTarget) => void;
  pause: () => void;
  /** Pausa automática (olhada fora do roteiro): não conta como atrito do estudante. */
  pauseSilently: () => void;
  resume: () => void;
  next: () => void;
  finish: () => void;
  skip: () => void;
  reset: () => void;
  setMode: (mode: BlockMode, focusMinutes: number) => void;
  /** Quem grava os trechos de foco (o App define depois de montar os dados). */
  onRecordedRef: React.MutableRefObject<(session: RecordedSession) => void>;
}

/** Um único bloco de estudo para o app inteiro: o cartão grande e o relógio do cabeçalho mostram o mesmo. */
export function useStudyBlock(): StudyBlockController {
  const [state, setState] = useState<BlockState>(initialBlockState);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const stateRef = useRef(state);
  const onRecordedRef = useRef<(session: RecordedSession) => void>(() => {});

  const dispatch = useCallback((action: BlockAction) => {
    const step = stepBlock(stateRef.current, action);
    stateRef.current = step.state;
    setState(step.state);
    setNow(Date.now());
    if (step.recorded) onRecordedRef.current(step.recorded);
    if (step.message) setMessage(step.message);
  }, []);

  useEffect(() => {
    if (!state.running) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      dispatch({ type: 'TICK', now: current });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [state.running, dispatch]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  return {
    state,
    now,
    message,
    start: (block) => dispatch({ type: 'START', block, now: Date.now() }),
    pause: () => dispatch({ type: 'PAUSE', now: Date.now() }),
    pauseSilently: () => dispatch({ type: 'PAUSE', now: Date.now(), silent: true }),
    resume: () => dispatch({ type: 'RESUME', now: Date.now() }),
    next: () => dispatch({ type: 'NEXT', now: Date.now() }),
    finish: () => dispatch({ type: 'FINISH', now: Date.now() }),
    skip: () => dispatch({ type: 'SKIP', now: Date.now() }),
    reset: () => dispatch({ type: 'RESET' }),
    setMode: (mode, focusMinutes) => dispatch({ type: 'SET_MODE', mode, focusMinutes }),
    onRecordedRef,
  };
}
