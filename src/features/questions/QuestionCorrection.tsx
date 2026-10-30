import { useEffect, useState } from 'react';
import { Check, ChevronLeft, GraduationCap, NotebookPen, RotateCcw } from 'lucide-react';
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
  isConsultation?: boolean;
  onRedo?: () => void;
  onGenerateDissection?: (question: Question) => Promise<{ ok: boolean; message?: string }>;
  onDeepen?: () => void;
  onNextQuestion?: () => void;
  position?: {
    index: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
  };
  onSaveToNotebook?: (markdown: string) => void;
}) {
  const prerequisites = prerequisitesOf(props.dissection);
  const { position, onSaveToNotebook } = props;
  const [noteDraft, setNoteDraft] = useState('');
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [savedToNotebook, setSavedToNotebook] = useState(false);

  useEffect(() => {
    setNoteDraft('');
    setIsNoteOpen(false);
    setSavedToNotebook(false);
  }, [props.question.id]);

  const handleSaveNote = () => {
    if (!noteDraft.trim() || !onSaveToNotebook) return;
    const origin = props.question.source_label ?? `${props.question.exam_board} (${props.question.exam_year})`;
    const markdown = `### Nota da questão (${origin})\n> ${props.question.statement.slice(0, 140)}...\n\n**Insight:** ${noteDraft.trim()}`;
    onSaveToNotebook(markdown);
    setSavedToNotebook(true);
    setIsNoteOpen(false);
    setNoteDraft('');
  };

  return (
    <AnswerCorrection question={props.question} isCorrect={props.isCorrect} dissection={props.dissection} firstContact={props.firstContact} embedded>
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

      {/* Mini editor de notas para o caderno do tópico */}
      {isNoteOpen && onSaveToNotebook && (
        <div className="space-y-2 rounded-lg border border-slate-700/60 bg-slate-900/80 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-300">Anotar insight no caderno do tópico</span>
            <button
              type="button"
              onClick={() => setIsNoteOpen(false)}
              className="text-slate-400 hover:text-white text-[11px]"
            >
              Cancelar
            </button>
          </div>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Escreva a pegadinha ou conceito-chave que aprendeu nesta questão..."
            rows={2}
            autoFocus
            className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-[var(--fofo-accent)] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSaveNote();
              } else if (e.key === 'Escape') {
                setIsNoteOpen(false);
              }
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Ctrl+Enter para salvar</span>
            <button
              type="button"
              disabled={!noteDraft.trim()}
              onClick={handleSaveNote}
              className="rounded border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-medium text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
            >
              Salvar no caderno
            </button>
          </div>
        </div>
      )}

      {/* Barra de ação inferior: aprofundamento na FofoIA à esquerda e navegação/avanço à direita */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {props.onDeepen && (
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
          )}
          {onSaveToNotebook && (
            <button
              type="button"
              onClick={() => {
                if (savedToNotebook) return;
                setIsNoteOpen((prev) => !prev);
              }}
              aria-label={savedToNotebook ? 'Salvo no caderno' : '+ Caderno'}
              title={savedToNotebook ? 'Insight já salvo no caderno do tópico' : 'Anotar insight desta questão no caderno do tópico'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white active:scale-[0.97]"
            >
              {savedToNotebook ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-300">Salvo no caderno</span>
                </>
              ) : (
                <>
                  <NotebookPen size={12} className="text-slate-400" />
                  <span>+ Caderno</span>
                </>
              )}
            </button>
          )}
          {props.isConsultation && props.onRedo && (
            <button
              type="button"
              onClick={props.onRedo}
              aria-label="Refazer"
              title="Permite resolver esta questão novamente"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white active:scale-[0.97]"
            >
              <RotateCcw size={12} className="text-slate-400" />
              <span>Refazer</span>
            </button>
          )}
        </div>

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
            </div>
          )}
          {props.onNextQuestion && (
            <button
              type="button"
              onClick={props.onNextQuestion}
              aria-label="Próxima questão →"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-200 transition-all hover:bg-emerald-500/20 hover:text-white active:scale-[0.97] shadow-sm"
            >
              <span>Próxima questão →</span>
              <kbd
                aria-hidden="true"
                className="rounded bg-emerald-500/20 px-1 py-0.2 text-[10px] font-mono text-emerald-300"
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
