import {
  AlertTriangle,
  Ban,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Eye,
  Gauge,
  Lightbulb,
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
 * Prancheta de Leitura / Folha de Prova (spec 11):
 * Alto contraste tipográfico, ausência de caixas aninhadas desnecessárias,
 * metadados estruturados e fluxo natural do olhar para as opções de resposta.
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
    <article aria-label="Folha de questão" className="rounded-2xl border border-white/[0.08] bg-[#0E121B] shadow-sm overflow-hidden transition-colors">
      {/* Barra de metadados da questão com linhas de 1px e chips objetivos */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.015] px-5 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Origem e concurso */}
          <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] font-medium text-slate-200">
            <Bookmark size={12} className="text-[var(--fofo-accent)]" />
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
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[11px] text-slate-300">
              <StatusSquare tone={badge.tone} />
              {badge.label}
            </span>
          )}
          {question.acervo_uncertain === 1 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300"
              title="Classificação sugerida pela IA"
            >
              <AlertTriangle size={11} className="text-amber-400" />
              Classificação incerta
            </span>
          )}
          {annulled && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[11px] text-slate-400">
              <Ban size={11} className="text-slate-400" />
              Anulada pela banca
            </span>
          )}
        </div>
      </div>

      {/* Enunciado da questão: superfície editorial limpa com alto contraste */}
      <div className="p-5 sm:p-6 space-y-5">
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-100 font-normal">
          {question.statement}
        </p>

        {annulled && (
          <ul className="space-y-1.5 border-t border-white/[0.06] pt-3 text-sm text-slate-300">
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
      </div>

      {/* Barra de ação inferior antes de responder */}
      {!annulled && !props.locked && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-white/[0.015] px-5 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {props.onHint && (
              <button
                type="button"
                onClick={props.onHint}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--fofo-accent)]/30 bg-[var(--fofo-accent)]/5 px-3 py-1.5 font-medium text-[var(--fofo-accent-text)] transition-colors hover:bg-[var(--fofo-accent)]/15"
              >
                <Lightbulb size={13} className="text-[var(--fofo-accent)]" />
                Pedir pista à FofoIA
              </button>
            )}
            <button
              type="button"
              onClick={props.onFirstContact}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-slate-300 transition-colors hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-white"
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
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-300 transition-colors hover:border-white/[0.18] hover:text-white disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                disabled={position.index >= position.total - 1}
                onClick={position.onNext}
                aria-label="Próxima questão"
                title="Próxima questão"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-300 transition-colors hover:border-white/[0.18] hover:text-white disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
