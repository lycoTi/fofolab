import type { ReactNode } from 'react';
import { Compass, Sparkles } from 'lucide-react';
import { useCurrentFofoTheme } from '../mascot/FofoOutfitContext';
import type { ExamPartProgress } from './headerSummary';

interface AppHeaderProps {
  /** Leitura ampliada: escondido por CSS, não desmontado (o relógio do bloco continua contando). */
  hidden: boolean;
  /** O Fofo com a roupa de agora, antes de tudo (zona do Fofo: só pisca). */
  mascot?: ReactNode;
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
  mascot,
  planLabel,
  daysUntilExam,
  examParts,
  modeSwitch,
  saveStatus,
  onRecalibrate,
  blockClock,
}: AppHeaderProps) {
  const showDays = daysUntilExam !== null && daysUntilExam > 0;
  const theme = useCurrentFofoTheme();

  return (
    <header
      style={{ backgroundImage: theme.palette.ambientGradient }}
      className={`shrink-0 flex-nowrap items-center justify-between gap-4 border-b border-white/[0.07] bg-slate-950/70 backdrop-blur-sm px-5 py-2.5 transition-colors duration-300 ${
        hidden ? 'hidden' : 'flex'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {mascot}
        {modeSwitch}
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
          <strong className="truncate font-medium text-slate-200">{planLabel}</strong>
          {showDays && <span className="shrink-0">{formatDays(daysUntilExam)}</span>}
          {examParts.map((part) => (
            <span key={part.code} className="shrink-0">{`${part.code} ${part.coveragePercent}% visto`}</span>
          ))}
          {theme.festiveNotice && (
            <span
              className="hidden lg:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: theme.palette.accentSubtle,
                color: theme.palette.accentText,
                borderColor: theme.palette.accentBorder,
              }}
            >
              <Sparkles size={11} />
              {theme.festiveNotice}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {saveStatus}
        <button
          type="button"
          onClick={onRecalibrate}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
          title="Recalibrar momento, horas ou estratégia"
        >
          <Compass size={13} style={{ color: theme.palette.accent }} />
          Recalibrar perfil
        </button>
        {blockClock}
      </div>
    </header>
  );
}
