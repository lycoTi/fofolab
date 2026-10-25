import type { AcervoItem } from './types';
import type { Assunto, Vocabulario } from './vocab';

/**
 * Candidatos locais (spec 12 §6.4): antes de chamar a IA, o minerador escolhe os assuntos com mais palavras em comum
 * com o item — a IA só escolhe entre eles (ou propõe um novo), o que economiza limite e impede assunto inventado.
 * Palavra rara no vocabulário pesa mais que palavra comum ("dados" aparece em dezenas de assuntos); o título do próprio
 * assunto pesa o dobro dos títulos dos pais.
 */
const STOPWORDS = new Set([
  'julgue', 'item', 'itens', 'seguir', 'acerca', 'correto', 'correta', 'afirmar', 'considerando', 'considere', 'assinale',
  'opcao', 'situacao', 'hipotetica', 'subsequente', 'subsequentes', 'subsecutivo', 'subsecutivos', 'proximos', 'seguinte',
  'seguintes', 'texto', 'sobre', 'entre', 'para', 'como', 'quando', 'sendo', 'pois', 'essa', 'esse', 'este', 'esta', 'isso',
  'pelo', 'pela', 'pelos', 'pelas', 'seus', 'suas', 'deve', 'pode', 'podem', 'sera', 'estao', 'mais', 'menos', 'muito',
  'apenas', 'ainda', 'tambem', 'qual', 'quais', 'cujo', 'cuja', 'aspectos', 'conceitos', 'nocoes', 'fundamentos',
]);
const STEM = 6;

export function keywords(text: string): Set<string> {
  return new Set(
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
      .map((w) => w.slice(0, STEM))
  );
}

interface Indexed {
  assunto: Assunto;
  leaf: Set<string>;
  parents: Set<string>;
}

const cache = new WeakMap<Vocabulario, { indexed: Indexed[]; idf: Map<string, number> }>();

function index(vocab: Vocabulario) {
  const cached = cache.get(vocab);
  if (cached) return cached;
  const indexed = vocab.assuntos.map((assunto) => ({
    assunto,
    leaf: keywords([assunto.caminho.at(-1) ?? '', ...assunto.sinonimos].join(' ')),
    parents: keywords(assunto.caminho.slice(0, -1).join(' ')),
  }));
  const df = new Map<string, number>();
  for (const { leaf, parents } of indexed) for (const w of new Set([...leaf, ...parents])) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = new Map([...df.entries()].map(([w, n]) => [w, Math.log(1 + indexed.length / n)]));
  const built = { indexed, idf };
  cache.set(vocab, built);
  return built;
}

const itemText = (item: AcervoItem) => [item.textoBase ?? '', item.enunciado, ...(item.alternativas ?? [])].join(' ');

export function candidatesFor(item: AcervoItem, vocab: Vocabulario, k: number): { id: string; score: number }[] {
  const { indexed, idf } = index(vocab);
  const words = keywords(itemText(item));
  // A matéria de origem é pista fraca: soma pouco, nunca decide sozinha
  const origin = keywords(item.materiaOrigem ?? '');
  const scored = indexed.map(({ assunto, leaf, parents }) => {
    let score = 0;
    for (const w of words) {
      if (leaf.has(w)) score += 2 * (idf.get(w) ?? 0);
      else if (parents.has(w)) score += idf.get(w) ?? 0;
    }
    if (score > 0) for (const w of origin) if (parents.has(w) || leaf.has(w)) score += 0.25 * (idf.get(w) ?? 0);
    return { id: assunto.id, score };
  });
  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, k);
}

/** Fila da classificação: o que mais casa com o vocabulário (o edital do dono) primeiro. */
export function queueOrder(items: AcervoItem[], vocab: Vocabulario): AcervoItem[] {
  const best = new Map(items.map((i) => [i.id, candidatesFor(i, vocab, 1)[0]?.score ?? 0]));
  return [...items].sort((a, b) => (best.get(b.id) ?? 0) - (best.get(a.id) ?? 0) || a.id.localeCompare(b.id));
}
