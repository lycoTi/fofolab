import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

/**
 * Confirmação antes de ações que apagam ou substituem estudos.
 * `confirm(...)` devolve uma Promise<boolean>; renderize `dialog` uma vez na árvore.
 */
export function useConfirmDialog(): { confirm: (options: ConfirmOptions) => Promise<boolean>; dialog: ReactNode } {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolverRef.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  };

  const dialog = options ? (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="fofolab-confirm-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm"
      onKeyDown={(e) => {
        if (e.key === 'Escape') close(false);
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-4 text-slate-100">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              options.tone === 'danger' ? 'bg-red-500/15 text-red-300' : 'bg-orange-500/15 text-orange-300'
            }`}
          >
            <AlertTriangle size={18} />
          </div>
          <div className="space-y-2">
            <h2 id="fofolab-confirm-title" className="text-sm font-bold text-white">
              {options.title}
            </h2>
            <div className="text-xs text-slate-300 leading-relaxed space-y-1.5">{options.message}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            autoFocus
            onClick={() => close(false)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
          >
            {options.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white ${
              options.tone === 'danger' ? 'bg-red-600 hover:bg-red-500' : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
