import { Check, Pause, Play, Timer } from 'lucide-react';
import { formatClock } from '../../lib/timeFormat';
import { focusedSegmentMs, phaseRemainingMs, totalPomodoros, type BlockTarget } from './studyBlockMachine';
import { PHASE_LABELS } from './StudyBlockParts';
import type { StudyBlockController } from './useStudyBlock';

/** Relógio do cabeçalho: o mesmo bloco do cartão, sempre à vista (inclusive na leitura ampliada). */
export function StudyBlockMini({ controller, startTarget }: { controller: StudyBlockController; startTarget: BlockTarget | null }) {
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

  return (
    <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
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
