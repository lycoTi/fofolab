import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { DatabaseBackup, Download, History, RotateCcw, Upload } from 'lucide-react';
import { getSaveStatus, subscribeSaveStatus } from '../lib/saveStatus';
import type { BackupEntry, StorageKind } from '../lib/storage';

interface BackupPanelProps {
  onExportDatabase: () => void;
  /** Ações confirmadas pelo App: devolvem `false` quando o estudante cancela. */
  onRestoreFromFile: (file: File) => Promise<boolean>;
  onLoadBackups: () => Promise<BackupEntry[]>;
  onRestoreBackup: (backup: BackupEntry) => Promise<boolean>;
  onResetSeed: () => Promise<boolean>;
}

const LABELS: Record<string, string> = {
  diaria: 'Cópia diária automática',
  'antes-de-excluir-plano': 'Antes de excluir um plano',
  'antes-de-excluir-disciplina': 'Antes de excluir uma disciplina',
  'antes-de-excluir-topico': 'Antes de excluir um tópico',
  'antes-de-restaurar-exemplo': 'Antes de restaurar o exemplo inicial',
  'antes-de-restaurar-arquivo': 'Antes de restaurar um backup',
  'antes-de-restaurar-copia-automatica': 'Antes de restaurar uma cópia automática',
  'antes-de-importar': 'Antes de uma importação',
};

export function describeBackupLabel(label: string): string {
  if (LABELS[label]) return LABELS[label];
  if (label.startsWith('antes-da-atualizacao')) return 'Antes da atualização do aplicativo';
  const text = label.replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function describeStorage(kind: StorageKind | null): string {
  if (kind === 'tauri-file') return 'Num arquivo na pasta de dados do FofoLab neste computador.';
  if (kind === 'indexeddb') return 'No armazenamento interno deste navegador (versão de desenvolvimento).';
  if (kind === 'memory') return 'Só nesta sessão — nada está sendo gravado. Faça um backup antes de fechar.';
  return 'Carregando…';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function BackupPanel({
  onExportDatabase,
  onRestoreFromFile,
  onLoadBackups,
  onRestoreBackup,
  onResetSeed,
}: BackupPanelProps) {
  const status = useSyncExternalStore(subscribeSaveStatus, getSaveStatus);
  const [backups, setBackups] = useState<BackupEntry[] | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reloadBackups = useCallback(() => {
    onLoadBackups()
      .then(setBackups)
      .catch(() => setBackups([]));
  }, [onLoadBackups]);

  useEffect(() => {
    reloadBackups();
  }, [reloadBackups]);

  const run = async (action: () => Promise<boolean>, successText: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const done = await action();
      if (done) setMessage({ tone: 'ok', text: successText });
      reloadBackups();
    } catch (err) {
      const text = err instanceof Error && err.message ? err.message : 'Não foi possível concluir a operação.';
      setMessage({ tone: 'error', text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
            <DatabaseBackup size={14} />
            Onde seus estudos ficam
          </h3>
          <p className="text-slate-300">{describeStorage(status.storageKind)}</p>
          {(status.warning || status.errorMessage) && (
            <p className="text-red-300">{status.warning ?? status.errorMessage}</p>
          )}
          <p className="text-slate-500">
            O FofoLab grava sozinho alguns instantes depois de cada alteração e guarda uma cópia automática por dia
            (as últimas 12).
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Levar para outro computador</h3>
          <button
            type="button"
            onClick={onExportDatabase}
            className="w-full py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold flex items-center justify-center gap-1.5"
          >
            <Download size={14} />
            Fazer Backup (baixar arquivo)
          </button>
          <label
            className={`w-full py-2 px-3 rounded-lg border border-dashed border-slate-700 hover:border-orange-500/50 text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer ${
              busy ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <Upload size={14} className="text-orange-400" />
            Restaurar de um arquivo de backup
            <input
              type="file"
              accept=".sqlite,.db,.fofopack,application/octet-stream"
              className="hidden"
              aria-label="Escolher arquivo de backup"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void run(() => onRestoreFromFile(file), 'Backup restaurado com sucesso.');
              }}
            />
          </label>
          <p className="text-slate-500">
            Ao restaurar, seus estudos atuais são guardados antes numa cópia automática — dá para voltar atrás.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/40 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-red-300">Zona de cuidado</h3>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(onResetSeed, 'Exemplo inicial restaurado. Seus dados anteriores estão nas cópias automáticas.')}
            className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-red-950/60 border border-red-900/50 text-red-200 font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RotateCcw size={14} />
            Restaurar Exemplo Inicial (CGU + BACEN)
          </button>
        </div>

        {message && (
          <div
            role="status"
            className={`p-3 rounded-xl border ${
              message.tone === 'ok'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-red-500/10 border-red-500/30 text-red-200'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <History size={14} />
          Cópias automáticas
        </h3>
        {backups === null && <p className="text-slate-500">Carregando…</p>}
        {backups !== null && backups.length === 0 && (
          <p className="text-slate-500">Nenhuma cópia ainda — a primeira é feita hoje no próximo salvamento.</p>
        )}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {backups?.map((backup) => (
            <div
              key={backup.id}
              className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
            >
              <div>
                <div className="font-semibold text-slate-200">{describeBackupLabel(backup.label)}</div>
                <div className="text-[11px] text-slate-500">{formatDate(backup.createdAt)}</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => onRestoreBackup(backup), 'Cópia restaurada com sucesso.')}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50"
              >
                Restaurar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
