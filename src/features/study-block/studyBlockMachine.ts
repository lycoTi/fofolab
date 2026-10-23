/**
 * Bloco de estudo (docs/specs/07, revisão da tela do ciclo): uma matéria/tópico com uma meta de tempo,
 * feita em pomodoros de 20, 30 ou 50 min (com pausas) ou no modo livre (relógio corrido até a meta).
 *
 * Máquina pura: o horário (`now`) entra em cada ação, então o tempo segue o relógio real — não para
 * quando a tela re-renderiza nem atrasa com a janela minimizada. Cada trecho de foco terminado vira um
 * registro de estudo na matéria/tópico em que o bloco COMEÇOU.
 */

export type BlockMode = 'POMODORO' | 'LIVRE';
export const FOCUS_OPTIONS = [20, 30, 50] as const;
const MINUTE_MS = 60_000;

export function breakMinutesFor(focusMinutes: number): number {
  return focusMinutes >= 50 ? 10 : 5;
}

/** Quantos pomodoros cobrem a meta (108 min em pomodoros de 30 → 4). */
export function pomodoroCount(targetMinutes: number | null, focusMinutes: number): number {
  if (!targetMinutes) return 1;
  return Math.max(1, Math.round(targetMinutes / focusMinutes));
}

export interface BlockTarget {
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicCode: string | null;
  topicTitle: string | null;
  /** Meta do bloco; null = sem meta (um pomodoro, ou relógio livre sem fim). */
  targetMinutes: number | null;
}

export type BlockPhase = 'IDLE' | 'FOCUS' | 'BREAK' | 'READY' | 'DONE';

export interface BlockState {
  block: BlockTarget | null;
  mode: BlockMode;
  focusMinutes: number;
  phase: BlockPhase;
  /** false = pausado (em FOCUS ou BREAK). */
  running: boolean;
  phaseEndsAt: number | null;
  /** Tempo que faltava da fase quando foi pausada. */
  pausedRemainingMs: number | null;
  segmentStartedAt: number | null;
  segmentFocusedMs: number;
  segmentPauses: number;
  completedPomodoros: number;
  /** Foco já gravado neste bloco (trechos terminados). */
  blockFocusedMs: number;
}

export interface RecordedSession {
  subjectId: string;
  topicId: string | null;
  durationMinutes: number;
  pausesCount: number;
  wasSkipped: boolean;
}

export type BlockAction =
  | { type: 'START'; block: BlockTarget; now: number }
  | { type: 'SET_MODE'; mode: BlockMode; focusMinutes: number }
  /** silent: pausa automática (olhada fora do roteiro) — não conta como atrito do estudante. */
  | { type: 'PAUSE'; now: number; silent?: boolean }
  | { type: 'RESUME'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'NEXT'; now: number }
  | { type: 'FINISH'; now: number }
  | { type: 'SKIP'; now: number }
  | { type: 'RESET' };

export interface BlockStep {
  state: BlockState;
  recorded: RecordedSession | null;
  message: string | null;
}

export const initialBlockState: BlockState = {
  block: null,
  mode: 'POMODORO',
  focusMinutes: 30,
  phase: 'IDLE',
  running: false,
  phaseEndsAt: null,
  pausedRemainingMs: null,
  segmentStartedAt: null,
  segmentFocusedMs: 0,
  segmentPauses: 0,
  completedPomodoros: 0,
  blockFocusedMs: 0,
};

export function focusedSegmentMs(state: BlockState, now: number): number {
  const live = state.phase === 'FOCUS' && state.running && state.segmentStartedAt !== null ? now - state.segmentStartedAt : 0;
  return state.segmentFocusedMs + live;
}

export function totalPomodoros(state: BlockState): number {
  const planned = pomodoroCount(state.block?.targetMinutes ?? null, state.focusMinutes);
  return Math.max(planned, state.completedPomodoros + (state.phase === 'FOCUS' ? 1 : 0));
}

/**
 * Fração (0..1) da fase em andamento, para a barrinha do relógio: o pomodoro ou a pausa; no modo livre,
 * o foco do bloco sobre a meta. null quando não há o que medir (parado, pronto, livre sem meta).
 */
export function phaseProgress(state: BlockState, now: number): number | null {
  const remaining = phaseRemainingMs(state, now);
  if (state.phase === 'FOCUS' && state.mode === 'POMODORO' && remaining !== null) {
    return 1 - remaining / (state.focusMinutes * MINUTE_MS);
  }
  if (state.phase === 'BREAK' && remaining !== null) {
    return 1 - remaining / (breakMinutesFor(state.focusMinutes) * MINUTE_MS);
  }
  const target = state.block?.targetMinutes ?? null;
  if (state.phase === 'FOCUS' && state.mode === 'LIVRE' && target) {
    return Math.min(1, (state.blockFocusedMs + focusedSegmentMs(state, now)) / (target * MINUTE_MS));
  }
  return null;
}

/** Tempo que falta da fase atual (pomodoro/pausa), ou null no modo livre. */
export function phaseRemainingMs(state: BlockState, now: number): number | null {
  if (state.pausedRemainingMs !== null) return state.pausedRemainingMs;
  if (state.phaseEndsAt !== null) return Math.max(0, state.phaseEndsAt - now);
  return null;
}

function startFocus(state: BlockState, now: number): BlockState {
  return {
    ...state,
    phase: 'FOCUS',
    running: true,
    segmentStartedAt: now,
    segmentFocusedMs: 0,
    segmentPauses: 0,
    pausedRemainingMs: null,
    phaseEndsAt: state.mode === 'POMODORO' ? now + state.focusMinutes * MINUTE_MS : null,
  };
}

/** Fecha o trecho de foco atual: devolve o registro (se teve ao menos 1 minuto) e o estado sem o trecho. */
function closeSegment(state: BlockState, now: number, wasSkipped: boolean): { state: BlockState; recorded: RecordedSession | null } {
  const focusedMs = focusedSegmentMs(state, now);
  const minutes = Math.floor(focusedMs / MINUTE_MS);
  const recorded =
    state.block && (minutes >= 1 || wasSkipped)
      ? {
          subjectId: state.block.subjectId,
          topicId: state.block.topicId,
          durationMinutes: minutes,
          pausesCount: state.segmentPauses + (wasSkipped ? 1 : 0),
          wasSkipped,
        }
      : null;
  return {
    recorded,
    state: {
      ...state,
      segmentStartedAt: null,
      segmentFocusedMs: 0,
      segmentPauses: 0,
      blockFocusedMs: state.blockFocusedMs + (minutes >= 1 ? minutes * MINUTE_MS : 0),
    },
  };
}

const idle = (state: BlockState): BlockState => ({
  ...initialBlockState,
  mode: state.mode,
  focusMinutes: state.focusMinutes,
});

export function stepBlock(state: BlockState, action: BlockAction): BlockStep {
  const result = (next: BlockState, recorded: RecordedSession | null = null, message: string | null = null): BlockStep => ({
    state: next,
    recorded,
    message,
  });

  switch (action.type) {
    case 'START':
      return result(startFocus({ ...idle(state), block: action.block }, action.now));

    case 'SET_MODE':
      if (state.phase === 'FOCUS' || state.phase === 'BREAK') return result(state);
      return result({ ...state, mode: action.mode, focusMinutes: action.focusMinutes });

    case 'PAUSE': {
      if (!state.running || (state.phase !== 'FOCUS' && state.phase !== 'BREAK')) return result(state);
      const inFocus = state.phase === 'FOCUS';
      return result({
        ...state,
        running: false,
        segmentFocusedMs: focusedSegmentMs(state, action.now),
        segmentStartedAt: null,
        segmentPauses: state.segmentPauses + (inFocus && !action.silent ? 1 : 0),
        pausedRemainingMs: state.phaseEndsAt !== null ? Math.max(0, state.phaseEndsAt - action.now) : null,
        phaseEndsAt: null,
      });
    }

    case 'RESUME':
      if (state.running || (state.phase !== 'FOCUS' && state.phase !== 'BREAK')) return result(state);
      return result({
        ...state,
        running: true,
        segmentStartedAt: state.phase === 'FOCUS' ? action.now : null,
        phaseEndsAt: state.pausedRemainingMs !== null ? action.now + state.pausedRemainingMs : null,
        pausedRemainingMs: null,
      });

    case 'TICK': {
      if (!state.running || state.phaseEndsAt === null || action.now < state.phaseEndsAt) return result(state);
      if (state.phase === 'BREAK') {
        return result({ ...state, phase: 'READY', running: false, phaseEndsAt: null }, null, 'Pausa terminada. Pronto para o próximo pomodoro?');
      }
      // Fim de um pomodoro: grava o trecho e vai para a pausa (ou encerra o bloco)
      const closed = closeSegment({ ...state, phaseEndsAt: null }, state.phaseEndsAt, false);
      const completedPomodoros = state.completedPomodoros + 1;
      const planned = pomodoroCount(state.block?.targetMinutes ?? null, state.focusMinutes);
      if (completedPomodoros >= planned) {
        return result({ ...closed.state, completedPomodoros, phase: 'DONE', running: false }, closed.recorded, 'Bloco concluído!');
      }
      return result(
        {
          ...closed.state,
          completedPomodoros,
          phase: 'BREAK',
          running: true,
          phaseEndsAt: state.phaseEndsAt + breakMinutesFor(state.focusMinutes) * MINUTE_MS,
        },
        closed.recorded,
        `Pomodoro ${completedPomodoros} de ${planned} concluído. Hora da pausa.`
      );
    }

    case 'NEXT':
      if (state.phase !== 'READY' && state.phase !== 'BREAK') return result(state);
      return result(startFocus(state, action.now));

    case 'FINISH': {
      if (state.phase === 'IDLE' || state.phase === 'DONE') return result(state);
      const closed = closeSegment(state, action.now, false);
      const message = closed.recorded || closed.state.blockFocusedMs > 0 ? 'Bloco concluído!' : 'Menos de 1 minuto de foco — nada foi registrado.';
      return result({ ...closed.state, phase: 'DONE', running: false, phaseEndsAt: null, pausedRemainingMs: null }, closed.recorded, message);
    }

    case 'SKIP': {
      if (!state.block || state.phase === 'DONE') return result(idle(state));
      const closed = closeSegment(state, action.now, true);
      return result(idle(state), closed.recorded, 'Bloco pulado (fica registrado para ajustar o próximo ciclo).');
    }

    case 'RESET':
      return result(idle(state));
  }
}
