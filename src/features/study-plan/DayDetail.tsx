import { WEEKDAY_NAMES, weekdayIndex } from '../../lib/availability';
import { formatDuration } from '../../lib/timeFormat';
import type { DayForecast } from '../../lib/weekForecast';
import type { Subject, Topic } from '../../types/database';
import { REVIEW_COLOR, statusLine } from './DayCard';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Detalhe do dia escolhido na Sua semana (spec 13, opção A): o nome inteiro da matéria, o tópico e o tempo. */
export function DayDetail({
  day,
  subjectsById,
  topicsById,
}: {
  day: DayForecast;
  subjectsById: Map<string, Subject>;
  topicsById: Map<string, Topic>;
}) {
  const weekday = capitalize(WEEKDAY_NAMES[weekdayIndex(day.dateKey)]);
  const title = `${weekday} ${Number(day.dateKey.slice(8))}`;
  const parts = [title];
  if (day.when === 'today') parts.push('hoje');
  if (day.rest) parts.push('folga');
  else parts.push(statusLine(day));

  return (
    // A chave troca a cada dia escolhido: o detalhe entra de novo, com o fade curto
    <section key={day.dateKey} aria-label="Dia escolhido" className="fofolab-enter rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5">
      <p className="text-[11px] text-slate-400">{parts.join(' · ')}</p>
      {day.blocks.length === 0 && (
        <p className="pt-1.5 text-xs text-slate-400">
          {day.rest ? 'Dia de descanso. A memória também se firma no intervalo.' : 'Nada previsto: a meta da semana já foi cumprida.'}
        </p>
      )}
      <ul className="divide-y divide-slate-800/80">
        {day.blocks.map((block, i) => {
          const subject = subjectsById.get(block.subjectId);
          const topic = block.topicId ? topicsById.get(block.topicId) : undefined;
          const review = block.kind === 'WEEK_REVIEW';
          return (
            <li key={`${block.subjectId}-${block.topicId ?? ''}-${i}`} className="grid grid-cols-[0.75rem_1fr_auto] items-start gap-2 py-2 text-xs">
              <span
                className="mt-1 h-2 w-2 rounded-full"
                style={{ backgroundColor: review ? REVIEW_COLOR : (subject?.color ?? '#64748b') }}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block font-semibold text-slate-100">
                  {review && (
                    <span className="mr-1.5 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-200">Revisão da semana</span>
                  )}
                  {subject?.name ?? 'Matéria'}
                </span>
                {topic && <span className="block text-slate-400">{`${topic.code ?? ''} ${topic.title}`.trim()}</span>}
              </span>
              <span className="font-mono tabular-nums text-slate-300">{formatDuration(block.minutes)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
