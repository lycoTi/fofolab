import clsx from 'clsx';
import { Gauge, Timer } from 'lucide-react';
import { formatPacingTime } from '../../lib/pacingEngine';

export interface WorkbenchSessionHudProps {
  answeredCount: number;
  correctCount: number;
  accuracyPercent: number;
  avgSecondsPerQuestion: number;
  totalSessionSeconds: number;
  blockRunning?: boolean;
  onOpenSimulation?: () => void;
}

/**
 * Head-Up Display (HUD) do bloco de estudos em tempo real.
 * Exibe taxa de acerto da sessão atual, ritmo médio medido por questão e tempo acumulado.
 */
export function WorkbenchSessionHud({
  answeredCount,
  correctCount,
  accuracyPercent,
  avgSecondsPerQuestion,
  totalSessionSeconds,
  blockRunning,
  onOpenSimulation,
}: WorkbenchSessionHudProps) {
  if (answeredCount === 0) return null;

  return (
    <aside
      aria-label="Placar da sessão em tempo real"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950/60 px-4 py-2.5 text-xs shadow-sm backdrop-blur-[2px] transition-colors"
    >
      {/* Placar de acertos do bloco */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400">Acertos da sessão:</span>
        <span className="font-mono font-semibold text-slate-100 tabular-nums">
          {correctCount}/{answeredCount}
        </span>
        <span
          className={clsx(
            'rounded px-1.5 py-0.2 font-mono text-[10px] font-semibold tabular-nums',
            accuracyPercent >= 80
              ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : accuracyPercent >= 60
                ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300'
                : 'border border-rose-500/40 bg-rose-500/15 text-rose-300'
          )}
        >
          {accuracyPercent}%
        </span>
      </div>

      {/* Ritmo médio medido */}
      <div
        className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300 select-none"
        title="Ritmo médio de resolução medido nesta sessão"
      >
        <Timer size={13} className="text-amber-400 shrink-0" />
        <span className="text-slate-400">Ritmo:</span>
        <strong className="font-semibold text-white tabular-nums">
          {formatPacingTime(avgSecondsPerQuestion)}/q
        </strong>
      </div>

      {/* Tempo total de foco e atalho para simulação */}
      <div className="flex items-center gap-3">
        {blockRunning && (
          <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
            Bloco ativo
          </span>
        )}
        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
          Foco: {formatPacingTime(totalSessionSeconds)}
        </span>
        {onOpenSimulation && (
          <button
            type="button"
            onClick={onOpenSimulation}
            title="Abrir simulação de tempo para prova real"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--fofo-accent)] hover:underline transition-colors"
          >
            <Gauge size={12} className="shrink-0" />
            <span>Simular prova</span>
          </button>
        )}
      </div>
    </aside>
  );
}
