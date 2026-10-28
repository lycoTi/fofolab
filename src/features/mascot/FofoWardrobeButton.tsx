import { useEffect, useRef, useState } from 'react';
import { CurrentFofo } from './FofoOutfitContext';
import { FofoSprite } from './FofoSprite';
import { OUTFIT_LABELS, type OutfitId } from './wardrobe';

const OUTFITS = Object.keys(OUTFIT_LABELS) as OutfitId[];

const cell = 'fofo-hover flex items-center justify-center rounded-md border p-1 transition-colors duration-150';
const cellOn = 'border-orange-500 bg-orange-500/10';
const cellOff = 'border-transparent hover:border-slate-700';

/**
 * O Fofo do cabeçalho é um botão: abre o guarda-roupa (roupa automática ou uma fixa) e o "Fui nomeado!".
 * Passar o mouse numa roupa faz ela se mexer, como uma prévia.
 */
export function FofoWardrobeButton({
  outfit,
  automatic,
  fixedOutfit,
  appointed,
  onChooseOutfit,
  onAppointedChange,
}: {
  outfit: OutfitId;
  /** A roupa que valeria sem roupa fixa (pela hora, festa ou marco). */
  automatic: OutfitId;
  fixedOutfit: OutfitId | null;
  appointed: boolean;
  onChooseOutfit: (outfit: OutfitId | null) => void;
  onAppointedChange: (appointed: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Clique fora fecha (como os outros menus do app)
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${OUTFIT_LABELS[outfit]} — Guarda-roupa do Fofo`}
        title={OUTFIT_LABELS[outfit]}
        onClick={() => setOpen((v) => !v)}
        className="fofo-hover block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--fofo-accent)]"
      >
        <CurrentFofo decorative sleepWhenResting={false} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Guarda-roupa do Fofo"
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
          className="fofolab-enter absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-800 bg-slate-900 p-3 shadow-xl shadow-black/40"
        >
          <p className="text-xs font-semibold text-white">Guarda-roupa do Fofo</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Automática: troca com a hora do dia, as festas e os marcos.</p>
          <div className="mt-2.5 grid grid-cols-6 gap-1">
            <button
              type="button"
              autoFocus
              aria-pressed={fixedOutfit === null}
              aria-label={`Automática (agora: ${OUTFIT_LABELS[automatic]})`}
              title="Automática"
              onClick={() => onChooseOutfit(null)}
              className={`${cell} ${fixedOutfit === null ? cellOn : cellOff}`}
            >
              <FofoSprite outfit={automatic} motion="still" decorative />
            </button>
            {OUTFITS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={fixedOutfit === id}
                aria-label={OUTFIT_LABELS[id]}
                title={OUTFIT_LABELS[id]}
                onClick={() => onChooseOutfit(id)}
                className={`${cell} ${fixedOutfit === id ? cellOn : cellOff}`}
              >
                <FofoSprite outfit={id} motion="still" decorative />
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-1 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => onAppointedChange(!appointed)}
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors duration-150 hover:border-orange-500/50 hover:text-white"
            >
              {appointed ? 'Desfazer "Fui nomeado"' : 'Fui nomeado!'}
            </button>
            <p className="text-[11px] text-slate-500">O Fofo veste o terno até você cadastrar uma prova nova.</p>
          </div>
        </div>
      )}
    </div>
  );
}
