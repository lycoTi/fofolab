import { useRef } from 'react';
import { WEEKDAY_LABELS, WEEKDAY_NAMES, type WeekdayMinutes } from '../../lib/availability';
import { formatDuration } from '../../lib/timeFormat';

/** Tempos oferecidos para um dia: de 00:30 a 08:00, de meia em meia hora. */
const TIME_OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 30);
/** Dia religado que nunca teve tempo começa com 01:00. */
const DEFAULT_DAY_MINUTES = 60;

const selectClass =
  'rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400';

/**
 * Dias de estudo e horas de cada dia (spec 13 §4.1). Primeiro os dias — desligado é folga fixa, sem cobrança —, depois
 * o tempo de cada dia ligado. Usado no "Ajustar" do Plano, na semana atípica e no Wizard.
 */
export function WeekdayHoursEditor({
  value,
  onChange,
  title = 'Em quais dias você estuda?',
}: {
  value: WeekdayMinutes;
  onChange: (next: WeekdayMinutes) => void;
  title?: string;
}) {
  // Tempo de cada dia antes de desligar: religar devolve o mesmo tempo
  const lastOn = useRef<number[]>(value.map((m) => (m > 0 ? m : DEFAULT_DAY_MINUTES)));
  const total = value.reduce((acc, m) => acc + m, 0);

  const setDay = (index: number, minutes: number) => {
    const next = [...value] as WeekdayMinutes;
    next[index] = minutes;
    onChange(next);
  };
  const toggle = (index: number) => {
    if (value[index] > 0) {
      lastOn.current[index] = value[index];
      setDay(index, 0);
      return;
    }
    setDay(index, lastOn.current[index] || DEFAULT_DAY_MINUTES);
  };
  const applyToStudyDays = (minutes: number) => {
    onChange(value.map((m) => (m > 0 ? minutes : 0)) as WeekdayMinutes);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-100">{title}</p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.map((label, i) => {
            const on = value[i] > 0;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(i)}
                className={`min-w-11 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 ${
                  on
                    ? 'border-orange-500/70 bg-orange-500/15 text-orange-100'
                    : 'border-slate-800 bg-slate-950/70 text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {total > 0 && (
        <div className="space-y-2">
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
            {WEEKDAY_LABELS.map((label, i) =>
              value[i] > 0 ? (
                <li key={label} className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="w-7">{label}</span>
                  <select
                    aria-label={`Tempo de ${WEEKDAY_NAMES[i]}`}
                    value={String(value[i])}
                    onChange={(e) => setDay(i, Number(e.target.value))}
                    className={selectClass}
                  >
                    {!TIME_OPTIONS.includes(value[i]) && <option value={String(value[i])}>{formatDuration(value[i])}</option>}
                    {TIME_OPTIONS.map((m) => (
                      <option key={m} value={String(m)}>
                        {formatDuration(m)}
                      </option>
                    ))}
                  </select>
                </li>
              ) : null
            )}
          </ul>
          <label className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            Mesmo tempo nos dias de estudo
            <select
              aria-label="Mesmo tempo nos dias de estudo"
              value=""
              onChange={(e) => e.target.value && applyToStudyDays(Number(e.target.value))}
              className={selectClass}
            >
              <option value="">escolher</option>
              {TIME_OPTIONS.map((m) => (
                <option key={m} value={String(m)}>
                  {formatDuration(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <p className="font-mono text-xs text-slate-300">{`${formatDuration(total)} por semana`}</p>
    </div>
  );
}
