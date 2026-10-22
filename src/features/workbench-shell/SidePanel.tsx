import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ResizeHandle } from '../../components/ResizeHandle';

/** Largura do trilho de ícones que fica no lugar do painel recolhido. */
export const RAIL_WIDTH = 44;

interface SidePanelProps {
  side: 'left' | 'right';
  label: string;
  open: boolean;
  width: number;
  onOpenChange: (open: boolean) => void;
  /** Rótulo da seta na borda, ex.: "Recolher tópicos". */
  collapseLabel: string;
  /** Ícones mostrados quando recolhido: o estudante vê onde o painel foi parar. */
  rail: ReactNode;
  resize?: { label: string; min: number; max: number; onResize: (width: number) => void; onReset: () => void };
  /** Escondido sem desmontar (leitura ampliada do PDF). */
  hidden?: boolean;
  children: ReactNode;
}

/**
 * Painel lateral que recolhe para um trilho em vez de sumir. A largura anima por CSS (`.fofolab-panel`);
 * o conteúdo mantém a largura cheia durante a animação para o texto não se reorganizar, e continua
 * montado quando recolhido (conversa, rascunho e página do PDF não se perdem).
 */
export function SidePanel({
  side,
  label,
  open,
  width,
  onOpenChange,
  collapseLabel,
  rail,
  resize,
  hidden = false,
  children,
}: SidePanelProps) {
  const isLeft = side === 'left';
  const CollapseIcon = isLeft ? ChevronLeft : ChevronRight;
  const asideRef = useRef<HTMLElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const previousOpen = useRef(open);

  // Quem usa teclado não perde o lugar: o botão clicado some (seta) ou fica inerte (trilho),
  // então o foco vai para o controle equivalente do novo estado. Mudanças automáticas (leitura do PDF)
  // não roubam o foco, porque nelas o foco está fora do painel.
  useEffect(() => {
    if (previousOpen.current === open) return;
    previousOpen.current = open;
    const active = document.activeElement;
    const focusWasHere = active === document.body || (active !== null && asideRef.current?.contains(active));
    if (!focusWasHere) return;
    if (open) {
      collapseRef.current?.focus();
      return;
    }
    railRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [open]);

  const panel = (
    <aside
      ref={asideRef}
      aria-label={label}
      style={{ width: open ? width : RAIL_WIDTH }}
      className={`fofolab-panel relative h-full shrink-0 overflow-hidden border-slate-800 bg-slate-900/70 ${
        isLeft ? 'border-r' : 'border-l'
      }`}
    >
      <div
        data-panel-content
        inert={!open}
        aria-hidden={!open}
        style={{ width }}
        className={`fofolab-panel-content h-full ${open ? 'opacity-100' : 'pointer-events-none opacity-0'} ${
          isLeft ? '' : 'ml-auto'
        }`}
      >
        {children}
      </div>

      {open && (
        <button
          ref={collapseRef}
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={collapseLabel}
          title={collapseLabel}
          className={`absolute top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 ${
            isLeft ? 'right-1.5' : 'left-1.5'
          }`}
        >
          <CollapseIcon size={14} />
        </button>
      )}

      <div
        ref={railRef}
        inert={open}
        aria-hidden={open}
        style={{ width: RAIL_WIDTH }}
        className={`fofolab-rail absolute inset-y-0 flex flex-col items-center gap-2.5 pt-2.5 ${isLeft ? 'left-0' : 'right-0'} ${
          open ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        {rail}
      </div>
    </aside>
  );

  const handle = resize && open && (
    <ResizeHandle
      label={resize.label}
      direction={isLeft ? 'grow-right' : 'grow-left'}
      width={width}
      min={resize.min}
      max={resize.max}
      onResize={resize.onResize}
      onReset={resize.onReset}
    />
  );

  return (
    <div className={`h-full shrink-0 ${hidden ? 'hidden' : 'flex'}`}>
      {isLeft ? (
        <>
          {panel}
          {handle}
        </>
      ) : (
        <>
          {handle}
          {panel}
        </>
      )}
    </div>
  );
}

interface RailButtonProps {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
}

export function RailButton({ label, icon, active = false, onClick }: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg border bg-slate-900 text-slate-300 hover:text-white ${
        active ? 'border-orange-500/70' : 'border-slate-700'
      }`}
    >
      {icon}
    </button>
  );
}
