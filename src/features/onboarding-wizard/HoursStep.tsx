import { Clock } from 'lucide-react';
import type { WeekdayMinutes } from '../../lib/availability';
import { WeekdayHoursEditor } from '../study-plan/WeekdayHoursEditor';

/** Passo 2 do Wizard (spec 13 §4.1): em quais dias e quanto tempo — dia desligado é folga fixa. */
export function HoursStep({ value, onChange }: { value: WeekdayMinutes; onChange: (next: WeekdayMinutes) => void }) {
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

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <WeekdayHoursEditor value={value} onChange={onChange} title={null} />
      </div>
      {value.every((m) => m === 0) && (
        <p className="text-[11px] text-amber-300">Escolha pelo menos um dia de estudo para montar o plano.</p>
      )}
    </div>
  );
}
