import { Check, Pause, Play, Timer } from 'lucide-react';
import { formatClock } from '../../lib/timeFormat';
import { focusedSegmentMs, phaseProgress, phaseRemainingMs, totalPomodoros, type BlockTarget } from './studyBlockMachine';
import { PHASE_LABELS } from './StudyBlockParts';
import type { StudyBlockController } from './useStudyBlock';

/**
 * Relógio do cabeçalho: o mesmo bloco do cartão, sempre à vista (inclusive na leitura ampliada).
 * Clicar no tempo leva ao cartão completo (no Ciclo); a barrinha mostra quanto do pomodoro (ou da pausa) já foi.
 */
export function StudyBlockMini({
  controller,
  startTarget,
  onOpen,
}: {
  controller: StudyBlockController;
  startTarget: BlockTarget | null;
  onOpen?: () => void;
}) {
  const { state, now } = controller;
  const active = state.block !== null && state.phase !== 'IDLE' && state.phase !== 'DONE';

  if (!active) {
    return (
      <button
        type="button"
        disabled={!startTarget}
        onClick={() => startTarget && controller.start(startTarget)}
        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:border-orange-500/50 flex items-center gap-1.5 disabled:opacity-40"
        title={startTarget ? `Começar um bloco em ${startTarget.subjectName}` : undefined}
        aria-label="Começar bloco de estudo"
      >
        <Timer size={13} className="text-orange-400" />
        Começar bloco
      </button>
    );
  }

  const remaining = phaseRemainingMs(state, now);
  const clock = state.mode === 'LIVRE' ? formatClock(state.blockFocusedMs + focusedSegmentMs(state, now)) : formatClock(remaining ?? 0);
  const total = totalPomodoros(state);
  const progress = phaseProgress(state, now);
  const barLabel = state.phase === 'BREAK' ? 'Progresso da pausa' : 'Progresso do pomodoro';

  return (
    <div className="relative overflow-hidden px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label="Ver o bloco na coluna Hoje"
        title="Ver o bloco na coluna Hoje"
        className="flex min-w-0 items-center gap-2 rounded-lg hover:text-white disabled:cursor-default"
      >
        <Timer size={13} className={state.running ? 'text-orange-400 animate-pulse' : 'text-slate-400'} />
        <span
          className={`font-mono text-sm font-bold tracking-wider ${state.phase === 'BREAK' ? 'text-sky-300' : 'text-white'}`}
          aria-label="Relógio do bloco"
          title={PHASE_LABELS[state.phase]}
        >
          {clock}
        </span>
        {state.mode === 'POMODORO' && (
          <span className="text-[10px] text-slate-400 font-mono" title="Pomodoros feitos do bloco">
            {state.completedPomodoros}/{total}
          </span>
        )}
        <span className="max-w-[9rem] truncate text-[11px] text-slate-300" title={state.block?.subjectName}>
          {state.block?.subjectName}
        </span>
      </button>
      {progress !== null && (
        <div
          role="progressbar"
          aria-label={barLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="absolute inset-x-0 bottom-0 h-[3px] bg-slate-800"
        >
          <div
            className={`h-full transition-[width] duration-500 ease-linear motion-reduce:transition-none ${state.phase === 'BREAK' ? 'bg-sky-400' : 'bg-orange-500'}`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
      {state.phase === 'READY' ? (
        <button type="button" onClick={controller.next} className="p-1.5 rounded-lg bg-orange-500 text-white" aria-label="Começar o próximo pomodoro">
          <Play size={12} />
        </button>
      ) : (
        <button
          type="button"
          onClick={state.running ? controller.pause : controller.resume}
          className={`p-1.5 rounded-lg text-white ${state.running ? 'bg-amber-500' : 'bg-orange-500'}`}
          aria-label={state.running ? 'Pausar bloco' : 'Continuar bloco'}
        >
          {state.running ? <Pause size={12} /> : <Play size={12} />}
        </button>
      )}
      <button
        type="button"
        onClick={controller.finish}
        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-emerald-300"
        aria-label="Concluir bloco"
        title="Concluir o bloco e registrar o tempo estudado"
      >
        <Check size={12} />
      </button>
    </div>
  );
}
