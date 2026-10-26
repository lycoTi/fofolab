import { formatDuration } from '../../lib/timeFormat';
import type { DayForecast, ForecastBlock } from '../../lib/weekForecast';
import type { Subject, Topic } from '../../types/database';

/** Cor do ponto de cada bloco: feito, hoje, revisão ou previsão (a mesma semântica de status do app). */
function dotClass(block: ForecastBlock, when: DayForecast['when']): string {
  if (block.kind === 'WEEK_REVIEW') return 'bg-blue-400';
  if (when === 'past') return 'bg-emerald-400';
  if (when === 'today') return 'bg-orange-400';
  return 'bg-slate-600';
}

function statusLine(day: DayForecast): string {
  if (day.when === 'past') return `${formatDuration(day.studiedMinutes)} feito`;
  if (day.when === 'today') return `${formatDuration(day.studiedMinutes)} de ${formatDuration(day.plannedMinutes)}`;
  return 'previsão';
}

/** Um dia da Sua semana: horas do dia, feito × meta e os blocos (matéria · tópico · HH:mm). Folga em tom neutro. */
export function DayCard({
  day,
  subjectsById,
  topicsById,
}: {
  day: DayForecast;
  subjectsById: Map<string, Subject>;
  topicsById: Map<string, Topic>;
}) {
  const isToday = day.when === 'today';
  const progress = day.plannedMinutes > 0 ? Math.min(100, (day.studiedMinutes / day.plannedMinutes) * 100) : 0;
  const metDay = day.plannedMinutes > 0 && day.studiedMinutes >= day.plannedMinutes;
  const frame = isToday ? 'border-orange-500/70 bg-slate-900' : 'border-slate-800 bg-slate-950/60';

  return (
    <li
      aria-label={day.rest ? `${day.label}, folga` : day.label}
      aria-current={isToday ? 'date' : undefined}
      className={`flex min-h-28 flex-col gap-1.5 rounded-xl border p-2.5 text-[11px] ${frame} ${day.when === 'past' ? 'opacity-80' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-xs font-semibold ${isToday ? 'text-orange-100' : 'text-slate-100'}`}>{day.label}</span>
        <span className="font-mono tabular-nums text-slate-300">{day.rest ? 'Folga' : formatDuration(day.plannedMinutes)}</span>
      </div>

      {!day.rest && (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
            <div className={`h-full rounded-full ${metDay ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[10px] text-slate-500">{statusLine(day)}</p>
        </>
      )}

      <ul className="space-y-1">
        {day.blocks.map((block, i) => {
          const subject = subjectsById.get(block.subjectId);
          const topic = block.topicId ? topicsById.get(block.topicId) : undefined;
          const title = block.kind === 'WEEK_REVIEW' ? 'Revisão da semana' : (subject?.name ?? 'Matéria');
          return (
            <li key={`${block.subjectId}-${block.topicId ?? ''}-${i}`} className="flex gap-1.5 rounded-md bg-slate-900/80 px-1.5 py-1">
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(block, day.when)}`} aria-hidden="true" />
              <span className="min-w-0 flex-1" title={topic ? `${title} · ${topic.code ?? ''} ${topic.title}` : title}>
                <span className="line-clamp-2 font-semibold leading-snug text-slate-200">{title}</span>
                {topic && <span className="line-clamp-2 leading-snug text-slate-400">{`${topic.code ?? ''} ${topic.title}`.trim()}</span>}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-slate-400">{formatDuration(block.minutes)}</span>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
