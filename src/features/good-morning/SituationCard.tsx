import { AlertTriangle, CalendarDays } from 'lucide-react';

interface SituationCardProps {
  daysLine: string | null;
  parts: { code: string; name: string; coveragePercent: number }[];
  warning: string | null;
}

/** Situação (spec 07 §5.5): quanto falta e quanto de cada prova já foi visto — um aviso só, discreto. */
export function SituationCard({ daysLine, parts, warning }: SituationCardProps) {
  if (!daysLine && parts.length === 0) return null;
  return (
    <section aria-label="Situação" className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <h2 className="text-sm font-semibold text-white">Situação</h2>
      {daysLine && (
        <p className="flex items-center gap-2 text-xs text-slate-300">
          <CalendarDays size={14} className="text-orange-400" />
          {daysLine}
        </p>
      )}
      {parts.length > 0 && (
        <ul className="space-y-2">
          {parts.map((p) => (
            <li key={p.code} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate text-slate-200">
                  <span className="font-semibold text-orange-200">{p.code}</span> {p.name}
                </span>
                <span className="shrink-0 text-slate-400">{`${p.coveragePercent}% visto`}</span>
              </div>
              <div
                role="progressbar"
                aria-label={`${p.code}: quanto já foi visto`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={p.coveragePercent}
                className="h-1.5 overflow-hidden rounded-full bg-slate-800"
              >
                <div className="h-full rounded-full bg-orange-500/80" style={{ width: `${p.coveragePercent}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {warning && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {warning}
        </p>
      )}
    </section>
  );
}
