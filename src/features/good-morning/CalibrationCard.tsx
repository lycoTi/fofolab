import { Gauge } from 'lucide-react';
import type { ReviewConfidence } from '../../types/database';

interface CalibrationLine {
  confidence: ReviewConfidence;
  label: string;
  answered: number;
  accuracyPercent: number;
}

/**
 * Calibração: quanto o "tenho certeza" do estudante acerta de verdade (confidence-calibration-check). Saber que o
 * "acho que sei" acerta pouco é um sinal para revisar antes de confiar nele na prova.
 */
export function CalibrationCard({ lines }: { lines: CalibrationLine[] }) {
  return (
    <section aria-label="Sua calibração" className="space-y-2.5">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Gauge size={15} className="text-orange-400" />
        Sua calibração
      </h2>
      {lines.length === 0 ? (
        <p className="text-xs text-slate-400">
          Responda algumas questões na Revisão do dia: aqui aparece quanto você acerta quando diz que tem certeza.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {lines.map((l) => (
            <li key={l.confidence} className="text-xs text-slate-300">
              {`“${l.label}”: acertou ${l.accuracyPercent}% (${l.answered} ${l.answered === 1 ? 'questão' : 'questões'})`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
