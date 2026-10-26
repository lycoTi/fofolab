import { useRef } from 'react';
import { WEEKDAY_LABELS, WEEKDAY_NAMES, type WeekdayMinutes } from '../../lib/availability';
import { formatDuration } from '../../lib/timeFormat';

/** Tempos oferecidos para um dia: de 00:30 a 08:00, de meia em meia hora. */
const TIME_OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 30);
/** Atalhos de "mesmo tempo nos dias de estudo". */
const QUICK_TIMES = [60, 90, 120, 180, 270];
/** Dia religado que nunca teve tempo começa com 01:00. */
const DEFAULT_DAY_MINUTES = 60;

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400';
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Dias de estudo e horas de cada dia (spec 13 §4.1). Cada dia é uma coluna: o botão do dia liga/desliga e o tempo fica
 * logo embaixo dele (desligado = "Folga", sem cobrança) — o dia aparece uma vez só. Usado no "Ajustar" do Plano, na
 * semana atípica e no Wizard.
 */
export function WeekdayHoursEditor({
  value,
  onChange,
  title = 'Em quais dias e quanto tempo você estuda?',
}: {
  value: WeekdayMinutes;
  onChange: (next: WeekdayMinutes) => void;
  /** `null` esconde o título (quando a tela já tem o próprio). */
  title?: string | null;
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
    const anyDay = value.some((m) => m > 0);
    onChange(value.map((m) => (m > 0 || !anyDay ? minutes : 0)) as WeekdayMinutes);
  };

  return (
    <div className="space-y-3">
      {title && <p className="text-xs font-semibold text-slate-100">{title}</p>}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(3.6rem,1fr))] gap-1.5">
        {WEEKDAY_LABELS.map((label, i) => {
          const on = value[i] > 0;
          return (
            <div key={label} role="group" aria-label={capitalize(WEEKDAY_NAMES[i])} className="flex flex-col gap-1.5">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(i)}
                className={`rounded-lg border py-1.5 text-xs font-semibold transition-colors ${focusRing} ${
                  on
                    ? 'border-orange-500/70 bg-orange-500/15 text-orange-100 hover:bg-orange-500/25'
                    : 'border-slate-800 bg-slate-950/70 text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
              {on ? (
                <select
                  aria-label={`Tempo de ${WEEKDAY_NAMES[i]}`}
                  value={String(value[i])}
                  onChange={(e) => setDay(i, Number(e.target.value))}
                  className={`fofolab-enter w-full rounded-lg border border-slate-800 bg-slate-950 py-1 text-center font-mono text-xs text-slate-100 ${focusRing}`}
                >
                  {!TIME_OPTIONS.includes(value[i]) && <option value={String(value[i])}>{formatDuration(value[i])}</option>}
                  {TIME_OPTIONS.map((m) => (
                    <option key={m} value={String(m)}>
                      {formatDuration(m)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="rounded-lg border border-dashed border-slate-800 py-1 text-center text-[11px] text-slate-500">Folga</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
        <span className="mr-0.5">Mesmo tempo nos dias de estudo:</span>
        {QUICK_TIMES.map((m) => (
          <button
            key={m}
            type="button"
            aria-label={`${formatDuration(m)} nos dias de estudo`}
            onClick={() => applyToStudyDays(m)}
            className={`rounded-full border border-slate-700 px-2.5 py-0.5 font-mono text-slate-200 hover:border-orange-500/60 hover:text-white ${focusRing}`}
          >
            {formatDuration(m)}
          </button>
        ))}
        <span className="ml-auto font-mono text-xs text-slate-300">{`${formatDuration(total)} por semana`}</span>
      </div>
    </div>
  );
}
