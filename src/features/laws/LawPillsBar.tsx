import { useState } from 'react';
import { Scale } from 'lucide-react';
import type { LawExcerpt } from '../../lib/fofoia/context';
import { LawReaderModal } from './LawReaderModal';

export interface LawPillsBarProps {
  excerpts: LawExcerpt[];
  onSaveToNotebook?: (markdown: string) => void;
}

/**
 * Barra tátil de pílulas da Letra da Lei (spec 11 §8 - Fatia 11.2.4).
 * Exibe os dispositivos jurídicos que fundamentam a questão ou a FofoIA, abrindo a leitura rápida ao toque.
 */
export function LawPillsBar({ excerpts, onSaveToNotebook }: LawPillsBarProps) {
  const [selected, setSelected] = useState<LawExcerpt | null>(null);

  if (!excerpts || excerpts.length === 0) return null;

  return (
    <>
      <div
        role="region"
        aria-label="Legislação citada"
        className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 bg-slate-950/40 px-3.5 py-1.5 text-xs"
      >
        <span className="text-[11px] font-medium text-slate-400 select-none">
          Letra da lei:
        </span>
        {excerpts.map((excerpt) => (
          <button
            key={`${excerpt.lawName}-${excerpt.article}`}
            type="button"
            onClick={() => setSelected(excerpt)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-800/40 px-2 py-0.5 text-[11px] text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-white active:scale-[0.97]"
            title={`Consultar ${excerpt.lawName} ${excerpt.article}`}
          >
            <Scale size={11} className="text-amber-400 shrink-0" />
            <span className="font-medium text-slate-200">{excerpt.lawName}</span>
            <span className="text-slate-400">{excerpt.article}</span>
          </button>
        ))}
      </div>

      {selected && (
        <LawReaderModal
          excerpt={selected}
          onClose={() => setSelected(null)}
          onSaveToNotebook={onSaveToNotebook}
        />
      )}
    </>
  );
}

