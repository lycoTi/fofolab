import { X } from 'lucide-react';

/**
 * Aviso do FofoDoro nas transições (fim do foco, fim da pausa, bloco concluído). Discreto, no canto inferior
 * esquerdo, lido por leitor de tela sem interromper; some sozinho (o tempo fica no hook do bloco).
 */
export function Toast({ message, messageId, onClose }: { message: string | null; messageId: number; onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 max-w-sm">
      <div
        key={messageId}
        role="status"
        aria-live="polite"
        className="fofolab-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-slate-900/95 px-3.5 py-3 text-sm text-emerald-100 shadow-lg shadow-black/40"
      >
        <span aria-hidden="true">🐹</span>
        <p className="leading-snug">{message}</p>
        <button type="button" onClick={onClose} aria-label="Fechar aviso" className="ml-1 rounded p-0.5 text-slate-400 hover:text-slate-100">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
