import { useCallback, useEffect, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Largura de um painel lateral que o estudante ajusta arrastando a divisória.
 * A preferência fica neste computador (localStorage): é só conforto visual, não é dado de estudo.
 */
export function useResizableWidth(storageKey: string, defaultWidth: number, min: number, max: number) {
  const clamp = useCallback((value: number) => Math.max(min, Math.min(max, Math.round(value))), [min, max]);

  const [width, setWidthState] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      return Number.isFinite(saved) && saved >= min && saved <= max ? saved : defaultWidth;
    } catch {
      return defaultWidth;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(width));
    } catch {
      // Sem localStorage (janela privada): a largura só não é lembrada
    }
  }, [storageKey, width]);

  const setWidth = useCallback((value: number) => setWidthState(clamp(value)), [clamp]);
  const reset = useCallback(() => setWidthState(defaultWidth), [defaultWidth]);

  return { width, setWidth, reset, min, max };
}

interface ResizeHandleProps {
  label: string;
  width: number;
  min: number;
  max: number;
  /** `grow-right`: o painel fica à esquerda da divisória; `grow-left`: à direita. */
  direction: 'grow-right' | 'grow-left';
  onResize: (width: number) => void;
  onReset?: () => void;
}

const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;
const RESIZING_CLASS = 'fofolab-resizing';

export function ResizeHandle({ label, width, min, max, direction, onResize, onReset }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const sign = direction === 'grow-right' ? 1 : -1;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    // Iframes (leitor de PDF) engolem o ponteiro durante o arraste: desligados via CSS enquanto arrasta
    document.body.classList.add(RESIZING_CLASS);
    setDragging(true);

    const handleMove = (moveEvent: PointerEvent) => {
      onResize(startWidth + sign * (moveEvent.clientX - startX));
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      document.body.classList.remove(RESIZING_CLASS);
      setDragging(false);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onResize(width + sign * step);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onResize(width - sign * step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      onResize(min);
    } else if (event.key === 'End') {
      event.preventDefault();
      onResize(max);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={`${label} — arraste para ajustar (duplo clique volta ao tamanho padrão)`}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
      className={`group relative w-1.5 shrink-0 cursor-col-resize outline-none transition-colors ${
        dragging ? 'bg-orange-500/60' : 'bg-slate-800/70 hover:bg-orange-500/40 focus-visible:bg-orange-500/50'
      }`}
    >
      <span className="absolute inset-y-0 -left-1.5 -right-1.5" aria-hidden="true" />
    </div>
  );
}
