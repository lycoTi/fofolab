import { getSubjectsByPlan, getTopicsBySubject } from '../database';
import { acervoVocabVersion, acervoWithSubjectCount } from './acervoDb';
import { openAcervo } from './acervoStore';
import { importAcervoPacote, type AcervoImportSummary, type LinkAi } from './importAcervo';
import { parsePacote, type PacoteAssunto, type PacoteItem } from './pacote';

/**
 * Sincronização automática do acervo em segundo plano (spec 12d §3.1): ao abrir o app ou trocar de plano, lê
 * `/__acervo/index.json` (servido localmente a partir de `acervo/pacote/`). Se a versão ou o total de itens com
 * assunto subiu — ou se o plano ganhou tópicos novos — baixa os pacotes e roda `importAcervoPacote` sem clique manual.
 */

export interface AcervoIndexEntry {
  id: string;
  banca: string;
  arquivo: string;
  vocabVersion: number;
  itensComAssunto: number;
  atualizadoEm: string;
}

export interface AcervoIndex {
  formato: 'fofolab-acervo-index';
  versao: 1;
  pacotes: AcervoIndexEntry[];
}

const SAFE_FILE = /^[a-z0-9._-]+\.json$/i;
const SYNC_STORAGE_KEY = 'fofolab_acervo_sync_v1';
const memorySyncState = new Map<string, string>();

function readSyncStamp(planId: string): string | null {
  try {
    const raw = globalThis.localStorage?.getItem(SYNC_STORAGE_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, string>;
      if (map[planId]) return map[planId];
    }
  } catch {
    // Em ambiente sem localStorage usa a memória da sessão
  }
  return memorySyncState.get(planId) ?? null;
}

function writeSyncStamp(planId: string, stamp: string): void {
  memorySyncState.set(planId, stamp);
  try {
    const raw = globalThis.localStorage?.getItem(SYNC_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[planId] = stamp;
    globalThis.localStorage?.setItem(SYNC_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignora restrição de storage
  }
}

export function parseAcervoIndex(text: string): AcervoIndex | null {
  try {
    const raw = JSON.parse(text) as Partial<AcervoIndex>;
    if (raw.formato !== 'fofolab-acervo-index' || raw.versao !== 1 || !Array.isArray(raw.pacotes)) return null;
    const pacotes = raw.pacotes.filter(
      (p): p is AcervoIndexEntry =>
        typeof p === 'object' &&
        p !== null &&
        typeof p.id === 'string' &&
        typeof p.banca === 'string' &&
        typeof p.arquivo === 'string' &&
        SAFE_FILE.test(p.arquivo) &&
        typeof p.vocabVersion === 'number' &&
        typeof p.itensComAssunto === 'number'
    );
    return { formato: 'fofolab-acervo-index', versao: 1, pacotes };
  } catch {
    return null;
  }
}

/** Junta um ou mais pacotes válidos num único texto JSON de pacote (para quando houver Cebraspe + FGV, etc.). */
export function mergePacotesTexts(texts: string[]): string | null {
  if (texts.length === 0) return null;
  if (texts.length === 1) return texts[0];
  let vocabVersion = 0;
  const assuntosById = new Map<string, PacoteAssunto>();
  const itensById = new Map<string, PacoteItem>();
  for (const text of texts) {
    const parsed = parsePacote(text);
    if (!parsed.ok) continue;
    if (parsed.pacote.vocabVersion > vocabVersion) vocabVersion = parsed.pacote.vocabVersion;
    for (const a of parsed.pacote.assuntos) assuntosById.set(a.id, a);
    for (const item of parsed.pacote.itens) itensById.set(item.id, item);
  }
  if (vocabVersion === 0) return null;
  return JSON.stringify({
    formato: 'fofolab-acervo',
    versao: 1,
    vocabulario: { versao: vocabVersion, assuntos: [...assuntosById.values()] },
    concursos: [],
    itens: [...itensById.values()],
  });
}

async function defaultFetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function planTopicsSignature(planId: string): string {
  const ids = getSubjectsByPlan(planId)
    .flatMap((s) => getTopicsBySubject(s.id).map((t) => t.id))
    .sort();
  return `${ids.length}:${ids.join(',')}`;
}

export async function syncLocalAcervoIfNeeded(input: {
  planId: string;
  ai: LinkAi | null;
  fetchText?: (url: string) => Promise<string | null>;
}): Promise<{ synced: boolean; summary?: AcervoImportSummary }> {
  if (!input.planId) return { synced: false };
  const get = input.fetchText ?? defaultFetchText;
  const indexRaw = await get('/__acervo/index.json');
  if (!indexRaw) return { synced: false };
  const index = parseAcervoIndex(indexRaw);
  if (!index || index.pacotes.length === 0) return { synced: false };

  const maxVocab = Math.max(...index.pacotes.map((p) => p.vocabVersion));
  const totalWithSubject = index.pacotes.reduce((acc, p) => acc + p.itensComAssunto, 0);
  const stamp = `v${maxVocab}:n${totalWithSubject}:ai${input.ai ? 1 : 0}:${planTopicsSignature(input.planId)}`;

  const existingDb = await openAcervo();
  if (
    existingDb &&
    acervoVocabVersion(existingDb) === maxVocab &&
    acervoWithSubjectCount(existingDb) === totalWithSubject &&
    readSyncStamp(input.planId) === stamp
  ) {
    return { synced: false };
  }

  const texts: string[] = [];
  for (const entry of index.pacotes) {
    const content = await get(`/__acervo/${entry.arquivo}`);
    if (content) texts.push(content);
  }
  const merged = mergePacotesTexts(texts);
  if (!merged) return { synced: false };

  const result = await importAcervoPacote(merged, { planId: input.planId, ai: input.ai });
  if (!result.ok) return { synced: false };

  writeSyncStamp(input.planId, stamp);
  return { synced: true, summary: result.summary };
}
