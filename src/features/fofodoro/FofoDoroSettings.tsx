import { shortBreakMinutes, type BlockState, type PomodoroSettings } from '../study-block/studyBlockMachine';

const SHORT_OPTIONS = [3, 4, 5, 6, 7, 8, 10, 12, 15];
const LONG_OPTIONS = [10, 15, 20, 25, 30];
const EVERY_OPTIONS = [2, 3, 4, 5, 6];

const selectClass =
  'rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 disabled:opacity-50 focus:border-orange-500 focus:outline-none';

/** Ajustes do FofoDoro: pausa curta (automática ou fixa), pausa longa e a cada quantos pomodoros ela vem. */
export function FofoDoroSettings({ state, onChange }: { state: BlockState; onChange: (settings: PomodoroSettings) => void }) {
  const { settings } = state;
  const locked = state.phase === 'FOCUS' || state.phase === 'BREAK';
  const autoShort = Math.max(5, Math.round(state.focusMinutes / 5));

  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 border-t border-slate-800 pt-2">
      <label htmlFor="fofodoro-short" className="text-slate-300">
        Pausa curta
      </label>
      <select
        id="fofodoro-short"
        disabled={locked}
        value={settings.shortBreakMinutes === null ? 'auto' : String(settings.shortBreakMinutes)}
        onChange={(e) =>
          onChange({ ...settings, shortBreakMinutes: e.target.value === 'auto' ? null : Number(e.target.value) })
        }
        className={selectClass}
      >
        <option value="auto">{`Automática (${autoShort} min)`}</option>
        {SHORT_OPTIONS.map((m) => (
          <option key={m} value={m}>{`${m} min`}</option>
        ))}
      </select>

      <label htmlFor="fofodoro-long" className="text-slate-300">
        Pausa longa
      </label>
      <select
        id="fofodoro-long"
        disabled={locked}
        value={settings.longBreakMinutes}
        onChange={(e) => onChange({ ...settings, longBreakMinutes: Number(e.target.value) })}
        className={selectClass}
      >
        {LONG_OPTIONS.map((m) => (
          <option key={m} value={m}>{`${m} min`}</option>
        ))}
      </select>

      <label htmlFor="fofodoro-every" className="text-slate-300">
        Pausa longa a cada
      </label>
      <select
        id="fofodoro-every"
        disabled={locked}
        value={settings.longEvery}
        onChange={(e) => onChange({ ...settings, longEvery: Number(e.target.value) })}
        className={selectClass}
      >
        {EVERY_OPTIONS.map((n) => (
          <option key={n} value={n}>{`${n} pomodoros`}</option>
        ))}
      </select>

      <p className="col-span-2 text-[11px] text-slate-400">
        {locked
          ? 'Dá para mudar entre um pomodoro e outro.'
          : `Regra geral: 1 minuto de pausa para cada 5 de foco (agora: ${shortBreakMinutes(state.focusMinutes, settings)} min).`}
      </p>
    </div>
  );
}
