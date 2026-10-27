import type { Topic } from '../../types/database';
import type { PacoteAssunto } from './pacote';

/**
 * Ligação de um tópico do plano a assuntos do vocabulário do acervo (spec 12c §5.3). O vocabulário nasceu do edital
 * da CGU com o mesmo leitor de edital do app, então a maioria dos tópicos casa pelo nome. As regras de nome abaixo
 * repetem as do minerador (`tools/minerador/vocab.ts`: `slug`, `assuntoId`, `cleanSubjectName`) — o app não importa
 * `tools/`; o teste com o edital e o vocabulário reais confere que continuam iguais.
 */

/** Igual ao `slug` do minerador: sem acento, minúsculas, o resto vira hífen. */
export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const assuntoIdFromCaminho = (caminho: string[]): string => caminho.map(normalizeName).join('>');

/** Nome da matéria como o minerador grava no vocabulário (sem a ressalva de cargo nem o resto de numeração romana). */
export function cleanSubjectName(name: string): string {
  return name
    .replace(/^[^.]{1,16}\.\s+(?=[A-ZÀ-Ý])/, '')
    .replace(/\s*\((exceto|para|somente|apenas|exclusivo)\b.*$/i, '')
    .replace(/:\s*[IVX]+\s.*$/, '')
    .trim();
}

/** Caminho do tópico como o vocabulário foi semeado: matéria › pais › título. */
export function topicCaminho(subjectName: string, topic: Topic, topicsById: ReadonlyMap<string, Topic>): string[] {
  const parents: string[] = [];
  const seen = new Set<string>([topic.id]);
  let parentId = topic.parent_id;
  while (parentId && !seen.has(parentId)) {
    const parent = topicsById.get(parentId);
    if (!parent) break;
    parents.unshift(parent.title);
    seen.add(parentId);
    parentId = parent.parent_id;
  }
  return [cleanSubjectName(subjectName), ...parents, topic.title];
}

export type LinkByNameResult = { kind: 'linked'; assuntoId: string } | { kind: 'ambiguous'; candidates: string[] } | { kind: 'none' };

interface NameIndex {
  ids: Set<string>;
  /** Raiz (matéria) → assuntos de 2+ níveis com as chaves da folha e dos sinônimos. */
  byRoot: Map<string, { id: string; keys: Set<string> }[]>;
}

const indexCache = new WeakMap<PacoteAssunto[], NameIndex>();

function nameIndex(vocab: PacoteAssunto[]): NameIndex {
  const cached = indexCache.get(vocab);
  if (cached) return cached;
  const index: NameIndex = { ids: new Set(vocab.map((a) => a.id)), byRoot: new Map() };
  for (const a of vocab) {
    if (a.caminho.length < 2) continue;
    const root = a.id.split('>')[0];
    const keys = new Set([a.caminho.at(-1) ?? '', ...a.sinonimos].map(normalizeName));
    const list = index.byRoot.get(root) ?? [];
    list.push({ id: a.id, keys });
    index.byRoot.set(root, list);
  }
  indexCache.set(vocab, index);
  return index;
}

/**
 * 1º passo, sem IA: (1) caminho inteiro igual; (2) senão, folha ou sinônimo igual ao título dentro da MESMA matéria;
 * mais de um candidato vai para a IA. Nunca liga à matéria inteira nem a assunto de outra matéria (anti-objetivo: questão
 * fora do tópico) — perder um item classificado no "gêmeo" de outra matéria é o preço aceito.
 */
export function linkByName(caminho: string[], vocab: PacoteAssunto[]): LinkByNameResult {
  if (caminho.length < 2) return { kind: 'none' };
  const index = nameIndex(vocab);
  const fullId = assuntoIdFromCaminho(caminho);
  if (index.ids.has(fullId)) return { kind: 'linked', assuntoId: fullId };

  const title = normalizeName(caminho.at(-1) ?? '');
  const matches = (index.byRoot.get(normalizeName(caminho[0])) ?? []).filter((a) => a.keys.has(title)).map((a) => a.id);
  if (matches.length === 1) return { kind: 'linked', assuntoId: matches[0] };
  if (matches.length > 1) return { kind: 'ambiguous', candidates: matches.sort() };
  return { kind: 'none' };
}
