import { useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, GraduationCap, Loader2, Sparkles } from 'lucide-react';
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
        <div className="space-y-2 rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-300">
          <p>Esta questão ainda não tem explicação.</p>
          {props.aiConfigured && props.onGenerateDissection ? (
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-orange-400 disabled:opacity-60"
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
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
          Conceitos-chave:
          {prerequisites.map((p) => (
            <span key={p} className="rounded-md border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-purple-300">
              {p}
            </span>
          ))}
        </p>
      )}
      {!props.firstContact && (
        <DiagnosisPicker isCorrect={props.isCorrect} confidence={props.confidence} value={props.diagnosis} onChange={props.onDiagnosis} />
      )}
      {props.feedback && <p className="text-[11px] text-emerald-300">{props.feedback}</p>}

      {/* Barra de ação inferior: a numeração e navegação seguem o olhar do usuário */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
        {props.onDeepen ? (
          <button
            type="button"
            onClick={props.onDeepen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 px-3 py-1.5 text-xs font-semibold text-orange-200 transition-colors hover:bg-orange-500/10"
          >
            <GraduationCap size={13} className="text-orange-400" />
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
          {props.onNextQuestion && (
            <button
              type="button"
              onClick={props.onNextQuestion}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-700"
            >
              Próxima questão →
            </button>
          )}
        </div>
      </div>
    </AnswerCorrection>
  );
}
