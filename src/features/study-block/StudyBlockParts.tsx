import { formatDuration } from '../../lib/timeFormat';
import { FOCUS_OPTIONS, type BlockMode, type BlockState } from './studyBlockMachine';

/** Escolha do jeito de estudar o bloco: pomodoros de 25, 30 ou 50 min, ou relógio livre. */
export function BlockModePicker({
  state,
  onChange,
  compact = false,
}: {
  state: BlockState;
  onChange: (mode: BlockMode, focusMinutes: number) => void;
  compact?: boolean;
}) {
  const locked = state.phase === 'FOCUS' || state.phase === 'BREAK';
  const options: { label: string; mode: BlockMode; focus: number }[] = [
    ...FOCUS_OPTIONS.map((focus) => ({ label: formatDuration(focus), mode: 'POMODORO' as const, focus })),
    { label: 'Livre', mode: 'LIVRE', focus: state.focusMinutes },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Jeito de estudar o bloco"
      title={locked ? 'Dá para trocar entre um pomodoro e outro' : 'Pomodoros desse tamanho, ou relógio livre até a meta'}
      className="flex items-center gap-1.5"
    >
      {!compact && <span className="text-[11px] text-slate-400">Pomodoros de</span>}
      <div className="flex items-center divide-x divide-slate-800 rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
        {options.map((option) => {
          const selected = state.mode === option.mode && (option.mode === 'LIVRE' || state.focusMinutes === option.focus);
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={locked}
              onClick={() => onChange(option.mode, option.focus)}
              className={`px-2.5 py-1 text-[11px] font-mono transition-colors disabled:cursor-not-allowed ${
                selected
                  ? 'bg-orange-500/20 text-orange-200 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 disabled:opacity-50'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const PHASE_LABELS: Record<BlockState['phase'], string> = {
  IDLE: 'Nenhum bloco em andamento',
  FOCUS: 'Foco',
  BREAK: 'Pausa',
  READY: 'Pronto para o próximo pomodoro',
  DONE: 'Bloco concluído',
};
