import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_POMODORO_SETTINGS,
  initialBlockState,
  stepBlock,
  type BlockAction,
  type BlockMode,
  type BlockState,
  type BlockTarget,
  type PomodoroSettings,
  type RecordedSession,
} from './studyBlockMachine';

const TICK_MS = 500;
/** O aviso (toast) some sozinho depois disso. */
export const MESSAGE_MS = 7000;
/** Preferências do FofoDoro neste computador (conforto, como a largura das colunas — não é dado de estudo). */
export const POMODORO_PREFS_KEY = 'fofolab_pomodoro_v1';
/**
 * Bloco em andamento neste computador: recarregar a página (ou o app) volta ao mesmo bloco. O tempo estudado já vai
 * para o banco a cada trecho; aqui fica só o relógio do trecho atual, com horários absolutos.
 */
export const STUDY_BLOCK_KEY = 'fofolab_study_block_v1';
/** Guardado há mais que isso não volta: ninguém estudou com o app fechado esse tempo todo (maior foco + pausa longa). */
const MAX_RESTORE_GAP_MS = 3 * 60 * 60 * 1000;

interface PomodoroPrefs {
  mode: BlockMode;
  focusMinutes: number;
  settings: PomodoroSettings;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

/** Lê as preferências salvas; qualquer valor estranho volta ao padrão (o arquivo pode ter sido editado à mão). */
export function loadPomodoroPrefs(): PomodoroPrefs {
  const fallback: PomodoroPrefs = { mode: initialBlockState.mode, focusMinutes: initialBlockState.focusMinutes, settings: DEFAULT_POMODORO_SETTINGS };
  try {
    const raw = JSON.parse(localStorage.getItem(POMODORO_PREFS_KEY) ?? 'null') as Partial<PomodoroPrefs> | null;
    if (!raw) return fallback;
    const s = raw.settings ?? DEFAULT_POMODORO_SETTINGS;
    return {
      mode: raw.mode === 'LIVRE' ? 'LIVRE' : 'POMODORO',
      focusMinutes: clamp(raw.focusMinutes === 20 ? 25 : raw.focusMinutes, 10, 90, fallback.focusMinutes),
      settings: {
        shortBreakMinutes: s.shortBreakMinutes == null ? null : clamp(s.shortBreakMinutes, 3, 15, 5),
        longBreakMinutes: clamp(s.longBreakMinutes, 10, 30, DEFAULT_POMODORO_SETTINGS.longBreakMinutes),
        longEvery: clamp(s.longEvery, 2, 6, DEFAULT_POMODORO_SETTINGS.longEvery),
      },
    };
  } catch {
    return fallback;
  }
}

/** Bloco guardado por `STUDY_BLOCK_KEY`, se ainda vale (em andamento e guardado há menos de 3 horas). */
function loadSavedBlock(now: number): BlockState | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STUDY_BLOCK_KEY) ?? 'null') as { state?: BlockState; savedAt?: number } | null;
    if (!raw?.state?.block || typeof raw.savedAt !== 'number') return null;
    if (now - raw.savedAt > MAX_RESTORE_GAP_MS) return null;
    if (raw.state.phase === 'IDLE' || raw.state.phase === 'DONE') return null;
    return raw.state;
  } catch {
    return null;
  }
}

export interface StudyBlockController {
  state: BlockState;
  now: number;
  message: string | null;
  /** Muda a cada aviso novo (o mesmo texto duas vezes seguidas também aparece de novo). */
  messageId: number;
  dismissMessage: () => void;
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
  setSettings: (settings: PomodoroSettings) => void;
  /** Quem grava os trechos de foco (o App define depois de montar os dados). */
  onRecordedRef: React.MutableRefObject<(session: RecordedSession) => void>;
}

/** Um único bloco de estudo para o app inteiro: o FofoDoro e o relógio do cabeçalho mostram o mesmo. */
export function useStudyBlock(options: { ticking?: boolean } = {}): StudyBlockController {
  // ticking = false até o banco abrir: um pomodoro que terminou com a página fechada só é gravado com o banco pronto
  const ticking = options.ticking ?? true;
  const [state, setState] = useState<BlockState>(() => loadSavedBlock(Date.now()) ?? { ...initialBlockState, ...loadPomodoroPrefs() });
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);
  const stateRef = useRef(state);
  const messageIdRef = useRef(0);
  const onRecordedRef = useRef<(session: RecordedSession) => void>(() => {});

  const dispatch = useCallback((action: BlockAction) => {
    const step = stepBlock(stateRef.current, action);
    stateRef.current = step.state;
    setState(step.state);
    setNow(Date.now());
    if (step.recorded) onRecordedRef.current(step.recorded);
    if (step.message) {
      messageIdRef.current += 1;
      setMessage({ text: step.message, id: messageIdRef.current });
    }
  }, []);

  useEffect(() => {
    if (!state.running || !ticking) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      dispatch({ type: 'TICK', now: current });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [state.running, ticking, dispatch]);

  // Guarda o bloco em andamento a cada mudança; concluído ou zerado, apaga
  useEffect(() => {
    try {
      if (state.block && state.phase !== 'IDLE' && state.phase !== 'DONE') {
        localStorage.setItem(STUDY_BLOCK_KEY, JSON.stringify({ state, savedAt: Date.now() }));
      } else {
        localStorage.removeItem(STUDY_BLOCK_KEY);
      }
    } catch {
      // Sem localStorage (janela privada): o bloco só não volta depois de recarregar
    }
  }, [state]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  // Lembra o jeito de estudar e os ajustes do FofoDoro neste computador
  useEffect(() => {
    try {
      const prefs: PomodoroPrefs = { mode: state.mode, focusMinutes: state.focusMinutes, settings: state.settings };
      localStorage.setItem(POMODORO_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Sem localStorage (janela privada): as preferências só não são lembradas
    }
  }, [state.mode, state.focusMinutes, state.settings]);

  return {
    state,
    now,
    message: message?.text ?? null,
    messageId: message?.id ?? 0,
    dismissMessage: () => setMessage(null),
    start: (block) => dispatch({ type: 'START', block, now: Date.now() }),
    pause: () => dispatch({ type: 'PAUSE', now: Date.now() }),
    pauseSilently: () => dispatch({ type: 'PAUSE', now: Date.now(), silent: true }),
    resume: () => dispatch({ type: 'RESUME', now: Date.now() }),
    next: () => dispatch({ type: 'NEXT', now: Date.now() }),
    finish: () => dispatch({ type: 'FINISH', now: Date.now() }),
    skip: () => dispatch({ type: 'SKIP', now: Date.now() }),
    reset: () => dispatch({ type: 'RESET' }),
    setMode: (mode, focusMinutes) => dispatch({ type: 'SET_MODE', mode, focusMinutes }),
    setSettings: (settings) => dispatch({ type: 'SET_SETTINGS', settings }),
    onRecordedRef,
  };
}
