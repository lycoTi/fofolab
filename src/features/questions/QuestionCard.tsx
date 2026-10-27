import { Eye, Lightbulb, Star } from 'lucide-react';
import { MetricExplainer } from '../../components/MetricExplainer';
import { StatusSquare } from '../../components/StatusSquare';
import type { QuestionAttemptSummary } from '../../lib/acervo/topicQuestions';
import type { QuestionComplexityProfile } from '../../lib/aiRouter';
import { explainQuestionComplexity } from '../../lib/explainabilityEngine';
import { parseQuestionOptions } from '../../lib/questionOptions';
import type { Question, ReviewConfidence } from '../../types/database';
import { AnswerOptions, isCertoErradoOptions, optionName } from '../answer-flow/AnswerOptions';
import { ConfidencePicker } from '../answer-flow/ConfidencePicker';

function formatAttemptBadge(summary: QuestionAttemptSummary): { label: string; tone: 'emerald' | 'amber' | 'rose' } {
  if (summary.lastDiagnosis === 'FIRST_CONTACT') {
    return { label: 'Já respondida · 1º contato', tone: 'amber' };
  }
  if (!summary.lastIsCorrect) {
    return { label: 'Já respondida · Errou', tone: 'rose' };
  }
  if (summary.lastConfidence === 'GUESS' || summary.lastDiagnosis === 'GUESSED_RIGHT') {
    return { label: 'Já respondida · Chutou', tone: 'amber' };
  }
  return { label: 'Já respondida · Acertou', tone: 'emerald' };
}

/**
 * Enunciado, confiança (obrigatória antes das alternativas — spec 11) e alternativas. Antes de responder, duas saídas
 * honestas: pedir uma pista à FofoIA (sem gabarito) ou ver a explicação como primeiro contato. Item anulado pela banca
 * fica só para ler (spec 12c §5.6): não há gabarito para conferir nem domínio para mexer.
 */
export function QuestionCard(props: {
  question: Question;
  complexity: QuestionComplexityProfile;
  attemptSummary?: QuestionAttemptSummary | null;
  confidence: ReviewConfidence | null;
  picked: string | null;
  locked: boolean;
  onConfidence: (confidence: ReviewConfidence) => void;
  onPick: (key: string) => void;
  onFirstContact: () => void;
  onHint?: () => void;
  /** Item do acervo no tópico: "Não é deste tópico" tira o item daqui (spec 12c §5.7). */
  onNotThisTopic?: () => void;
}) {
  const { question, complexity, attemptSummary } = props;
  const options = parseQuestionOptions(question.options_json);
  const annulled = question.is_annulled === 1;
  const origin = question.source_label ?? `${question.exam_board} (${question.exam_year})${question.organ ? ` • ${question.organ}` : ''}`;
  const badge = attemptSummary ? formatAttemptBadge(attemptSummary) : null;
  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md border border-blue-500/30 bg-blue-500/15 px-2.5 py-1 font-semibold text-blue-300">{origin}</span>
        <span className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1 text-amber-300" title={complexity.summaryTip}>
          <span className="flex items-center">
            {Array.from({ length: complexity.stars }).map((_, i) => (
              <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
            ))}
          </span>
          <span className="ml-1 text-[11px] text-slate-300">{complexity.levelLabel}</span>
        </span>
        <MetricExplainer explanation={explainQuestionComplexity(complexity, question.exam_board)} />
        {badge && (
          <span className="flex items-center gap-1.5 text-slate-300">
            <StatusSquare tone={badge.tone} />
            {badge.label}
          </span>
        )}
        {question.acervo_uncertain === 1 && (
          <span className="flex items-center gap-1.5 text-slate-300" title="Classificação ainda não confirmada: pesa metade no domínio.">
            <StatusSquare tone="amber" />
            Classificação incerta
          </span>
        )}
        {annulled && (
          <span className="flex items-center gap-1.5 text-slate-300">
            <StatusSquare tone="slate" />
            Anulada pela banca
          </span>
        )}
        {props.onNotThisTopic && (
          <button type="button" onClick={props.onNotThisTopic} className="ml-auto rounded-md px-2 py-1 text-slate-400 hover:text-slate-200">
            Não é deste tópico
          </button>
        )}
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-100">{question.statement}</p>

      {annulled && (
        <ul className="space-y-1.5 border-t border-slate-800 pt-3 text-sm text-slate-300">
          {options.map((option) => (
            <li key={option.key}>{optionName(option, isCertoErradoOptions(options))}</li>
          ))}
        </ul>
      )}

      {!annulled && !props.locked && (
        <ConfidencePicker value={props.confidence} disabled={props.picked !== null} onChange={props.onConfidence} />
      )}
      {!annulled && (props.confidence || props.picked) && (
        <AnswerOptions options={options} finalAnswer={question.final_answer} picked={props.picked} onPick={props.onPick} />
      )}

      {!annulled && !props.locked && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3 text-xs">
          {props.onHint && (
            <button type="button" onClick={props.onHint} className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 px-3 py-1.5 font-medium text-orange-200 hover:bg-orange-500/10">
              <Lightbulb size={13} />
              Pedir pista à FofoIA
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
