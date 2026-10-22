import type { ReactNode } from 'react';
import { Compass } from 'lucide-react';
import type { ExamPartProgress } from './headerSummary';

interface AppHeaderProps {
  /** Leitura ampliada: escondido por CSS, não desmontado (o relógio do bloco continua contando). */
  hidden: boolean;
  planLabel: string;
  daysUntilExam: number | null;
  examParts: ExamPartProgress[];
  modeSwitch?: ReactNode;
  saveStatus: ReactNode;
  onRecalibrate: () => void;
  blockClock: ReactNode;
}

function formatDays(days: number): string {
  return days === 1 ? '1 dia' : `${days} dias`;
}

/**
 * Cabeçalho de ponta a ponta, fora das colunas: abrir ou recolher painéis não muda a largura dele,
 * então nenhum controle troca de lugar. Não quebra linha — o nome do concurso é que encurta.
 */
export function AppHeader({
  hidden,
  planLabel,
  daysUntilExam,
  examParts,
  modeSwitch,
  saveStatus,
  onRecalibrate,
  blockClock,
}: AppHeaderProps) {
  const showDays = daysUntilExam !== null && daysUntilExam > 0;

  return (
    <header
      className={`shrink-0 flex-nowrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/40 px-5 py-3 ${
        hidden ? 'hidden' : 'flex'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {modeSwitch}
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
          <strong className="truncate text-slate-200">{planLabel}</strong>
          {showDays && <span className="shrink-0">{formatDays(daysUntilExam)}</span>}
          {examParts.map((part) => (
            <span key={part.code} className="shrink-0">{`${part.code} ${part.coveragePercent}% visto`}</span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {saveStatus}
        <button
          type="button"
          onClick={onRecalibrate}
          className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
          title="Recalibrar momento, horas ou estratégia"
        >
          <Compass size={13} className="text-orange-400" />
          Recalibrar perfil
        </button>
        {blockClock}
      </div>
    </header>
  );
}
