import { useState } from 'react';
import type { QuestionsView } from '../../lib/acervo/topicQuestions';

/**
 * De onde vêm as questões do acervo neste tópico (spec 12c §5.3) e o que foi tirado dele (§5.7). Uma ligação errada
 * sai de uma vez ("Desligar este assunto"); um item tirado volta pela lista dos tirados.
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
    <div className="space-y-1.5 px-1 text-[11px] text-slate-400">
      {acervoMissing && (
        <p className="text-amber-200">O acervo da Cebraspe não está neste computador. Importe o pacote de novo em "Importar Questões".</p>
      )}
      {links.map((link) => (
        <div key={link.assuntoId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="truncate text-slate-400">Do acervo: {link.caminho.slice(1).join(' › ')}</span>
          <button
            type="button"
            onClick={() => props.onDisableLink(link.assuntoId)}
            className="text-slate-500 underline-offset-2 transition-colors hover:text-slate-200 hover:underline"
          >
            Desligar este assunto
          </button>
        </div>
      ))}
      {excluded.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={showExcluded}
            onClick={() => setShowExcluded((v) => !v)}
            className="text-slate-500 underline-offset-2 transition-colors hover:text-slate-200 hover:underline"
          >
            Tirados deste tópico ({excluded.length})
          </button>
          {showExcluded && (
            <ul className="mt-1.5 space-y-1 pl-2">
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
