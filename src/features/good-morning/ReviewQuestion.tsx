import { useRef, useState } from 'react';
import { deriveDiagnosis } from '../../lib/dailyReview';
import { parseQuestionOptions } from '../../lib/questionOptions';
import type { AiDissection, Question, ReviewConfidence, SelfDiagnosisType } from '../../types/database';
import { AnswerCorrection } from '../answer-flow/AnswerCorrection';
import { AnswerOptions } from '../answer-flow/AnswerOptions';
import { ConfidencePicker } from '../answer-flow/ConfidencePicker';
import { DiagnosisPicker } from '../answer-flow/DiagnosisPicker';

export interface ReviewQuestionResult {
  selectedOption: string;
  isCorrect: boolean;
  confidence: ReviewConfidence;
  diagnosis: SelfDiagnosisType;
  timeSpentSeconds: number;
}

/**
 * Uma questão da Revisão do dia: confiança antes de responder (calibra o "acho que sei"), correção logo depois e o
 * diagnóstico já marcado pela confiança e pelo acerto (no erro, o "Por quê?"). Nada é gravado até "Próxima".
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
  const isCorrect = answer !== null && answer.key === question.final_answer.trim().toUpperCase();

  const choose = (key: string) => {
    if (!confidence || answer) return;
    setAnswer({ key, seconds: Math.round((Date.now() - shownAt.current) / 1000) });
    setDiagnosis(deriveDiagnosis(confidence, key === question.final_answer.trim().toUpperCase()));
  };

  return (
    <div className="fofolab-enter space-y-3">
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-100">{question.statement}</p>
      <ConfidencePicker value={confidence} disabled={answer !== null} onChange={setConfidence} />
      {confidence && <AnswerOptions options={options} finalAnswer={question.final_answer} picked={answer?.key ?? null} onPick={choose} />}
      {answer && diagnosis && (
        <AnswerCorrection question={question} isCorrect={isCorrect} dissection={dissection}>
          <DiagnosisPicker isCorrect={isCorrect} confidence={confidence} value={diagnosis} onChange={setDiagnosis} />
          <button
            type="button"
            onClick={() => {
              if (confidence) onSubmit({ selectedOption: answer.key, isCorrect, confidence, diagnosis, timeSpentSeconds: answer.seconds });
            }}
            className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-400"
          >
            Próxima
          </button>
        </AnswerCorrection>
      )}
    </div>
  );
}
