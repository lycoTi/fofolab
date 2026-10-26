import { Clock } from 'lucide-react';
import type { WeekdayMinutes } from '../../lib/availability';
import { formatDuration } from '../../lib/timeFormat';
import { WeekdayHoursEditor } from '../study-plan/WeekdayHoursEditor';

/** Atalhos de tempo: valem para todos os dias de estudo (os de folga continuam de folga). */
const QUICK_TIMES = [
  { minutes: 60, desc: 'Perfeito para quem tem rotina puxada' },
  { minutes: 90, desc: 'Ritmo constante e sustentável' },
  { minutes: 120, desc: 'Equilíbrio entre teoria e questões' },
  { minutes: 180, desc: 'Foco intenso e avanço rápido' },
  { minutes: 270, desc: 'Dedicação exclusiva / reta final' },
];

/** Passo 2 do Wizard (spec 13 §4.1): em quais dias e quanto tempo — dia desligado é folga fixa. */
export function HoursStep({ value, onChange }: { value: WeekdayMinutes; onChange: (next: WeekdayMinutes) => void }) {
  const studyDays = value.filter((m) => m > 0);
  const uniform = studyDays.length > 0 && studyDays.every((m) => m === studyDays[0]) ? studyDays[0] : null;
  const applyToStudyDays = (minutes: number) => {
    const anyDay = value.some((m) => m > 0);
    onChange(value.map((m) => (m > 0 || !anyDay ? minutes : 0)) as WeekdayMinutes);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock size={16} className="text-orange-400" />
          Em quais dias e quanto tempo você consegue estudar?
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Seja realista com sua rotina de casa e trabalho. Dia de folga também conta: descansar faz parte de aprender.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {QUICK_TIMES.map((item) => (
          <button
            key={item.minutes}
            type="button"
            onClick={() => applyToStudyDays(item.minutes)}
            className={`p-3 rounded-xl border text-left transition ${
              uniform === item.minutes
                ? 'bg-orange-500/15 border-orange-500 text-white'
                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="font-semibold text-xs text-orange-200">{`${formatDuration(item.minutes)} por dia`}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <WeekdayHoursEditor value={value} onChange={onChange} />
      </div>
    </div>
  );
}
