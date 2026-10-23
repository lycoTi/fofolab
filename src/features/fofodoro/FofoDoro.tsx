import { CheckCircle2, Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { formatClock } from '../../lib/timeFormat';
import {
  focusedSegmentMs,
  phaseProgress,
  phaseRemainingMs,
  shortBreakMinutes,
  totalPomodoros,
  type BlockState,
} from '../study-block/studyBlockMachine';
import type { StudyBlockController } from '../study-block/useStudyBlock';
import { FofoDoroRing, type RingTone } from './FofoDoroRing';

const MINUTE_MS = 60_000;

const button =
  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 disabled:opacity-40';

function ringTone(state: BlockState): RingTone {
  if (state.phase === 'FOCUS') return 'focus';
  if (state.phase === 'BREAK') return state.breakKind === 'LONG' ? 'long' : 'break';
  return 'idle';
}

function phaseLabel(state: BlockState): string {
  if (state.phase === 'FOCUS' && state.mode === 'LIVRE') return state.running ? 'Estudando' : 'Pausado';
  if (state.phase === 'FOCUS') return state.running ? 'Foco' : 'Foco pausado';
  if (state.phase === 'BREAK') return state.breakKind === 'LONG' ? 'Pausa longa' : 'Pausa';
  return 'Pronto';
}

function ringTime(state: BlockState, now: number): string {
  if (state.mode === 'LIVRE') return formatClock(state.blockFocusedMs + focusedSegmentMs(state, now));
  if (state.phase === 'READY') return formatClock(state.focusMinutes * MINUTE_MS);
  return formatClock(phaseRemainingMs(state, now) ?? 0);
}

/** O que vem depois do pomodoro em andamento: pausa curta, pausa longa ou o fim do bloco. */
function nextStepText(state: BlockState, total: number): string {
  if (state.completedPomodoros + 1 >= total) return 'Depois: fim do bloco';
  const nextIsLong = (state.cyclePomodoros + 1) % state.settings.longEvery === 0;
  if (nextIsLong) return `Depois: pausa longa de ${formatClock(state.settings.longBreakMinutes * MINUTE_MS)}`;
  return `Depois: pausa de ${formatClock(shortBreakMinutes(state.focusMinutes, state.settings) * MINUTE_MS)}`;
}

function progressText(state: BlockState, total: number): string {
  if (state.phase === 'FOCUS') return `Pomodoro ${state.completedPomodoros + 1} de ${total}`;
  if (state.phase === 'BREAK') return `Pomodoro ${state.completedPomodoros} de ${total} feito`;
  return `Próximo: pomodoro ${state.completedPomodoros + 1} de ${total}`;
}

/** Bolinhas do ciclo rumo à pausa longa (feitos, o atual e os que faltam). */
function CycleDots({ state }: { state: BlockState }) {
  const { longEvery } = state.settings;
  const done = Math.min(state.cyclePomodoros, longEvery);
  return (
    <span className="flex items-center gap-1.5" aria-label={`${done} de ${longEvery} pomodoros até a pausa longa`}>
      {Array.from({ length: longEvery }, (_, i) => {
        let style = 'bg-slate-800 ring-1 ring-slate-700';
        if (i < done) style = 'bg-orange-500';
        else if (i === done && state.phase === 'FOCUS') style = 'bg-orange-500/30 ring-2 ring-orange-400';
        return <span key={i} className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${style}`} />;
      })}
    </span>
  );
}

/** FofoDoro: o bloco em andamento, com o relógio em anel, o ciclo de pomodoros e os controles. */
export function FofoDoro({ controller }: { controller: StudyBlockController }) {
  const { state, now } = controller;
  const total = totalPomodoros(state);
  const pomodoro = state.mode === 'POMODORO';
  const inPhase = state.phase === 'FOCUS' || state.phase === 'BREAK';

  return (
    <div className="space-y-2.5" aria-label="FofoDoro" role="group">
      <div className="flex items-center gap-3">
        <FofoDoroRing
          progress={phaseProgress(state, now) ?? 0}
          tone={ringTone(state)}
          timeText={ringTime(state, now)}
          phaseLabel={phaseLabel(state)}
        />
        <div className="min-w-0 space-y-1 text-xs">
          {pomodoro && <p className="font-semibold text-white">{progressText(state, total)}</p>}
          {state.phase === 'READY' && <p className="text-emerald-300">Pronto quando você estiver</p>}
          {pomodoro && state.phase === 'FOCUS' && <p className="text-slate-300">{nextStepText(state, total)}</p>}
          {pomodoro && (
            <p className="text-slate-400">
              {`Pausa longa de ${formatClock(state.settings.longBreakMinutes * MINUTE_MS)} depois do ${state.settings.longEvery}º seguido`}
            </p>
          )}
          {pomodoro && <CycleDots state={state} />}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {state.phase === 'READY' && (
          <button type="button" onClick={controller.next} className={`${button} border-orange-500 bg-orange-500 text-white hover:bg-orange-400`}>
            <Play size={13} />
            Começar o próximo pomodoro
          </button>
        )}
        {inPhase && (
          <button
            type="button"
            onClick={state.running ? controller.pause : controller.resume}
            className={`${button} ${state.running ? 'border-amber-500/50 bg-amber-500/15 text-amber-200' : 'border-orange-500 bg-orange-500 text-white'}`}
          >
            {state.running ? <Pause size={13} /> : <Play size={13} />}
            {state.running ? 'Pausar' : 'Continuar'}
          </button>
        )}
        {state.phase === 'BREAK' && (
          <button type="button" onClick={controller.next} className={`${button} border-slate-700 bg-slate-900 text-slate-200`}>
            Encerrar pausa
          </button>
        )}
        <button type="button" onClick={controller.finish} className={`${button} border-emerald-500/40 bg-emerald-500/10 text-emerald-200`}>
          <CheckCircle2 size={13} />
          Concluir bloco
        </button>
      </div>
      <div className="flex gap-3 text-[11px] text-slate-400">
        <button type="button" onClick={controller.skip} className="flex items-center gap-1 hover:text-slate-200" title="Fica registrado para ajustar o próximo ciclo">
          <SkipForward size={12} />
          Pular matéria
        </button>
        <button type="button" onClick={controller.reset} className="flex items-center gap-1 hover:text-slate-200" title="Zerar o relógio sem registrar o trecho atual">
          <RotateCcw size={12} />
          Zerar
        </button>
      </div>
    </div>
  );
}
