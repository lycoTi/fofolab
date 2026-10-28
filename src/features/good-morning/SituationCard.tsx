import { AlertTriangle, CalendarDays, TrendingUp } from 'lucide-react';

export interface EditalProgressSummary {
  coveragePercent: number;
  seenTopics: number;
  totalTopics: number;
  proficiencyPercent: number | null;
  paceLine: string | null;
  onPace: boolean | null;
}

interface SituationCardProps {
  daysLine: string | null;
  parts: { code: string; name: string; coveragePercent: number }[];
  warning: string | null;
  progress?: EditalProgressSummary | null;
}


/**
 * Situação (spec 07 §5.5): quanto falta, cobertura × proficiência (separadas, nunca numa média só), o ritmo para ver
 * o edital inteiro e quanto de cada prova já foi visto — um aviso só, discreto.
 */
export function SituationCard({ daysLine, parts, warning, progress = null }: SituationCardProps) {
  if (!daysLine && parts.length === 0 && !progress) return null;
  return (
    <section aria-label="Situação" className="space-y-4 border-t border-slate-800/60 pt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Situação</h2>
      {daysLine && (
        <p className="flex items-center gap-2 text-xs text-slate-300">
          <CalendarDays size={14} className="text-orange-400" />
          {daysLine}
        </p>
      )}
      {progress && progress.totalTopics > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-2 border-y border-slate-800/60 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/60">
          <div className="space-y-1">
            <p className="text-[11px] text-slate-400">Cobertura do edital</p>
            <p className="text-lg font-semibold text-white">{`${progress.coveragePercent}%`}</p>
            <p className="text-[11px] text-slate-400">{`${progress.seenTopics} de ${progress.totalTopics} tópicos vistos`}</p>
          </div>
          <div className="space-y-1 pt-3 sm:pt-0 sm:pl-4">
            <p className="text-[11px] text-slate-400">Proficiência nos tópicos estudados</p>
            {progress.proficiencyPercent === null ? (
              <p className="pt-1 text-xs text-slate-400">Aparece depois dos primeiros estudos</p>
            ) : (
              <p className="text-lg font-semibold text-white">{`${progress.proficiencyPercent}%`}</p>
            )}
          </div>
        </div>
      )}
      {progress?.paceLine && (
        <p className={`flex items-start gap-2 text-xs ${progress.onPace === false ? 'text-amber-200' : 'text-slate-300'}`}>
          <TrendingUp size={14} className={`mt-0.5 shrink-0 ${progress.onPace === false ? 'text-amber-400' : 'text-emerald-400'}`} />
          {progress.paceLine}
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
