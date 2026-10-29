import { getLawCatalogEntry } from './catalog';
import { parseLawMarkdown } from './parser';
import type { ParsedLaw } from './types';

const STORE_NAME = 'laws';
const DB_NAME = 'fofolab-laws';

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha no armazenamento de legislação'));
  });
}

export interface LawStoreOptions {
  dbName?: string;
  factory?: IDBFactory;
  fetcher?: (url: string) => Promise<string>;
}

export interface StoredLawSummary {
  id: string;
  shortName: string;
  title: string;
  articleCount: number;
}

export interface LawsStore {
  getLaw(id: string): Promise<ParsedLaw | null>;
  saveLaw(law: ParsedLaw): Promise<void>;
  hasLaw(id: string): Promise<boolean>;
  fetchAndStoreLaw(id: string): Promise<ParsedLaw>;
  listStoredLaws(): Promise<StoredLawSummary[]>;
  clearStoredLaws(): Promise<void>;
}

const memoryCache = new Map<string, ParsedLaw>();

export function defaultRawFetcher(url: string): Promise<string> {
  return fetch(url).then(async (res) => {
    if (!res.ok) {
      throw new Error(`Erro ao baixar legislação (${res.status} ${res.statusText})`);
    }
    return res.text();
  });
}

/**
 * Cria ou recupera a instância do repositório local de legislação (IndexedDB + Cache em memória).
 */
export async function createLawsStore(options: LawStoreOptions = {}): Promise<LawsStore> {
  const factory = options.factory ?? globalThis.indexedDB;
  const fetcher = options.fetcher ?? defaultRawFetcher;

  let idb: IDBDatabase | null = null;
  if (factory) {
    try {
      const request = factory.open(options.dbName ?? DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      idb = await promisify(request);
    } catch (err) {
      console.warn('[FofoLab] IndexedDB indisponível para leis; usando memória:', err);
    }
  }

  const store: LawsStore = {
    async getLaw(id: string): Promise<ParsedLaw | null> {
      if (memoryCache.has(id)) {
        return memoryCache.get(id)!;
      }
      if (!idb) return null;
      try {
        const tx = idb.transaction(STORE_NAME, 'readonly');
        const law = (await promisify(tx.objectStore(STORE_NAME).get(id))) as ParsedLaw | undefined;
        if (law) memoryCache.set(id, law);
        return law ?? null;
      } catch {
        return null;
      }
    },

    async saveLaw(law: ParsedLaw): Promise<void> {
      memoryCache.set(law.id, law);
      if (!idb) return;
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(law);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Falha ao gravar lei'));
        tx.onabort = () => reject(tx.error ?? new Error('Gravação cancelada'));
      });
    },

    async hasLaw(id: string): Promise<boolean> {
      const existing = await store.getLaw(id);
      return existing !== null;
    },

    async fetchAndStoreLaw(id: string): Promise<ParsedLaw> {
      const cached = await store.getLaw(id);
      if (cached) return cached;

      const entry = getLawCatalogEntry(id);
      if (!entry) {
        throw new Error(`Norma "${id}" não encontrada no catálogo de legislação.`);
      }

      const rawUrl = `https://raw.githubusercontent.com/ctresb/leis/main/${entry.githubPath}`;
      const rawText = await fetcher(rawUrl);
      const parsed = parseLawMarkdown(rawText, entry);
      await store.saveLaw(parsed);
      return parsed;
    },

    async listStoredLaws(): Promise<StoredLawSummary[]> {
      if (!idb) {
        return Array.from(memoryCache.values()).map((l) => ({
          id: l.id,
          shortName: l.shortName,
          title: l.title,
          articleCount: l.articleCount,
        }));
      }
      try {
        const tx = idb.transaction(STORE_NAME, 'readonly');
        const all = (await promisify(tx.objectStore(STORE_NAME).getAll())) as ParsedLaw[];
        return all.map((l) => ({
          id: l.id,
          shortName: l.shortName,
          title: l.title,
          articleCount: l.articleCount,
        }));
      } catch {
        return [];
      }
    },

    async clearStoredLaws(): Promise<void> {
      memoryCache.clear();
      if (!idb) return;
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Falha ao limpar leis'));
      });
    },
  };

  return store;
}

let activeLawsStore: LawsStore | null = null;

/** Retorna a instância padrão do LawsStore na sessão. */
export async function getActiveLawsStore(): Promise<LawsStore> {
  if (!activeLawsStore) {
    activeLawsStore = await createLawsStore();
  }
  return activeLawsStore;
}
