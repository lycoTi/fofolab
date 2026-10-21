import { useSyncExternalStore } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { getSaveStatus, subscribeSaveStatus } from '../lib/saveStatus';

interface SaveStatusIndicatorProps {
  /** Abre a área de backup (usado quando há aviso ou erro de gravação). */
  onOpenBackup: () => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Mostra se os estudos estão salvos. Falha de gravação aparece aqui — nunca fica só no console. */
export function SaveStatusIndicator({ onOpenBackup }: SaveStatusIndicatorProps) {
  const status = useSyncExternalStore(subscribeSaveStatus, getSaveStatus);

  if (status.warning || status.state === 'error') {
    const message = status.warning ?? status.errorMessage ?? 'Seus estudos não estão sendo salvos.';
    return (
      <button
        type="button"
        onClick={onOpenBackup}
        title={message}
        className="px-2.5 py-1.5 rounded-xl border border-red-500/50 bg-red-500/15 text-red-200 text-xs font-semibold flex items-center gap-1.5 max-w-xs"
      >
        <AlertTriangle size={13} className="shrink-0" />
        <span className="truncate">{status.warning ? 'Estudos não estão sendo gravados' : 'Não foi possível salvar'}</span>
      </button>
    );
  }

  if (status.state === 'pending' || status.state === 'saving') {
    return (
      <span className="px-2 py-1 text-[11px] text-slate-400 flex items-center gap-1" aria-live="polite">
        <Loader2 size={12} className="animate-spin" />
        Salvando…
      </span>
    );
  }

  if (status.state === 'saved') {
    return (
      <span
        className="px-2 py-1 text-[11px] text-emerald-300/80 flex items-center gap-1"
        title={`Tudo salvo às ${formatTime(status.lastSavedAt)}`}
        aria-live="polite"
      >
        <CheckCircle2 size={12} />
        Salvo
      </span>
    );
  }

  return null;
}
