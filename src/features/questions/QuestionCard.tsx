import { Eye, Star } from 'lucide-react';
import { MetricExplainer } from '../../components/MetricExplainer';
import type { QuestionComplexityProfile } from '../../lib/aiRouter';
import { explainQuestionComplexity } from '../../lib/explainabilityEngine';
import { parseQuestionOptions } from '../../lib/questionOptions';
import type { Question, ReviewConfidence } from '../../types/database';
import { AnswerOptions } from '../answer-flow/AnswerOptions';
import { ConfidencePicker } from '../answer-flow/ConfidencePicker';

/**
 * Enunciado, confiança (obrigatória antes das alternativas — spec 11) e alternativas. Antes de responder, duas saídas
 * honestas: pedir uma pista à FofoIA (sem gabarito) ou ver a explicação como primeiro contato.
 */
export function QuestionCard(props: {
  question: Question;
  complexity: QuestionComplexityProfile;
  confidence: ReviewConfidence | null;
  picked: string | null;
  locked: boolean;
  onConfidence: (confidence: ReviewConfidence) => void;
  onPick: (key: string) => void;
  onFirstContact: () => void;
  onHint?: () => void;
}) {
  const { question, complexity } = props;
  const options = parseQuestionOptions(question.options_json);
  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md border border-blue-500/30 bg-blue-500/15 px-2.5 py-1 font-semibold text-blue-300">
          {question.exam_board} ({question.exam_year}){question.organ ? ` • ${question.organ}` : ''}
        </span>
        <span className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1 text-amber-300" title={complexity.summaryTip}>
          <span className="flex items-center">
            {Array.from({ length: complexity.stars }).map((_, i) => (
              <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
            ))}
          </span>
          <span className="ml-1 text-[11px] text-slate-300">{complexity.levelLabel}</span>
        </span>
        <MetricExplainer explanation={explainQuestionComplexity(complexity, question.exam_board)} />
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-100">{question.statement}</p>

      {!props.locked && <ConfidencePicker value={props.confidence} disabled={props.picked !== null} onChange={props.onConfidence} />}
      {(props.confidence || props.picked) && (
        <AnswerOptions options={options} finalAnswer={question.final_answer} picked={props.picked} onPick={props.onPick} />
      )}

      {!props.locked && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3 text-xs">
          {props.onHint && (
            <button type="button" onClick={props.onHint} className="rounded-lg border border-orange-500/30 px-3 py-1.5 font-medium text-orange-200 hover:bg-orange-500/10">
              🐹 Pedir pista à FofoIA
            </button>
          )}
          <button type="button" onClick={props.onFirstContact} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:text-white">
            <Eye size={13} />
            Ver explicação antes de responder
          </button>
        </div>
      )}
    </div>
  );
}
