import { RotateCcw } from 'lucide-react';
import { CurrentFofo } from '../mascot/FofoOutfitContext';

export interface FofoPanelHeaderProps {
  topicLabel: string;
  aiConfigured: boolean;
  hasTurns: boolean;
  onClear: () => void;
}

export function FofoPanelHeader({ topicLabel, aiConfigured, hasTurns, onClear }: FofoPanelHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/30 p-3.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <CurrentFofo decorative />
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-white">FofoIA</h3>
          <p className="truncate text-[10px] text-slate-400">
            {aiConfigured
              ? `Conversando sobre ${topicLabel}`
              : 'Modo demonstração — respostas de exemplo até a IA ser configurada'}
          </p>
        </div>
      </div>
      {hasTurns && (
        <button
          type="button"
          onClick={onClear}
          title="Recomeçar conversa desta questão (limpar lousa)"
          aria-label="Limpar conversa"
          className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-800/60 hover:text-white active:scale-[0.97]"
        >
          <RotateCcw size={10} />
          <span>Limpar</span>
        </button>
      )}
    </div>
  );
}

