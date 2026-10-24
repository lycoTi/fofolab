import { useRef, useState } from 'react';
import { CheckCircle2, CircleHelp } from 'lucide-react';
import { RichText } from '../../components/RichText';
import { deriveDiagnosis } from '../../lib/dailyReview';
import { getAllowedDiagnoses } from '../../lib/diagnosis';
import { findCorrectOption, parseQuestionOptions, type QuestionOption } from '../../lib/questionOptions';
import type { AiDissection, Question, ReviewConfidence, SelfDiagnosisType } from '../../types/database';

export interface ReviewQuestionResult {
  selectedOption: string;
  isCorrect: boolean;
  confidence: ReviewConfidence;
  diagnosis: SelfDiagnosisType;
  timeSpentSeconds: number;
}

const CONFIDENCE: { id: ReviewConfidence; label: string }[] = [
  { id: 'SURE', label: 'Tenho certeza' },
  { id: 'THINK', label: 'Acho que sei' },
  { id: 'GUESS', label: 'Chutei' },
];

const DIAGNOSIS_LABEL: Record<SelfDiagnosisType, string> = {
  MASTERED: '🟢 Dominei',
  DOUBT: '🟡 Acertei na dúvida',
  BOARD_TRAP: '🟠 Pegadinha da banca',
  BASE_GAP: '🔴 Lacuna de base',
};

const chip = 'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150';
const chipOn = 'border-orange-500 bg-orange-500/15 text-orange-100';
const chipOff = 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500';

/** Certo/Errado mostra só a palavra; múltipla escolha mostra a letra com o texto. */
function optionName(option: QuestionOption, isCertoErrado: boolean): string {
  return isCertoErrado ? option.text : option.label;
}

/**
 * Uma questão da Revisão do dia: confiança antes de responder (calibra o "acho que sei"), correção logo depois e o
 * diagnóstico já marcado pela confiança e pelo acerto. Nada é gravado até "Próxima".
 */
export function ReviewQuestion({
  question,
  dissection,
  onSubmit,
}: {
  question: Question;
  dissection: AiDissection | null;
  onSubmit: (result: ReviewQuestionResult) => void;
}) {
  const shownAt = useRef(Date.now());
  const [confidence, setConfidence] = useState<ReviewConfidence | null>(null);
  const [answer, setAnswer] = useState<{ key: string; seconds: number } | null>(null);
  const [diagnosis, setDiagnosis] = useState<SelfDiagnosisType | null>(null);

  const options = parseQuestionOptions(question.options_json);
  const isCertoErrado = options.length === 2 && options.every((o) => o.key === 'C' || o.key === 'E');
  const correct = findCorrectOption(options, question.final_answer);
  const isCorrect = answer !== null && answer.key === question.final_answer.trim().toUpperCase();

  const choose = (key: string) => {
    if (!confidence || answer) return;
    const correctNow = key === question.final_answer.trim().toUpperCase();
    setAnswer({ key, seconds: Math.round((Date.now() - shownAt.current) / 1000) });
    setDiagnosis(deriveDiagnosis(confidence, correctNow));
  };

  return (
    <div className="fofolab-enter space-y-3">
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-100">{question.statement}</p>

      <div className="space-y-1.5">
        <p className="text-xs text-slate-400">Antes de responder: quão seguro você está?</p>
        <div className="flex flex-wrap gap-1.5">
          {CONFIDENCE.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={answer !== null}
              aria-pressed={confidence === c.id}
              onClick={() => setConfidence(c.id)}
              className={`${chip} ${confidence === c.id ? chipOn : chipOff} disabled:cursor-default`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {confidence && (
        <div className={isCertoErrado ? 'flex gap-2' : 'space-y-1.5'}>
          {options.map((o) => {
            const picked = answer?.key === o.key;
            let tone = 'border-slate-700 bg-slate-950/60 text-slate-200 hover:border-orange-500/50';
            if (answer && o.key === correct?.key) tone = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-100';
            else if (picked) tone = 'border-rose-500/60 bg-rose-500/10 text-rose-100';
            return (
              <button
                key={o.key}
                type="button"
                disabled={answer !== null}
                onClick={() => choose(o.key)}
                className={`block w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors duration-150 disabled:cursor-default ${tone}`}
              >
                {optionName(o, isCertoErrado)}
              </button>
            );
          })}
        </div>
      )}

      {answer && diagnosis && (
        <Correction
          isCorrect={isCorrect}
          gabarito={correct ? optionName(correct, isCertoErrado) : question.final_answer}
          gabaritoKey={question.final_answer.trim().toUpperCase()}
          dissection={dissection}
          diagnosis={diagnosis}
          onDiagnosis={setDiagnosis}
          onNext={() => {
            if (confidence) onSubmit({ selectedOption: answer.key, isCorrect, confidence, diagnosis, timeSpentSeconds: answer.seconds });
          }}
        />
      )}
    </div>
  );
}

function Correction(props: {
  isCorrect: boolean;
  gabarito: string;
  gabaritoKey: string;
  dissection: AiDissection | null;
  diagnosis: SelfDiagnosisType;
  onDiagnosis: (d: SelfDiagnosisType) => void;
  onNext: () => void;
}) {
  const allowed = getAllowedDiagnoses({ kind: 'answered', isCorrect: props.isCorrect });
  return (
    <div className="fofolab-enter space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${props.isCorrect ? 'text-emerald-300' : 'text-amber-300'}`}>
        {props.isCorrect ? <CheckCircle2 size={15} /> : <CircleHelp size={15} />}
        {props.isCorrect ? 'Você acertou.' : 'Não foi desta vez. Errar na revisão ajuda a fixar a resposta certa.'}
      </p>
      <p className="text-xs text-slate-300">{`Gabarito: ${props.gabaritoKey}${props.gabarito !== props.gabaritoKey ? ` · ${props.gabarito}` : ''}`}</p>
      {props.dissection && (
        <div className="space-y-1">
          <RichText text={props.dissection.dissection_markdown} className="text-xs leading-relaxed text-slate-200" />
          {props.dissection.provider_used === 'EXAMPLE' && (
            <p className="text-[10px] text-slate-500">Explicação de exemplo, escrita à mão para demonstrar o app.</p>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-xs text-slate-400">Como foi?</p>
        <div className="flex flex-wrap gap-1.5">
          {allowed.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={props.diagnosis === d}
              onClick={() => props.onDiagnosis(d)}
              className={`${chip} ${props.diagnosis === d ? chipOn : chipOff}`}
            >
              {DIAGNOSIS_LABEL[d]}
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={props.onNext} className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-400">
        Próxima
      </button>
    </div>
  );
}
