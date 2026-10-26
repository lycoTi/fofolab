import type { ProjectedWeek, WeekPhase } from '../../lib/examProjection';

const PHASE: Record<WeekPhase, { label: string; dot: string; bar: string }> = {
  TEORIA: { label: 'Teoria + questões', dot: 'bg-orange-400', bar: 'bg-orange-500' },
  ULTIMOS: { label: 'Últimos tópicos', dot: 'bg-amber-400', bar: 'bg-amber-500' },
  RETA_FINAL: { label: 'Reta final: revisão', dot: 'bg-blue-400', bar: 'bg-blue-500/70' },
};

const shortDate = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

function newTopicsText(week: ProjectedWeek): string {
  if (week.phase === 'RETA_FINAL') return 'só revisão';
  return week.newTopics === 1 ? '1 tópico novo' : `${week.newTopics} tópicos novos`;
}

/**
 * Linha do tempo até a prova (spec 13 §4.3, visão A): uma linha por semana — a fase, quantos tópicos novos e quanto do
 * edital estará visto ao fim dela. A primeira é a semana de hoje.
 */
export function WeekTimeline({ weeks }: { weeks: ProjectedWeek[] }) {
  return (
    <section aria-label="Linha do tempo até a prova" className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="pb-2 text-sm font-bold text-white">Semana a semana até a prova</h3>
      <ul className="divide-y divide-slate-800">
        {weeks.map((week, index) => {
          const phase = PHASE[week.phase];
          return (
            <li
              key={week.weekStartKey}
              aria-current={index === 0 ? 'date' : undefined}
              className={`fofolab-reveal grid grid-cols-[3.25rem_minmax(0,9.5rem)_minmax(0,7rem)_1fr_2.75rem] items-center gap-3 py-2 text-xs ${
                index === 0 ? 'text-slate-100' : 'text-slate-300'
              }`}
              style={{ animationDelay: `${index * 25}ms` }}
            >
              <span className={`font-mono tabular-nums ${index === 0 ? 'font-semibold text-orange-200' : ''}`}>{shortDate(week.weekStartKey)}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${phase.dot}`} aria-hidden="true" />
                <span className="truncate">{phase.label}</span>
              </span>
              <span className="truncate text-slate-400">{newTopicsText(week)}</span>
              <span className="block h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
                <span className={`block h-full rounded-full ${phase.bar}`} style={{ width: `${week.coveragePercent}%` }} />
              </span>
              <span className="text-right font-mono tabular-nums">{`${week.coveragePercent}%`}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
