import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { formatDuration } from '../../lib/timeFormat';
import type { DayForecast } from '../../lib/weekForecast';
import type { Subject, Topic } from '../../types/database';
import { DayCard } from './DayCard';

const shortDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Sua semana (spec 13 §4.2): sete dias, cada um com as próprias horas; o que vem é previsão e se refaz sozinho. */
export function WeekView({
  days,
  weekStart,
  weekBudget,
  daysUntilExam,
  weekMet,
  subjects,
  topicsBySubject,
}: {
  days: DayForecast[];
  weekStart: Date;
  weekBudget: number;
  daysUntilExam: number | null;
  weekMet: boolean;
  subjects: Subject[];
  topicsBySubject: Record<string, Topic[]>;
}) {
  const studied = days.reduce((acc, d) => acc + d.studiedMinutes, 0);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));
  const topicsById = new Map(Object.values(topicsBySubject).flat().map((t) => [t.id, t]));

  return (
    <section aria-label="Sua semana" className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Sua semana</h3>
          <p className="text-[11px] text-slate-400">
            {`${shortDate(weekStart)} – ${shortDate(weekEnd)} · `}
            <span className="font-mono tabular-nums text-slate-200">{`${formatDuration(studied)} de ${formatDuration(weekBudget)}`}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <CalendarClock size={15} className="text-orange-400" />
          {daysUntilExam !== null ? (
            <span>
              Faltam <strong className="text-white">{daysUntilExam} dias</strong> para a prova
            </span>
          ) : (
            <span>Data da prova em aberto</span>
          )}
        </div>
      </div>

      {weekMet && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <CheckCircle2 size={14} />
          Meta da semana cumprida. Parabéns pela constância!
        </p>
      )}

      {/* Colunas pelo espaço do centro (com os painéis abertos ele é estreito): 7 quando cabe, 4 + 3 quando não */}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
        {days.map((day) => (
          <DayCard key={day.dateKey} day={day} subjectsById={subjectsById} topicsById={topicsById} />
        ))}
      </ul>
      <p className="text-[11px] text-slate-500">
        Os próximos dias são previsão: se você atrasar ou adiantar, o resto da semana se refaz sozinho, sem mudar o total.
      </p>
    </section>
  );
}
