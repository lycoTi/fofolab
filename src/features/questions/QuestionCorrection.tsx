import { ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import type { AiDissection, Question, ReviewConfidence, SelfDiagnosisType } from '../../types/database';
import { AnswerCorrection } from '../answer-flow/AnswerCorrection';
import { DiagnosisPicker } from '../answer-flow/DiagnosisPicker';

function prerequisitesOf(dissection: AiDissection | null): string[] {
  if (!dissection?.prerequisites_json) return [];
  try {
    const parsed = JSON.parse(dissection.prerequisites_json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Correção da aba Questões, embaixo da questão: veredito, gabarito oficial, conceitos-chave,
 * autodiagnóstico de calibração e aprofundamento centralizado com a FofoIA.
 */
export function QuestionCorrection(props: {
  question: Question;
  dissection: AiDissection | null;
  isCorrect: boolean;
  firstContact: boolean;
  confidence: ReviewConfidence | null;
  diagnosis: SelfDiagnosisType | null;
  onDiagnosis: (diagnosis: SelfDiagnosisType) => void;
  feedback: string | null;
  aiConfigured: boolean;
  onGenerateDissection?: (question: Question) => Promise<{ ok: boolean; message?: string }>;
  onDeepen?: () => void;
  onNextQuestion?: () => void;
  position?: {
    index: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
  };
}) {
  const prerequisites = prerequisitesOf(props.dissection);
  const { position } = props;

  return (
    <AnswerCorrection question={props.question} isCorrect={props.isCorrect} dissection={props.dissection} firstContact={props.firstContact}>
      {prerequisites.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <span className="font-medium text-slate-400">Conceitos-chave:</span>
          {prerequisites.map((p) => (
            <span key={p} className="rounded-md border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[11px] text-purple-300">
              {p}
            </span>
          ))}
        </div>
      )}
      {!props.firstContact && (
        <DiagnosisPicker isCorrect={props.isCorrect} confidence={props.confidence} value={props.diagnosis} onChange={props.onDiagnosis} />
      )}
      {props.feedback && <p className="text-xs text-emerald-300 font-medium">{props.feedback}</p>}

      {/* Barra de ação inferior: aprofundamento na FofoIA à esquerda e navegação à direita */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3.5">
        {props.onDeepen ? (
          <button
            type="button"
            onClick={props.onDeepen}
            aria-label="Aprofundar com a FofoIA"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--fofo-accent)]/30 bg-[var(--fofo-accent)]/10 px-3.5 py-1.5 text-xs font-semibold text-[var(--fofo-accent-text)] transition-colors hover:bg-[var(--fofo-accent)]/20 active:scale-[0.97]"
          >
            <GraduationCap size={14} className="text-[var(--fofo-accent)]" />
            <span>{props.dissection ? 'Ver explicação na FofoIA' : 'Explicar com a FofoIA'}</span>
            <kbd aria-hidden="true" className="ml-1 rounded bg-white/[0.12] px-1 py-0.2 text-[10px] font-mono text-slate-300">
              E
            </kbd>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          {position && position.total > 0 && (
            <div className="flex items-center gap-1.5">
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
          {props.onNextQuestion && (
            <button
              type="button"
              onClick={props.onNextQuestion}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3.5 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/[0.14] hover:text-white active:scale-[0.97]"
            >
              <span>Próxima questão →</span>
              <kbd
                aria-hidden="true"
                className="rounded bg-white/[0.12] px-1 py-0.2 text-[10px] font-mono text-slate-300"
              >
                ↵
              </kbd>
            </button>
          )}
        </div>
      </div>
    </AnswerCorrection>
  );
}
