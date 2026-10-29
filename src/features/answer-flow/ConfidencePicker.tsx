import { CONFIDENCE_LABEL } from '../../lib/answerLabels';
import type { ReviewConfidence } from '../../types/database';

const ORDER: ReviewConfidence[] = ['SURE', 'RECENT', 'THINK', 'GUESS'];
const SHORTCUT_KEY: Record<ReviewConfidence, string> = {
  SURE: '1',
  RECENT: '2',
  THINK: '3',
  GUESS: '4',
};

export const chip = 'rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-all duration-150 select-none active:scale-[0.97]';
export const chipOn =
  'border-[var(--fofo-accent)] bg-[var(--fofo-accent-subtle)] text-[var(--fofo-accent-text)] shadow-sm font-semibold';
export const chipOff =
  'border-slate-800/80 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60 hover:text-white';

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
            className={`${chip} ${value === c ? chipOn : chipOff} inline-flex items-center gap-1.5 disabled:cursor-default`}
          >
            <span>{CONFIDENCE_LABEL[c]}</span>
            <kbd
              aria-hidden="true"
              className="rounded bg-white/[0.08] px-1 py-0.2 text-[10px] font-mono text-slate-400"
            >
              {SHORTCUT_KEY[c]}
            </kbd>
          </button>
        ))}
      </div>
    </div>
  );
}
