import { DIAGNOSIS_LABEL } from '../../lib/answerLabels';
import { getAllowedDiagnoses } from '../../lib/diagnosis';
import type { ReviewConfidence, SelfDiagnosisType } from '../../types/database';
import { chip, chipOff, chipOn } from './ConfidencePicker';

/**
 * Diagnóstico depois de responder (spec 11 §5.5): no acerto vem deduzido da confiança (zero toques, trocável); no erro,
 * um toque em "Por quê?". Falsa certeza ganha um convite a entender a ideia; chute errado é acolhido como 1º contato.
 */
export function DiagnosisPicker({
  isCorrect,
  confidence,
  value,
  onChange,
}: {
  isCorrect: boolean;
  confidence: ReviewConfidence | null;
  value: SelfDiagnosisType;
  onChange: (diagnosis: SelfDiagnosisType) => void;
}) {
  const allowed = getAllowedDiagnoses({ kind: 'answered', isCorrect });
  return (
    <div className="space-y-1.5">
      {!isCorrect && confidence === 'SURE' && (
        <p className="text-xs font-medium text-amber-200">Você tinha certeza. Vale entender de onde veio essa ideia.</p>
      )}
      {!isCorrect && confidence === 'GUESS' && (
        <p className="text-xs text-blue-200">Em mapeamento inicial: é um primeiro contato com isso, e a explicação é o que fixa.</p>
      )}
      <p className="text-xs text-slate-400">{isCorrect ? 'Como foi?' : 'Por quê?'}</p>
      <div className="flex flex-wrap gap-1.5">
        {allowed.map((d) => (
          <button key={d} type="button" aria-pressed={value === d} onClick={() => onChange(d)} className={`${chip} ${value === d ? chipOn : chipOff}`}>
            {DIAGNOSIS_LABEL[d]}
          </button>
        ))}
      </div>
    </div>
  );
}
