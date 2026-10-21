import type { StorageKind } from './storage';

/**
 * Estado observável do salvamento dos estudos (consumido pelo indicador do cabeçalho via
 * `useSyncExternalStore`). Falhas de gravação NUNCA ficam só no console: viram `state: 'error'`.
 */
export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface SaveStatus {
  state: SaveState;
  storageKind: StorageKind | null;
  lastSavedAt: string | null;
  errorMessage: string | null;
  /** Aviso persistente (ex: armazenamento temporário sem gravação real). */
  warning: string | null;
}

const INITIAL_STATUS: SaveStatus = {
  state: 'idle',
  storageKind: null,
  lastSavedAt: null,
  errorMessage: null,
  warning: null,
};

let currentStatus: SaveStatus = INITIAL_STATUS;
const listeners = new Set<() => void>();

export function getSaveStatus(): SaveStatus {
  return currentStatus;
}

export function subscribeSaveStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateSaveStatus(patch: Partial<SaveStatus>): void {
  currentStatus = { ...currentStatus, ...patch };
  for (const listener of listeners) listener();
}

export function resetSaveStatus(): void {
  currentStatus = INITIAL_STATUS;
  for (const listener of listeners) listener();
}
