import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Info, X } from 'lucide-react';
import type { MetricExplanation } from '../lib/explainabilityEngine';

interface MetricExplainerProps {
  explanation: MetricExplanation;
  iconType?: 'info' | 'help';
  size?: 'sm' | 'md';
  buttonLabel?: string;
  className?: string;
}

export function MetricExplainer({
  explanation,
  iconType = 'info',
  size = 'sm',
  buttonLabel,
  className = '',
}: MetricExplainerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  const Icon = iconType === 'info' ? Info : HelpCircle;
  const iconSize = size === 'sm' ? 13 : 15;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={`inline-flex items-center gap-1 text-slate-400 hover:text-orange-300 transition rounded-md p-1 hover:bg-slate-800/80 ${className}`}
        title="Entenda como calculamos isso"
        aria-label="Entenda como calculamos isso"
      >
        <Icon size={iconSize} className="shrink-0 text-slate-400 hover:text-orange-400" />
        {buttonLabel && <span className="text-[11px] font-medium">{buttonLabel}</span>}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-4 text-slate-100 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400">
                  <Info size={16} />
                </div>
                <h3 className="text-sm font-bold text-white leading-snug">{explanation.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                aria-label="Fechar explicação"
              >
                <X size={16} />
              </button>
            </div>

            {/* Nível 1: Explicação Humana Direta */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-200 leading-relaxed space-y-2">
              <p className="font-medium text-orange-200/90">{explanation.humanSummary}</p>
              <ul className="space-y-1.5 pt-1 text-[11px] text-slate-300 list-disc list-inside">
                {explanation.bulletPoints.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </div>

            {/* Nível 2: Bastidores Matemáticos (Opcional para quem quiser ver a fundo) */}
            {explanation.formulaDetails && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowFormulaDetails((v) => !v)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-semibold flex items-center justify-between transition"
                >
                  <span className="flex items-center gap-1.5">
                    <span>🔬</span> Ver cálculo e bastidores matemáticos
                  </span>
                  {showFormulaDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showFormulaDetails && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2.5 animate-fade-in">
                    <div className="font-mono text-[11px] text-orange-300 bg-orange-500/10 p-2 rounded-lg border border-orange-500/20">
                      {explanation.formulaDetails.formulaLabel}
                    </div>

                    <div className="space-y-1.5">
                      {explanation.formulaDetails.variables.map((v, i) => (
                        <div key={i} className="flex items-start justify-between text-[11px] border-b border-slate-900 pb-1">
                          <span className="text-slate-400">{v.label}:</span>
                          <div className="text-right">
                            <span className="font-bold text-white font-mono">{v.value}</span>
                            <div className="text-[10px] text-slate-500">{v.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rodapé com botão de fechar */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition"
              >
                Entendi, voltar ao estudo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

