import { CheckCircle2, Coffee, Pause, Play, RotateCcw, SkipForward, Timer } from 'lucide-react';
import { formatClock, formatDuration } from '../../lib/timeFormat';
import { focusedSegmentMs, phaseRemainingMs, totalPomodoros, type BlockTarget } from './studyBlockMachine';
import { BlockModePicker, PHASE_LABELS, PomodoroDots } from './StudyBlockParts';
import type { StudyBlockController } from './useStudyBlock';

const MINUTE_MS = 60_000;

const buttonClass =
  'px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 disabled:pointer-events-none';

function targetLabel(target: BlockTarget): string {
  return [target.topicCode, target.topicTitle].filter(Boolean).join(' ') || target.subjectName;
}

/** Cartão do bloco atual (topo do "Meu Dia" e da aba Ciclo). */
export function StudyBlockCard({ controller, startTarget }: { controller: StudyBlockController; startTarget: BlockTarget | null }) {
  const { state, now, message } = controller;
  const { block, phase, mode } = state;
  const active = block !== null && phase !== 'IDLE' && phase !== 'DONE';
  const focusedMs = state.blockFocusedMs + focusedSegmentMs(state, now);
  const remaining = phaseRemainingMs(state, now);

  return (
    <section aria-label="Bloco de estudo" className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-orange-400 flex items-center gap-1.5">
          <Timer size={14} />
          {active || phase === 'DONE' ? 'Bloco atual' : 'Bloco de estudo'}
          {block && <span className="text-white font-bold">• {block.subjectName}</span>}
        </h3>
        <BlockModePicker state={state} onChange={controller.setMode} />
      </div>

      {message && <p className="text-[11px] text-emerald-300">{message}</p>}

      {active && block && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-white truncate" title={targetLabel(block)}>
              {targetLabel(block)}
            </p>
            <p className="text-[11px] text-slate-400">
              {block.targetMinutes ? `Meta do bloco ${formatDuration(block.targetMinutes)} • ` : ''}
              estudado {formatDuration(focusedMs / MINUTE_MS)}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span
              className={`font-mono text-3xl font-bold tracking-wider ${phase === 'BREAK' ? 'text-sky-300' : 'text-white'}`}
              aria-label={mode === 'LIVRE' ? 'Tempo estudado' : 'Tempo restante'}
            >
              {mode === 'LIVRE' ? formatClock(focusedMs) : formatClock(remaining ?? 0)}
            </span>
            <div className="space-y-1">
              <span className="block text-[11px] text-slate-300">
                {phase === 'BREAK' && <Coffee size={11} className="inline mr-1" />}
                {state.running || phase === 'READY' ? PHASE_LABELS[phase] : 'Pausado'}
              </span>
              {mode === 'POMODORO' ? (
                <PomodoroDots done={state.completedPomodoros} total={totalPomodoros(state)} current={phase === 'FOCUS'} />
              ) : (
                block.targetMinutes && (
                  <div className="w-28 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-orange-500"
                      style={{ width: `${Math.min(100, (focusedMs / (block.targetMinutes * MINUTE_MS)) * 100)}%` }}
                    />
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {active && (
        <div className="flex flex-wrap items-center gap-2">
          {phase === 'READY' && (
            <button type="button" onClick={controller.next} className={`${buttonClass} bg-orange-500 border-orange-500 text-white`}>
              <Play size={13} />
              Começar pomodoro {state.completedPomodoros + 1}
            </button>
          )}
          {phase !== 'READY' && (
            <button
              type="button"
              onClick={state.running ? controller.pause : controller.resume}
              className={`${buttonClass} ${state.running ? 'bg-amber-500/20 border-amber-500/40 text-amber-200' : 'bg-orange-500 border-orange-500 text-white'}`}
            >
              {state.running ? <Pause size={13} /> : <Play size={13} />}
              {state.running ? 'Pausar' : 'Continuar'}
            </button>
          )}
          {phase === 'BREAK' && (
            <button type="button" onClick={controller.next} className={`${buttonClass} bg-slate-950 border-slate-800 text-slate-200`}>
              Pular pausa
            </button>
          )}
          <button type="button" onClick={controller.finish} className={`${buttonClass} bg-emerald-500/15 border-emerald-500/40 text-emerald-200`}>
            <CheckCircle2 size={13} />
            Concluir bloco
          </button>
          <button
            type="button"
            onClick={controller.skip}
            title="Pular esta matéria agora (fica registrado para ajustar o próximo ciclo)"
            className={`${buttonClass} bg-slate-950 border-slate-800 text-slate-400`}
          >
            <SkipForward size={13} />
            Pular matéria
          </button>
          <button
            type="button"
            onClick={controller.reset}
            title="Zerar o relógio sem registrar o trecho atual"
            aria-label="Zerar o relógio"
            className={`${buttonClass} bg-slate-950 border-slate-800 text-slate-500`}
          >
            <RotateCcw size={13} />
          </button>
        </div>
      )}

      {!active && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-400">
            {phase === 'DONE'
              ? `Bloco concluído: ${formatDuration(state.blockFocusedMs / MINUTE_MS)} de foco registrados.`
              : 'Escolha um bloco no roteiro de hoje, ou comece pelo tópico aberto agora.'}
          </p>
          {startTarget && (
            <button
              type="button"
              onClick={() => controller.start(startTarget)}
              className={`${buttonClass} bg-orange-500 border-orange-500 text-white`}
              title={targetLabel(startTarget)}
            >
              <Play size={13} />
              Começar em {startTarget.topicCode ?? startTarget.subjectName}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
