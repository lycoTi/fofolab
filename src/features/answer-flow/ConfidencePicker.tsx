import { CONFIDENCE_LABEL } from '../../lib/answerLabels';
import type { ReviewConfidence } from '../../types/database';

const ORDER: ReviewConfidence[] = ['SURE', 'THINK', 'GUESS'];

export const chip = 'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150';
export const chipOn = 'border-orange-500 bg-orange-500/15 text-orange-100';
export const chipOff = 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500';

/** Confiança antes de responder (Sei / Acho que sei / Vou chutar): calibra o "acho que sei" e deduz o diagnóstico. */
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
    <div className="space-y-1.5">
      <p className="text-xs text-slate-400">Antes de responder: quão seguro você está?</p>
      <div className="flex flex-wrap gap-1.5">
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
