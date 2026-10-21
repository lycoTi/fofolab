/**
 * Onde os estudos ficam gravados (o banco sql.js vive em memória e é serializado aqui).
 *
 * - Tauri (.exe): arquivo real `fofolab.db` na pasta de dados do app, com escrita atômica
 *   (grava `.tmp` e renomeia), cópias de segurança em `backups/` e quarentena em `quarantine/`.
 * - Navegador (`npm run dev`): IndexedDB (sem o limite de ~5 MB do localStorage, sem base64).
 * - Testes / fallback: memória.
 *
 * Substitui o antigo base64 no localStorage (`fofolab_sqlite_db_v1`), migrado no 1º carregamento.
 */
export type StorageKind = 'tauri-file' | 'indexeddb' | 'memory';

export interface BackupEntry {
  id: string;
  /** Rótulo técnico em slug (ex: `diaria`, `antes-de-excluir-plano`); a UI traduz. */
  label: string;
  createdAt: string;
  sizeBytes: number;
}

export interface DatabaseStorage {
  readonly kind: StorageKind;
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
  createBackup(bytes: Uint8Array, label: string): Promise<BackupEntry>;
  /** Cópias da mais recente para a mais antiga. */
  listBackups(): Promise<BackupEntry[]>;
  readBackup(id: string): Promise<Uint8Array | null>;
  /** Guarda um banco que não abriu, em vez de sobrescrevê-lo. */
  quarantine(bytes: Uint8Array, reason: string): Promise<void>;
}

export const MAX_BACKUPS = 12;
export const LEGACY_LOCALSTORAGE_KEY = 'fofolab_sqlite_db_v1';

// ============================================================================
// IDs de cópia de segurança: `<timestamp ordenável>-<aleatório>--<rótulo>`
// ============================================================================

export function slugifyLabel(label: string): string {
  const slug = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'copia';
}

export function makeBackupId(date: Date, label: string): string {
  // replaceAll em vez de uma classe de caracteres na regex: o Tailwind a lia como classe CSS
  const stamp = date.toISOString().replaceAll('-', '').replaceAll(':', '').replaceAll('.', '');
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `${stamp}-${random}--${slugifyLabel(label)}`;
}

export function parseBackupId(id: string): { createdAt: string; label: string } | null {
  const match = /^(\d{8})T(\d{6})(\d{3})Z-[a-z0-9]{4}--([a-z0-9-]+)$/.exec(id);
  if (!match) return null;
  const [, ymd, hms, ms, label] = match;
  const createdAt = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T${hms.slice(0, 2)}:${hms.slice(2, 4)}:${hms.slice(4, 6)}.${ms}Z`;
  return { createdAt, label };
}

function sortBackupsNewestFirst(entries: BackupEntry[]): BackupEntry[] {
  // IDs começam pelo timestamp e são únicos: ordem decrescente de texto = mais recente primeiro
  return [...entries].sort((a, b) => (b.id > a.id ? 1 : -1));
}

// ============================================================================
// Memória (testes e fallback quando não há armazenamento persistente)
// ============================================================================

export interface MemoryStorage extends DatabaseStorage {
  current: Uint8Array | null;
  saveCount: number;
  failSaves: boolean;
  quarantined: { reason: string; bytes: Uint8Array }[];
}

export function createMemoryStorage(initial: Uint8Array | null = null): MemoryStorage {
  const backups = new Map<string, { entry: BackupEntry; bytes: Uint8Array }>();

  const storage: MemoryStorage = {
    kind: 'memory',
    current: initial ? initial.slice() : null,
    saveCount: 0,
    failSaves: false,
    quarantined: [],
    async load() {
      return storage.current ? storage.current.slice() : null;
    },
    async save(bytes) {
      if (storage.failSaves) throw new Error('Falha simulada de gravação');
      storage.current = bytes.slice();
      storage.saveCount += 1;
    },
    async createBackup(bytes, label) {
      const id = makeBackupId(new Date(), label);
      const entry: BackupEntry = {
        id,
        label: slugifyLabel(label),
        createdAt: new Date().toISOString(),
        sizeBytes: bytes.byteLength,
      };
      backups.set(id, { entry, bytes: bytes.slice() });
      for (const old of sortBackupsNewestFirst([...backups.values()].map((b) => b.entry)).slice(
        MAX_BACKUPS
      )) {
        backups.delete(old.id);
      }
      return entry;
    },
    async listBackups() {
      return sortBackupsNewestFirst([...backups.values()].map((b) => b.entry));
    },
    async readBackup(id) {
      const found = backups.get(id);
      return found ? found.bytes.slice() : null;
    },
    async quarantine(bytes, reason) {
      storage.quarantined.push({ reason, bytes: bytes.slice() });
    },
  };

  return storage;
}

// ============================================================================
// IndexedDB (navegador / dev)
// ============================================================================

const IDB_VERSION = 1;
const STORE_DATABASE = 'database';
const STORE_BACKUP_META = 'backup_meta';
const STORE_BACKUP_DATA = 'backup_data';
const STORE_QUARANTINE = 'quarantine';
const CURRENT_KEY = 'current';

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha no armazenamento interno'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao gravar no armazenamento interno'));
    tx.onabort = () => reject(tx.error ?? new Error('Gravação no armazenamento interno cancelada'));
  });
}

function toUint8Array(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

export async function createIndexedDbStorage(
  options: { dbName?: string; factory?: IDBFactory } = {}
): Promise<DatabaseStorage> {
  const factory = options.factory ?? globalThis.indexedDB;
  if (!factory) throw new Error('Armazenamento interno do navegador indisponível');

  const idb = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(options.dbName ?? 'fofolab', IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DATABASE)) db.createObjectStore(STORE_DATABASE);
      if (!db.objectStoreNames.contains(STORE_BACKUP_META)) {
        db.createObjectStore(STORE_BACKUP_META, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BACKUP_DATA)) db.createObjectStore(STORE_BACKUP_DATA);
      if (!db.objectStoreNames.contains(STORE_QUARANTINE)) db.createObjectStore(STORE_QUARANTINE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento interno'));
    request.onblocked = () =>
      reject(new Error('O armazenamento está bloqueado por outra janela do FofoLab aberta'));
  });

  const listBackups = async (): Promise<BackupEntry[]> => {
    const tx = idb.transaction(STORE_BACKUP_META, 'readonly');
    const entries = await promisifyRequest(tx.objectStore(STORE_BACKUP_META).getAll());
    return sortBackupsNewestFirst(entries as BackupEntry[]);
  };

  return {
    kind: 'indexeddb',
    async load() {
      const tx = idb.transaction(STORE_DATABASE, 'readonly');
      const record = (await promisifyRequest(tx.objectStore(STORE_DATABASE).get(CURRENT_KEY))) as
        | { bytes: unknown }
        | undefined;
      return record ? toUint8Array(record.bytes) : null;
    },
    async save(bytes) {
      const tx = idb.transaction(STORE_DATABASE, 'readwrite');
      tx.objectStore(STORE_DATABASE).put({ bytes, savedAt: new Date().toISOString() }, CURRENT_KEY);
      await transactionDone(tx);
    },
    async createBackup(bytes, label) {
      const entry: BackupEntry = {
        id: makeBackupId(new Date(), label),
        label: slugifyLabel(label),
        createdAt: new Date().toISOString(),
        sizeBytes: bytes.byteLength,
      };
      const tx = idb.transaction([STORE_BACKUP_META, STORE_BACKUP_DATA], 'readwrite');
      tx.objectStore(STORE_BACKUP_META).put(entry);
      tx.objectStore(STORE_BACKUP_DATA).put(bytes, entry.id);
      await transactionDone(tx);

      const excess = (await listBackups()).slice(MAX_BACKUPS);
      if (excess.length > 0) {
        const pruneTx = idb.transaction([STORE_BACKUP_META, STORE_BACKUP_DATA], 'readwrite');
        for (const old of excess) {
          pruneTx.objectStore(STORE_BACKUP_META).delete(old.id);
          pruneTx.objectStore(STORE_BACKUP_DATA).delete(old.id);
        }
        await transactionDone(pruneTx);
      }
      return entry;
    },
    listBackups,
    async readBackup(id) {
      const tx = idb.transaction(STORE_BACKUP_DATA, 'readonly');
      return toUint8Array(await promisifyRequest(tx.objectStore(STORE_BACKUP_DATA).get(id)));
    },
    async quarantine(bytes, reason) {
      const tx = idb.transaction(STORE_QUARANTINE, 'readwrite');
      tx.objectStore(STORE_QUARANTINE).put(
        { reason, bytes, createdAt: new Date().toISOString() },
        makeBackupId(new Date(), reason)
      );
      await transactionDone(tx);
    },
  };
}

// ============================================================================
// Arquivo real via Tauri (plugin-fs) — pasta de dados do app (BaseDirectory.AppData)
// ============================================================================

const DB_FILE = 'fofolab.db';
const DB_TEMP_FILE = 'fofolab.db.tmp';
const BACKUP_DIR = 'backups';
const QUARANTINE_DIR = 'quarantine';

export async function createTauriFileStorage(): Promise<DatabaseStorage> {
  const fs = await import('@tauri-apps/plugin-fs');
  const base = { baseDir: fs.BaseDirectory.AppData };
  const renameBase = {
    oldPathBaseDir: fs.BaseDirectory.AppData,
    newPathBaseDir: fs.BaseDirectory.AppData,
  };

  // `recursive` cria também a própria pasta de dados do app no 1º uso
  await fs.mkdir(BACKUP_DIR, { ...base, recursive: true });
  await fs.mkdir(QUARANTINE_DIR, { ...base, recursive: true });

  const listBackups = async (): Promise<BackupEntry[]> => {
    const entries = await fs.readDir(BACKUP_DIR, base);
    const backups: BackupEntry[] = [];
    for (const entry of entries) {
      if (!entry.isFile || !entry.name.endsWith('.db')) continue;
      const id = entry.name.slice(0, -'.db'.length);
      const parsed = parseBackupId(id);
      if (!parsed) continue;
      backups.push({ id, label: parsed.label, createdAt: parsed.createdAt, sizeBytes: 0 });
    }
    return sortBackupsNewestFirst(backups);
  };

  return {
    kind: 'tauri-file',
    async load() {
      if (!(await fs.exists(DB_FILE, base))) return null;
      return fs.readFile(DB_FILE, base);
    },
    async save(bytes) {
      // Escrita atômica: um fechamento no meio da gravação nunca deixa o arquivo principal pela metade
      await fs.writeFile(DB_TEMP_FILE, bytes, base);
      await fs.rename(DB_TEMP_FILE, DB_FILE, renameBase);
    },
    async createBackup(bytes, label) {
      const id = makeBackupId(new Date(), label);
      await fs.writeFile(`${BACKUP_DIR}/${id}.db`, bytes, base);
      for (const old of (await listBackups()).slice(MAX_BACKUPS)) {
        await fs.remove(`${BACKUP_DIR}/${old.id}.db`, base);
      }
      return {
        id,
        label: slugifyLabel(label),
        createdAt: parseBackupId(id)?.createdAt ?? new Date().toISOString(),
        sizeBytes: bytes.byteLength,
      };
    },
    listBackups,
    async readBackup(id) {
      if (!parseBackupId(id)) return null;
      const path = `${BACKUP_DIR}/${id}.db`;
      if (!(await fs.exists(path, base))) return null;
      return fs.readFile(path, base);
    },
    async quarantine(bytes, reason) {
      await fs.writeFile(`${QUARANTINE_DIR}/${makeBackupId(new Date(), reason)}.db`, bytes, base);
    },
  };
}

// ============================================================================
// Seleção do armazenamento + migração do formato antigo (base64 no localStorage)
// ============================================================================

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function createDefaultStorage(): Promise<DatabaseStorage> {
  if (isTauriRuntime()) return createTauriFileStorage();
  return createIndexedDbStorage();
}

function getLocalStorageSafe(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readLegacyLocalStorageDatabase(): Uint8Array | null {
  const ls = getLocalStorageSafe();
  const base64 = ls?.getItem(LEGACY_LOCALSTORAGE_KEY);
  if (!base64) return null;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function clearLegacyLocalStorageDatabase(): void {
  try {
    getLocalStorageSafe()?.removeItem(LEGACY_LOCALSTORAGE_KEY);
  } catch {
    // Sem acesso ao localStorage: nada a limpar
  }
}
