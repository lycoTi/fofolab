import { useState } from 'react';
import { ChevronLeft, ChevronRight, GraduationCap, Loader2, Sparkles } from 'lucide-react';
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
 * Correção da aba Questões, embaixo da questão: veredito, gabarito, explicação guardada (ou "Gerar explicação", só quando
 * pedido), conceitos-chave, diagnóstico e o caminho para ir além com a FofoIA.
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
  onNextSameSubject?: () => void;
  nextSameSubjectLabel?: string | null;
  position?: {
    index: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
  };
}) {
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const prerequisites = prerequisitesOf(props.dissection);
  const { position } = props;

  const generate = async () => {
    if (!props.onGenerateDissection || generating) return;
    setGenerating(true);
    setGenerateMessage(null);
    try {
      const result = await props.onGenerateDissection(props.question);
      if (!result.ok) setGenerateMessage(result.message ?? 'Não foi possível gerar a explicação agora.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AnswerCorrection question={props.question} isCorrect={props.isCorrect} dissection={props.dissection} firstContact={props.firstContact}>
      {!props.dissection && (
        <div className="space-y-2.5 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.015] p-3.5 text-xs text-slate-300">
          <p>Esta questão ainda não tem explicação.</p>
          {props.aiConfigured && props.onGenerateDissection ? (
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fofo-accent)] px-3 py-1.5 font-semibold text-white transition-colors hover:bg-[var(--fofo-accent-hover)] disabled:opacity-60 shadow-sm"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {generating ? 'Gerando explicação…' : 'Gerar explicação'}
            </button>
          ) : (
            <p className="text-[11px] text-slate-500">
              Quando a IA estiver configurada, você poderá gerá-la aqui (ela fica guardada para as próximas vezes).
            </p>
          )}
          {generateMessage && <p className="text-[11px] text-amber-300">{generateMessage}</p>}
        </div>
      )}
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

      {/* Barra de ação inferior: a numeração e navegação seguem o olhar do usuário */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3.5">
        {props.onDeepen ? (
          <button
            type="button"
            onClick={props.onDeepen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--fofo-accent)]/30 bg-[var(--fofo-accent)]/5 px-3 py-1.5 text-xs font-semibold text-[var(--fofo-accent-text)] transition-colors hover:bg-[var(--fofo-accent)]/15"
          >
            <GraduationCap size={13} className="text-[var(--fofo-accent)]" />
            Aprofundar com a FofoIA
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
          {props.onNextSameSubject && props.nextSameSubjectLabel && (
            <button
              type="button"
              onClick={props.onNextSameSubject}
              title={`Avançar para a próxima questão inédita sobre ${props.nextSameSubjectLabel}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-200 transition-all duration-150 hover:bg-amber-500/20 active:scale-[0.97]"
            >
              Próxima sobre {props.nextSameSubjectLabel} →
            </button>
          )}
          {props.onNextQuestion && (
            <button
              type="button"
              onClick={props.onNextQuestion}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3.5 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/[0.14] hover:text-white active:scale-[0.97]"
            >
              {props.onNextSameSubject && props.nextSameSubjectLabel ? 'Outro tema →' : 'Próxima questão →'}
            </button>
          )}
        </div>
      </div>
    </AnswerCorrection>
  );
}
