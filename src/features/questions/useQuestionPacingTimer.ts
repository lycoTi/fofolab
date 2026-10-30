import { useCallback, useEffect, useRef, useState } from 'react';
import { formatClock } from '../../lib/timeFormat';

export type PacingTone = 'normal' | 'warning' | 'extended';

export interface UseQuestionPacingTimerOptions {
  /** Identificador da questão ou do item ativo */
  questionId?: string;
  /** Se a questão já foi respondida ou está travada */
  locked?: boolean;
  /** Tempo congelado já gravado (e.g. tentativa anterior ou atual) em segundos */
  frozenSeconds?: number | null;
  /** Se há um bloco de estudo de foco ativo rodando no app (Pomodoro / Ciclo) */
  blockRunning?: boolean;
  /** Limite de inatividade em ms antes de pausar automaticamente (default: 60_000ms = 60s) */
  idleTimeoutMs?: number;
  /** Limiar de atenção ao ritmo em segundos (padrão: 120s = 2 min) */
  warningSeconds?: number;
  /** Limiar de tempo estendido em segundos (padrão: 180s = 3 min) */
  extendedSeconds?: number;
}

export interface UseQuestionPacingTimerResult {
  /** Segundos decorridos ou congelados */
  seconds: number;
  /** Formatação em mm:ss (ex.: "01:24") */
  formatted: string;
  /** Tom visual do ritmo */
  tone: PacingTone;
  /** Classe CSS Tailwind para cor e sutileza */
  toneClass: string;
  /** Se o cronômetro está ativamente contando */
  isRunning: boolean;
  /** Se o cronômetro está pausado (manualmente ou por inatividade/aba) */
  isPaused: boolean;
  /** Se está pausado por ausência/inatividade de mouse e teclado */
  isIdle: boolean;
  /** Se está pausado porque a aba foi trocada ou minimizada */
  isTabHidden: boolean;
  /** Se está aguardando o início de um bloco de foco (estudo livre) */
  isWaitingBlock: boolean;
  /** Texto para leitor de tela */
  ariaLabel: string;
  /** Dica contextual de ritmo de prova */
  tooltip: string;
  /** Alterna play / pausa manualmente */
  togglePlayPause: () => void;
}

const DEFAULT_WARNING_SECONDS = 120; // 2 minutos
const DEFAULT_EXTENDED_SECONDS = 180; // 3 minutos
const DEFAULT_IDLE_TIMEOUT_MS = 60_000; // 60 segundos

function resolvePacingTone(seconds: number, warningLimit: number, extendedLimit: number): PacingTone {
  if (seconds > extendedLimit) return 'extended';
  if (seconds >= warningLimit) return 'warning';
  return 'normal';
}

function resolveToneClass(tone: PacingTone): string {
  switch (tone) {
    case 'extended':
      return 'text-rose-400';
    case 'warning':
      return 'text-amber-400';
    case 'normal':
    default:
      return 'text-slate-400';
  }
}

/**
 * Hook de Cronômetro de Ritmo de Prova (Time Pacing):
 * Cronômetro progressivo em mm:ss com detecção real de presença (visibilidade da aba
 * e inatividade de mouse/teclado), integração transparente com blocos de estudo
 * e controle manual tátil.
 */
export function useQuestionPacingTimer(options: UseQuestionPacingTimerOptions): UseQuestionPacingTimerResult {
  const {
    questionId,
    locked = false,
    frozenSeconds = null,
    blockRunning = false,
    idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
    warningSeconds = DEFAULT_WARNING_SECONDS,
    extendedSeconds = DEFAULT_EXTENDED_SECONDS,
  } = options;

  const [seconds, setSeconds] = useState<number>(() => {
    if (locked && frozenSeconds !== null && frozenSeconds !== undefined) {
      return frozenSeconds;
    }
    return 0;
  });

  const [manualActive, setManualActive] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false
  );

  const lastActivityRef = useRef<number>(Date.now());
  const lastQuestionIdRef = useRef<string | undefined>(questionId);

  // Reinicia estados ao trocar de questão
  useEffect(() => {
    if (questionId !== lastQuestionIdRef.current) {
      lastQuestionIdRef.current = questionId;
      setManualActive(false);
      setIsManuallyPaused(false);
      setIsIdle(false);
      lastActivityRef.current = Date.now();
      if (locked && frozenSeconds !== null && frozenSeconds !== undefined) {
        setSeconds(frozenSeconds);
      } else {
        setSeconds(0);
      }
    }
  }, [questionId, locked, frozenSeconds]);

  // Atualiza segundos se vier com frozenSeconds
  useEffect(() => {
    if (locked && frozenSeconds !== null && frozenSeconds !== undefined) {
      setSeconds(frozenSeconds);
    }
  }, [locked, frozenSeconds]);

  // Monitora visibilidade da aba (segundo plano / tela suspensa)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.visibilityState === 'hidden';
      setIsTabHidden(hidden);
      if (!hidden) {
        lastActivityRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Monitora atividade do usuário (mouse, teclado, rolagem) para detectar ociosidade
  useEffect(() => {
    if (locked) return;

    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
      setIsIdle(false);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'] as const;
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
    };
  }, [locked]);

  // Condição de execução: destravado + (bloco rodando ou play manual) + sem pausas
  const isEnabled = blockRunning || manualActive;
  const isRunning = !locked && isEnabled && !isManuallyPaused && !isIdle && !isTabHidden;
  const isPaused = !locked && (!isEnabled || isManuallyPaused || isIdle || isTabHidden);
  const isWaitingBlock = !locked && !isEnabled;

  // Intervalo de contagem de tempo e checagem de inatividade
  useEffect(() => {
    if (locked) return;

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const isIdleNow = now - lastActivityRef.current >= idleTimeoutMs;
      if (isIdleNow) {
        setIsIdle(true);
      }

      if (isRunning && !isIdleNow) {
        setSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [locked, isRunning, idleTimeoutMs]);

  const togglePlayPause = useCallback(() => {
    if (locked) return;
    lastActivityRef.current = Date.now();
    setIsIdle(false);

    if (blockRunning) {
      setIsManuallyPaused((prev) => !prev);
    } else {
      // Estudo avulso fora de bloco: ativação manual
      if (manualActive && !isManuallyPaused) {
        setIsManuallyPaused(true);
      } else {
        setManualActive(true);
        setIsManuallyPaused(false);
      }
    }
  }, [locked, blockRunning, manualActive, isManuallyPaused]);

  const tone = resolvePacingTone(seconds, warningSeconds, extendedSeconds);
  const toneClass = resolveToneClass(tone);
  const formatted = formatClock(seconds * 1000);

  let tooltip = 'Ritmo ideal de prova (até 2 min)';
  if (tone === 'warning') tooltip = 'Atenção ao ritmo de prova (2 a 3 min)';
  if (tone === 'extended') tooltip = 'Tempo estendido nesta questão (> 3 min)';

  if (locked) {
    tooltip = `Tempo final: ${formatted} (${tooltip})`;
  } else if (isIdle) {
    tooltip = `Pausado por inatividade (${formatted}) · Mova o mouse para retomar`;
  } else if (isTabHidden) {
    tooltip = `Pausado em segundo plano (${formatted})`;
  } else if (isWaitingBlock) {
    tooltip = `Ritmo de prova: aguardando início do bloco de foco (ou clique para iniciar)`;
  } else if (isManuallyPaused) {
    tooltip = `Pausado manualmente (${formatted}) · Clique para retomar`;
  }

  const ariaLabel = locked
    ? `Tempo final de resolução: ${formatted}`
    : `Tempo decorrido: ${formatted}`;

  return {
    seconds,
    formatted,
    tone,
    toneClass,
    isRunning,
    isPaused,
    isIdle,
    isTabHidden,
    isWaitingBlock,
    ariaLabel,
    tooltip,
    togglePlayPause,
  };
}
