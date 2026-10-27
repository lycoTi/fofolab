import {
  AlertTriangle,
  Ban,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Eye,
  Gauge,
  Lightbulb,
  XCircle,
} from 'lucide-react';
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
  if (summary.isFirstContact) {
    return { label: 'Já respondida · 1º contato', tone: 'amber' };
  }
  if (!summary.lastIsCorrect) {
    return { label: 'Já respondida · Errou', tone: 'rose' };
  }
  if (summary.lastConfidence === 'GUESS' || summary.lastDiagnosis === 'LUCKY_GUESS') {
    return { label: 'Já respondida · Chutou', tone: 'amber' };
  }
  return { label: 'Já respondida · Acertou', tone: 'emerald' };
}

function complexityStyle(level: QuestionComplexityProfile['levelLabel']): string {
  switch (level) {
    case 'Fácil':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    case 'Média':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    case 'Difícil':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
  }
}

/**
 * Enunciado, confiança (obrigatória antes das alternativas — spec 11) e alternativas.
 * Antes de responder: saídas honestas (pista ou 1º contato) e paginação de questões seguindo o fluxo do olhar.
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
  onNotThisTopic?: () => void;
  position?: {
    index: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
  };
}) {
  const { question, complexity, attemptSummary, position } = props;
  const options = parseQuestionOptions(question.options_json);
  const annulled = question.is_annulled === 1;
  const origin = question.source_label ?? `${question.exam_board} (${question.exam_year})${question.organ ? ` • ${question.organ}` : ''}`;
  const badge = attemptSummary ? formatAttemptBadge(attemptSummary) : null;

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      {/* Cabeçalho com identidade visual, divisão por chips e 1px border */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Origem e concurso */}
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-slate-800/90 px-2.5 py-1 font-mono text-[11px] font-medium text-slate-200">
            <Bookmark size={12} className="text-orange-400" />
            <span>{origin}</span>
          </span>

          {/* Dificuldade em semáforo suave com explicador */}
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${complexityStyle(
              complexity.levelLabel
            )}`}
            title={complexity.summaryTip}
          >
            <Gauge size={12} />
            <span>{complexity.levelLabel}</span>
            <MetricExplainer explanation={explainQuestionComplexity(complexity, question.exam_board)} />
          </span>

          {/* Selos de histórico / status */}
          {badge && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/80 px-2 py-0.5 text-[11px] text-slate-300">
              <StatusSquare tone={badge.tone} />
              {badge.label}
            </span>
          )}
          {question.acervo_uncertain === 1 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300"
              title="Classificação ainda não confirmada: pesa metade no domínio."
            >
              <AlertTriangle size={11} className="text-amber-400" />
              Classificação incerta
            </span>
          )}
          {annulled && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-400">
              <Ban size={11} className="text-slate-400" />
              Anulada pela banca
            </span>
          )}
        </div>

        {props.onNotThisTopic && (
          <button
            type="button"
            onClick={props.onNotThisTopic}
            className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-[11px] text-slate-400 transition-colors hover:border-slate-800 hover:bg-slate-800/40 hover:text-slate-200"
          >
            <XCircle size={12} className="text-slate-500" />
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {props.onHint && (
              <button
                type="button"
                onClick={props.onHint}
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/30 px-3 py-1.5 font-medium text-orange-200 transition-colors hover:bg-orange-500/10"
              >
                <Lightbulb size={13} className="text-orange-400" />
                Pedir pista à FofoIA
              </button>
            )}
            <button
              type="button"
              onClick={props.onFirstContact}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
            >
              <Eye size={13} className="text-slate-400" />
              Ver explicação antes de responder
            </button>
          </div>

          {position && position.total > 0 && (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="pr-1 tabular-nums font-mono text-xs text-slate-400">
                Questão <strong className="font-semibold text-white">{position.index + 1}</strong> de{' '}
                <strong className="font-semibold text-white">{position.total}</strong>
              </span>
              <button
                type="button"
                disabled={position.index === 0}
                onClick={position.onPrev}
                aria-label="Questão anterior"
                title="Questão anterior"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-300 transition-colors hover:border-slate-700 hover:text-white disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                disabled={position.index >= position.total - 1}
                onClick={position.onNext}
                aria-label="Próxima questão"
                title="Próxima questão"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-300 transition-colors hover:border-slate-700 hover:text-white disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
