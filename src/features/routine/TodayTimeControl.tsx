import { useState } from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import { Collapse } from '../../components/Collapse';
import { formatDuration } from '../../lib/timeFormat';

/** Tempos oferecidos para hoje: de 00:30 a 08:00, de meia em meia hora. */
const TIME_OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 30);

const chip =
  'inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 ' +
  'hover:border-orange-500/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400';

export interface TodayTime {
  minutes: number;
  /** Hoje está diferente do padrão (pode voltar ao tempo de sempre). */
  overridden: boolean;
  /** Minutos de hoje; 0 = "Hoje não vou estudar"; `null` = tempo de sempre. */
  onChange: (minutes: number | null) => void;
}

/**
 * "Mudar o tempo de hoje" (spec 13 §4.1): imprevisto, cansaço ou um dia mais livre mudam só hoje. O roteiro se refaz
 * com os blocos já feitos mantidos; nada vira dívida para amanhã.
 */
export function TodayTimeControl({ minutes, overridden, onChange }: TodayTime) {
  const [open, setOpen] = useState(false);
  const options = TIME_OPTIONS.includes(minutes) || minutes === 0 ? TIME_OPTIONS : [minutes, ...TIME_OPTIONS];

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-medium text-orange-400 hover:text-orange-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
      >
        <Clock size={12} />
        Mudar o tempo de hoje
      </button>
      <Collapse open={open}>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            aria-label="Tempo de hoje"
            value={minutes > 0 ? String(minutes) : ''}
            onChange={(e) => e.target.value && onChange(Number(e.target.value))}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
          >
            {minutes === 0 && <option value="">00:00</option>}
            {options.map((m) => (
              <option key={m} value={String(m)}>
                {formatDuration(m)}
              </option>
            ))}
          </select>
          {minutes > 0 && (
            <button type="button" className={chip} onClick={() => onChange(0)}>
              Hoje não vou estudar
            </button>
          )}
          {overridden && (
            <button type="button" className={chip} onClick={() => onChange(null)}>
              <RotateCcw size={11} />
              Voltar ao tempo de sempre
            </button>
          )}
        </div>
      </Collapse>
    </div>
  );
}
