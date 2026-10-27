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

// ============================================================================
// 2º passo: a IA escolhe entre candidatos locais (spec 12c §5.3)
// ============================================================================

/** Mesmas palavras vazias e o mesmo radical de `tools/minerador/candidates.ts`. */
const STOPWORDS = new Set([
  'julgue', 'item', 'itens', 'seguir', 'acerca', 'correto', 'correta', 'afirmar', 'considerando', 'considere', 'assinale',
  'opcao', 'situacao', 'hipotetica', 'subsequente', 'subsequentes', 'subsecutivo', 'subsecutivos', 'proximos', 'seguinte',
  'seguintes', 'texto', 'sobre', 'entre', 'para', 'como', 'quando', 'sendo', 'pois', 'essa', 'esse', 'este', 'esta', 'isso',
  'pelo', 'pela', 'pelos', 'pelas', 'seus', 'suas', 'deve', 'pode', 'podem', 'sera', 'estao', 'mais', 'menos', 'muito',
  'apenas', 'ainda', 'tambem', 'qual', 'quais', 'cujo', 'cuja', 'aspectos', 'conceitos', 'nocoes', 'fundamentos',
]);
const STEM = 6;
export const MAX_AI_CANDIDATES = 15;
export const MIN_AI_CONFIDENCE = 0.7;
export const MAX_LINKS_PER_TOPIC = 3;

function keywords(text: string): Set<string> {
  return new Set(
    normalizeName(text)
      .split('-')
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
      .map((w) => w.slice(0, STEM))
  );
}

interface KeywordIndex {
  entries: { assunto: PacoteAssunto; leaf: Set<string>; parents: Set<string> }[];
  idf: Map<string, number>;
}

const keywordCache = new WeakMap<PacoteAssunto[], KeywordIndex>();

function keywordIndex(vocab: PacoteAssunto[]): KeywordIndex {
  const cached = keywordCache.get(vocab);
  if (cached) return cached;
  const entries = vocab
    .filter((a) => a.caminho.length >= 2)
    .map((assunto) => ({
      assunto,
      leaf: keywords([assunto.caminho.at(-1) ?? '', ...assunto.sinonimos].join(' ')),
      parents: keywords(assunto.caminho.slice(0, -1).join(' ')),
    }));
  const df = new Map<string, number>();
  for (const { leaf, parents } of entries) for (const w of new Set([...leaf, ...parents])) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = new Map([...df.entries()].map(([w, n]) => [w, Math.log(1 + entries.length / n)]));
  const built = { entries, idf };
  keywordCache.set(vocab, built);
  return built;
}

/**
 * Candidatos para a IA: os assuntos com mais palavras em comum com o caminho do tópico (palavra rara pesa mais; a
 * folha do assunto vale o dobro dos pais). Nunca a matéria inteira. A IA só escolhe entre eles — não inventa assunto.
 */
export function aiCandidates(caminho: string[], vocab: PacoteAssunto[], k = MAX_AI_CANDIDATES): PacoteAssunto[] {
  const { entries, idf } = keywordIndex(vocab);
  const words = keywords(caminho.join(' '));
  const scored = entries.map(({ assunto, leaf, parents }) => {
    let score = 0;
    for (const w of words) {
      if (leaf.has(w)) score += 2 * (idf.get(w) ?? 0);
      else if (parents.has(w)) score += idf.get(w) ?? 0;
    }
    return { assunto, score };
  });
  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.assunto.id.localeCompare(b.assunto.id))
    .slice(0, k)
    .map((c) => c.assunto);
}

const LINK_RULES = `Você liga um tópico do plano de estudo de um estudante de concurso a assuntos de um vocabulário fechado de questões da banca Cebraspe. Não use ferramentas: responda direto. Regras:
1. A fonte da verdade é a LISTA DE ASSUNTOS abaixo. Escolha só ids dessa lista, copiados exatamente. Não invente id nem assunto.
2. Escolha os assuntos cujas questões cobram o MESMO conteúdo do tópico (não basta ter palavras parecidas). No máximo ${MAX_LINKS_PER_TOPIC}.
3. Se nenhum assunto da lista cobre o tópico, devolva a lista vazia. Isso é uma resposta válida e preferível a um palpite.
4. "confianca" vai de 0 a 1: o quanto você tem certeza de que as questões daquele assunto são do tópico.
5. Responda SOMENTE com o JSON {"assuntos":[{"id":"…","confianca":0.0}]}, sem texto antes ou depois.`;

export function buildLinkPrompt(caminho: string[], candidates: PacoteAssunto[]): string {
  const list = candidates.map((c, i) => `${i + 1}. ${c.id} — ${c.caminho.join(' › ')}`).join('\n');
  return `${LINK_RULES}\n\nTÓPICO DO PLANO: ${caminho.join(' › ')}\n\nLISTA DE ASSUNTOS:\n${list}`;
}

interface LinkChoice {
  id: string;
  confianca: number;
}

function readChoice(value: unknown): LinkChoice | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id, confianca } = value as { id?: unknown; confianca?: unknown };
  return typeof id === 'string' && typeof confianca === 'number' ? { id, confianca } : null;
}

/**
 * Resposta da IA conferida: só ids da lista de candidatos, com confiança mínima, no máximo 3 (os mais confiantes).
 * `[]` = nenhum serve (o tópico fica sem ligação); `null` = resposta ilegível.
 */
export function parseLinkResponse(text: string, candidateIds: ReadonlySet<string>): string[] | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  const assuntos = (parsed as { assuntos?: unknown }).assuntos;
  if (!Array.isArray(assuntos)) return null;
  return assuntos
    .map(readChoice)
    .filter((c): c is LinkChoice => c !== null && candidateIds.has(c.id) && c.confianca >= MIN_AI_CONFIDENCE)
    .sort((a, b) => b.confianca - a.confianca)
    .slice(0, MAX_LINKS_PER_TOPIC)
    .map((a) => a.id);
}
