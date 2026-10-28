import { formatDuration } from '../../lib/timeFormat';

interface CalendarDay {
  dateKey: string;
  minutes: number;
  level: 0 | 1 | 2 | 3 | 4;
}

const LEVEL_COLOR: Record<CalendarDay['level'], string> = {
  0: 'bg-slate-800/70',
  1: 'bg-orange-500/25',
  2: 'bg-orange-500/45',
  3: 'bg-orange-500/70',
  4: 'bg-orange-400',
};

function dayLabel(day: CalendarDay): string {
  const [, m, d] = day.dateKey.split('-');
  return `${d}/${m}: ${day.minutes > 0 ? formatDuration(day.minutes) : 'sem estudo'}`;
}

/** As últimas 4 semanas, um quadradinho por dia (mais forte = mais tempo). Sem contagem de dias seguidos: não é cobrança. */
export function StudyCalendar({ days }: { days: CalendarDay[] }) {
  return (
    <section aria-label="Últimas 4 semanas" className="space-y-2.5 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Últimas 4 semanas</h2>
      <ul className="grid w-fit grid-cols-7 gap-1.5">
        {days.map((day) => (
          <li
            key={day.dateKey}
            aria-label={dayLabel(day)}
            title={dayLabel(day)}
            className={`h-4 w-4 rounded-[4px] ${LEVEL_COLOR[day.level]}`}
          />
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        menos
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span key={level} aria-hidden="true" className={`h-2.5 w-2.5 rounded-[3px] ${LEVEL_COLOR[level]}`} />
        ))}
        mais
      </p>
    </section>
  );
}
