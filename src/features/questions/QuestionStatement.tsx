import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Highlighter } from 'lucide-react';
import {
  clearAllHighlights,
  loadHighlights,
  mergeHighlights,
  removeHighlightAt,
  saveHighlights,
  splitTextByHighlights,
  type HighlightRange,
} from './questionHighlights';

export interface QuestionStatementProps {
  questionId: string;
  statement: string;
}

interface SelectionCoords {
  start: number;
  end: number;
  x: number;
  y: number;
}

/**
 * Enunciado da questão com ferramenta de grifo tátil (marca-texto).
 * Permite selecionar termos restritivos (ex.: "vedado", "exclusivamente")
 * e persistir os grifos localmente para revisão ativa.
 */
export function QuestionStatement({ questionId, statement }: QuestionStatementProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<HighlightRange[]>(() => loadHighlights(questionId));
  const [pendingSelection, setPendingSelection] = useState<SelectionCoords | null>(null);

  // Recarrega grifos quando mudar de questão
  useEffect(() => {
    setHighlights(loadHighlights(questionId));
    setPendingSelection(null);
  }, [questionId]);

  const updateSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) {
      setPendingSelection(null);
      return;
    }

    if (!containerRef.current.contains(sel.anchorNode) || !containerRef.current.contains(sel.focusNode)) {
      setPendingSelection(null);
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      setPendingSelection(null);
      return;
    }

    try {
      const range = sel.getRangeAt(0);
      const preCaret = range.cloneRange();
      preCaret.selectNodeContents(containerRef.current);
      preCaret.setEnd(range.startContainer, range.startOffset);
      const start = preCaret.toString().length;
      const end = start + sel.toString().length;

      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      setPendingSelection({
        start,
        end,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top,
      });
    } catch {
      setPendingSelection(null);
    }
  }, []);

  const handleApplyHighlight = useCallback(() => {
    if (!pendingSelection) return;
    const next = mergeHighlights(highlights, {
      start: pendingSelection.start,
      end: pendingSelection.end,
    });
    setHighlights(next);
    saveHighlights(questionId, next);
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [highlights, pendingSelection, questionId]);

  const handleRemoveHighlight = useCallback(
    (index: number) => {
      const next = removeHighlightAt(highlights, index);
      setHighlights(next);
      saveHighlights(questionId, next);
    },
    [highlights, questionId]
  );

  const handleClearAll = useCallback(() => {
    setHighlights([]);
    clearAllHighlights(questionId);
    setPendingSelection(null);
  }, [questionId]);

  // Tecla 'G' aplica o grifo quando houver seleção
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'g' || e.key === 'G') && pendingSelection) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        handleApplyHighlight();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingSelection, handleApplyHighlight]);

  const segments = splitTextByHighlights(statement, highlights);

  return (
    <div className="relative space-y-2">
      {/* Indicador de grifos quando existirem */}
      {highlights.length > 0 && (
        <div className="flex items-center justify-end gap-2 text-[11px] text-slate-400 select-none pb-1">
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-400/90">
            <Highlighter size={11} className="text-amber-400" />
            <span>
              {highlights.length} {highlights.length === 1 ? 'grifo' : 'grifos'}
            </span>
          </span>
          <button
            type="button"
            onClick={handleClearAll}
            title="Limpar todos os grifos desta questão"
            aria-label="Limpar todos os grifos"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <Eraser size={11} />
            <span className="text-[10px]">Limpar</span>
          </button>
        </div>
      )}

      {/* Caixa do enunciado com seleção capturada */}
      <div
        ref={containerRef}
        onMouseUp={updateSelection}
        onKeyUp={updateSelection}
        className="whitespace-pre-line text-[15px] leading-relaxed text-slate-100 font-normal select-text"
      >
        {segments.map((seg, idx) => {
          if (seg.isHighlight) {
            return (
              <mark
                key={`hl-${seg.index ?? idx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (seg.index !== undefined) handleRemoveHighlight(seg.index);
                }}
                className="rounded-sm bg-amber-400/20 text-amber-200 border-b border-amber-400/50 px-0.5 py-0.2 hover:bg-amber-400/30 hover:border-amber-300 transition-colors cursor-pointer select-text font-medium"
                title="Grifo ativo · Clique para desmarcar"
              >
                {seg.text}
              </mark>
            );
          }
          return <span key={`txt-${idx}`}>{seg.text}</span>;
        })}
      </div>

      {/* Balão flutuante para grifar texto selecionado */}
      {pendingSelection && (
        <div
          style={{
            left: `${Math.max(40, Math.min(pendingSelection.x, 300))}px`,
            top: `${Math.max(0, pendingSelection.y - 34)}px`,
          }}
          className="absolute z-20 flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-900/95 px-2 py-1 text-xs shadow-lg backdrop-blur-sm transition-all -translate-x-1/2"
        >
          <button
            type="button"
            onClick={handleApplyHighlight}
            className="inline-flex items-center gap-1 font-medium text-amber-300 hover:text-amber-100 transition-colors text-[11px]"
          >
            <Highlighter size={12} className="text-amber-400" />
            <span>Grifar</span>
            <kbd className="rounded bg-white/[0.1] px-1 py-0.2 text-[9px] font-mono text-slate-300">
              G
            </kbd>
          </button>
        </div>
      )}
    </div>
  );
}
