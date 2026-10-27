import type { Database } from 'sql.js';
import { getSqlJs } from '../database';
import { isTauriRuntime, type StorageKind } from '../storage';

/**
 * Onde o acervo da Cebraspe fica guardado (spec 12c §5.1): fora do banco do estudante e das cópias de segurança.
 * No navegador, um armazenamento IndexedDB próprio (não mexe na versão do principal); no app de desktop, o arquivo
 * `acervo.db` na pasta de dados. Só é regravado na importação e só é aberto quando um tópico com ligação aparece.
 */
export interface AcervoStorage {
  readonly kind: StorageKind;
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
}

export function createMemoryAcervoStorage(): AcervoStorage & { current: Uint8Array | null } {
  const storage = {
    kind: 'memory' as const,
    current: null as Uint8Array | null,
    async load() {
      return storage.current ? storage.current.slice() : null;
    },
    async save(bytes: Uint8Array) {
      storage.current = bytes.slice();
    },
  };
  return storage;
}

const IDB_STORE = 'acervo';
const IDB_KEY = 'current';

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha no armazenamento do acervo'));
  });
}

export async function createIndexedDbAcervoStorage(
  options: { dbName?: string; factory?: IDBFactory } = {}
): Promise<AcervoStorage> {
  const factory = options.factory ?? globalThis.indexedDB;
  if (!factory) throw new Error('Armazenamento interno do navegador indisponível');
  const request = factory.open(options.dbName ?? 'fofolab-acervo', 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(IDB_STORE)) request.result.createObjectStore(IDB_STORE);
  };
  const idb = await promisify(request);

  return {
    kind: 'indexeddb',
    async load() {
      const record = (await promisify(idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY))) as
        | { bytes: Uint8Array }
        | undefined;
      return record ? new Uint8Array(record.bytes) : null;
    },
    async save(bytes) {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put({ bytes, savedAt: new Date().toISOString() }, IDB_KEY);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Falha ao gravar o acervo'));
        tx.onabort = () => reject(tx.error ?? new Error('Gravação do acervo cancelada'));
      });
    },
  };
}

const ACERVO_FILE = 'acervo.db';
const ACERVO_TEMP_FILE = 'acervo.db.tmp';

export async function createTauriAcervoStorage(): Promise<AcervoStorage> {
  const fs = await import('@tauri-apps/plugin-fs');
  const base = { baseDir: fs.BaseDirectory.AppData };
  return {
    kind: 'tauri-file',
    async load() {
      if (!(await fs.exists(ACERVO_FILE, base))) return null;
      return fs.readFile(ACERVO_FILE, base);
    },
    async save(bytes) {
      // Escrita atômica, como o fofolab.db: fechar no meio nunca deixa o acervo pela metade
      await fs.writeFile(ACERVO_TEMP_FILE, bytes, base);
      await fs.rename(ACERVO_TEMP_FILE, ACERVO_FILE, {
        oldPathBaseDir: fs.BaseDirectory.AppData,
        newPathBaseDir: fs.BaseDirectory.AppData,
      });
    },
  };
}

export async function createDefaultAcervoStorage(): Promise<AcervoStorage> {
  if (isTauriRuntime()) return createTauriAcervoStorage();
  return createIndexedDbAcervoStorage();
}

// ============================================================================
// Sessão: o acervo é aberto uma vez, na primeira vez que alguém precisa dele
// ============================================================================

let storage: AcervoStorage | null = null;
let opened: Promise<Database | null> | null = null;

async function currentStorage(): Promise<AcervoStorage> {
  storage ??= await createDefaultAcervoStorage();
  return storage;
}

/** Troca onde o acervo é guardado e esquece o que estava aberto (testes; simula reabrir o app). */
export function setAcervoStorageForTests(next: AcervoStorage | null): void {
  storage = next;
  opened = null;
}

/** O acervo deste computador, ou `null` se ainda não foi importado aqui (ou não deu para ler). */
export function openAcervo(): Promise<Database | null> {
  opened ??= (async () => {
    try {
      const bytes = await (await currentStorage()).load();
      return bytes ? new (getSqlJs().Database)(bytes) : null;
    } catch (err) {
      // Sem acervo legível a tela mostra só as questões próprias e pede para importar de novo
      console.error('[FofoLab] Falha ao abrir o acervo da Cebraspe:', err);
      opened = null;
      return null;
    }
  })();
  return opened;
}

/** Grava o acervo novo (só na importação) e passa a usá-lo na sessão. */
export async function replaceAcervo(db: Database): Promise<void> {
  await (await currentStorage()).save(db.export());
  const previous = opened ? await opened : null;
  if (previous && previous !== db) previous.close();
  opened = Promise.resolve(db);
}
