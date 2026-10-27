import { useState } from 'react';
import { AlertTriangle, Layers, RotateCcw, Unlink2 } from 'lucide-react';
import type { QuestionsView } from '../../lib/acervo/topicQuestions';

/**
 * De onde vêm as questões do acervo neste tópico (spec 12c §5.3) e o que foi tirado dele (§5.7).
 * Exibido como uma trilha contextual limpa com ícones e divisão visual.
 */
export function AcervoLinkBar(props: {
  view: Pick<QuestionsView, 'links' | 'excluded' | 'acervoMissing'>;
  onDisableLink: (assuntoId: string) => void;
  onRestoreItem: (itemId: string) => void;
}) {
  const { links, excluded, acervoMissing } = props.view;
  const [showExcluded, setShowExcluded] = useState(false);
  if (links.length === 0 && excluded.length === 0 && !acervoMissing) return null;

  return (
    <div className="space-y-1.5 rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-[11px]">
      {acervoMissing && (
        <p className="flex items-center gap-1.5 text-amber-200">
          <AlertTriangle size={12} className="shrink-0 text-amber-400" />
          <span>O acervo da Cebraspe não está neste computador. Importe o pacote de novo em "Importar Questões".</span>
        </p>
      )}
      {links.map((link) => (
        <div key={link.assuntoId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 min-w-0">
            <Layers size={13} className="shrink-0 text-orange-400/90" />
            <span className="truncate text-slate-300">
              Do acervo: {link.caminho.slice(1).join(' › ')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => props.onDisableLink(link.assuntoId)}
            className="inline-flex items-center gap-1 text-slate-400 transition-colors hover:text-orange-300"
          >
            <Unlink2 size={12} />
            <span>Desligar este assunto</span>
          </button>
        </div>
      ))}
      {excluded.length > 0 && (
        <div className="border-t border-slate-800/60 pt-1.5">
          <button
            type="button"
            aria-expanded={showExcluded}
            onClick={() => setShowExcluded((v) => !v)}
            className="inline-flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-200"
          >
            <RotateCcw size={11} className="text-slate-500" />
            <span>Tirados deste tópico ({excluded.length})</span>
          </button>
          {showExcluded && (
            <ul className="mt-1.5 space-y-1 pl-4 text-slate-400">
              {excluded.map((item) => (
                <li key={item.itemId} className="flex flex-wrap items-center gap-x-3">
                  <span>{item.sourceLabel}</span>
                  <button type="button" onClick={() => props.onRestoreItem(item.itemId)} className="text-orange-300 hover:text-orange-200">
                    Devolver ao tópico
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
