import { CornerUpLeft, Eye } from 'lucide-react';
import type { PeekKind } from './usePeek';

export interface PeekInfo {
  kind: Exclude<PeekKind, 'none'>;
  topicLabel: string;
  showNudge: boolean;
  nudgeText: string;
}

/** Faixa discreta da olhada: informa, sem cobrar, e leva de volta ao bloco. */
export function PeekBanner({ peek, onReturnToBlock }: { peek: PeekInfo; onReturnToBlock: () => void }) {
  const text =
    peek.kind === 'sibling'
      ? `Olhar ${peek.topicLabel} não conta para o bloco de hoje`
      : `Dando uma olhada em ${peek.topicLabel} · fora do roteiro de hoje`;

  return (
    <div className="mx-3 mt-3 space-y-2 rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-300">
      <p className="flex items-start gap-2">
        <Eye size={14} className="mt-0.5 shrink-0 text-blue-300" />
        <span>{text}</span>
      </p>
      {peek.showNudge && <p className="text-slate-400">{peek.nudgeText}</p>}
      <button
        type="button"
        onClick={onReturnToBlock}
        className="flex items-center gap-1.5 rounded-lg border border-slate-600 px-2.5 py-1 font-semibold text-slate-100 hover:border-orange-500/60"
      >
        <CornerUpLeft size={13} />
        Voltar ao bloco
      </button>
    </div>
  );
}
