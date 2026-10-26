import { shortSubjectName } from '../../lib/subjectShortName';
import { formatDuration } from '../../lib/timeFormat';
import type { DayForecast } from '../../lib/weekForecast';
import type { Subject } from '../../types/database';

/** Revisão da semana tem a própria cor (azul = revisão/mapeamento na semântica do app). */
export const REVIEW_COLOR = '#60a5fa';
/** Entrada dos cartões um a um, ao abrir a aba. */
const STAGGER_MS = 40;

export function statusLine(day: DayForecast): string {
  if (day.when === 'past') return `${formatDuration(day.studiedMinutes)} feito`;
  if (day.when === 'today') return `${formatDuration(day.studiedMinutes)} de ${formatDuration(day.plannedMinutes)}`;
  // Dia com horas e sem bloco previsto: o que a semana pedia já foi feito
  if (day.blocks.length === 0) return 'semana cumprida';
  return 'previsão';
}

/**
 * Um dia da Sua semana, enxuto (spec 13 §4.2, opção A): uma linha por bloco — cor e nome curto da matéria, HH:mm. O
 * nome inteiro e o tópico ficam no detalhe do dia escolhido. Folga em tom neutro.
 */
export function DayCard({
  day,
  index,
  selected,
  subjectsById,
  onSelect,
}: {
  day: DayForecast;
  index: number;
  selected: boolean;
  subjectsById: Map<string, Subject>;
  onSelect: () => void;
}) {
  const isToday = day.when === 'today';
  const label = day.rest ? `${day.label}, folga` : day.label;
  const progress = day.plannedMinutes > 0 ? Math.min(100, (day.studiedMinutes / day.plannedMinutes) * 100) : 0;
  const metDay = day.plannedMinutes > 0 && day.studiedMinutes >= day.plannedMinutes;
  let frame = 'border-slate-800 bg-slate-950/60 hover:border-slate-700';
  if (selected) frame = 'border-orange-500/70 bg-slate-900';

  return (
    <li aria-label={label} aria-current={isToday ? 'date' : undefined} className="fofolab-reveal" style={{ animationDelay: `${index * STAGGER_MS}ms` }}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onClick={onSelect}
        className={`flex h-full min-h-28 w-full flex-col gap-1.5 rounded-xl border p-2.5 text-left text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 ${frame} ${day.when === 'past' ? 'opacity-80' : ''}`}
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className={`text-xs font-semibold ${isToday ? 'text-orange-200' : 'text-slate-100'}`}>{day.label}</span>
          <span className="font-mono tabular-nums text-slate-300">{day.rest ? 'Folga' : formatDuration(day.plannedMinutes)}</span>
        </span>

        {!day.rest && (
          <>
            <span className="block h-1 w-full overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
              <span className={`block h-full rounded-full ${metDay ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${progress}%` }} />
            </span>
            <span className="text-[10px] text-slate-500">{statusLine(day)}</span>
          </>
        )}

        <span className="flex w-full flex-col gap-0.5">
          {day.blocks.map((block, i) => {
            const subject = subjectsById.get(block.subjectId);
            const review = block.kind === 'WEEK_REVIEW';
            const name = review ? 'Revisão' : shortSubjectName(subject?.name ?? 'Matéria');
            return (
              <span key={`${block.subjectId}-${block.topicId ?? ''}-${i}`} className="flex w-full items-center gap-1.5 whitespace-nowrap">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: review ? REVIEW_COLOR : (subject?.color ?? '#64748b') }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-slate-200">{name}</span>
                <span className="shrink-0 font-mono tabular-nums text-slate-400">{formatDuration(block.minutes)}</span>
              </span>
            );
          })}
        </span>
      </button>
    </li>
  );
}
