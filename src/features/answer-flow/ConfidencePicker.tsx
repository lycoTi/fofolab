import { CONFIDENCE_LABEL } from '../../lib/answerLabels';
import type { ReviewConfidence } from '../../types/database';

const ORDER: ReviewConfidence[] = ['SURE', 'RECENT', 'THINK', 'GUESS'];

export const chip = 'rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-all duration-150 select-none';
export const chipOn =
  'border-[var(--fofo-accent)] bg-[var(--fofo-accent-subtle)] text-[var(--fofo-accent-text)] shadow-sm font-semibold';
export const chipOff =
  'border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-white';

/** Confiança antes de responder (Sei / Estou estudando / Acho que sei / Vou chutar): calibra o diagnóstico e a retenção. */
export function ConfidencePicker({
  value,
  disabled = false,
  onChange,
}: {
  value: ReviewConfidence | null;
  disabled?: boolean;
  onChange: (confidence: ReviewConfidence) => void;
}) {
  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-medium text-slate-400">Antes de responder: quão seguro você está?</p>
      <div className="flex flex-wrap gap-2">
        {ORDER.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className={`${chip} ${value === c ? chipOn : chipOff} disabled:cursor-default`}
          >
            {CONFIDENCE_LABEL[c]}
          </button>
        ))}
      </div>
    </div>
  );
}
