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

/**
 * Pistas de matéria: o item de Português fala do ASSUNTO do texto ("tecnologia social") e quase não tem palavras em
 * comum com "coesão" ou "morfossintaxe" — sem a pista, os tópicos de Português nem chegavam à IA e ela inventava um
 * novo (amostra de 25/10: 11 de 17 propostas eram de Português). Com a marca típica da questão, os tópicos de 2º nível
 * da matéria entram como candidatos.
 */
const PISTAS: { materia: RegExp; marca: (text: string) => boolean }[] = [
  {
    materia: /^l[ií]ngua portuguesa$/i,
    marca: (t) =>
      /\b(trecho|voc[áa]bulo|ora[çc][ãa]o|corre[çc][ãa]o gramatical|crase|concord[âa]ncia (verbal|nominal)|reg[êe]ncia|pontua[çc][ãa]o|acentua[çc][ãa]o|reescrit\w*|coes[ãa]o|pronome|conjun[çc][ãa]o|preposi[çc][ãa]o|v[íi]rgula|sentido original)\b/i.test(t),
  },
  {
    materia: /racioc[íi]nio l[óo]gico/i,
    marca: (t) =>
      /\b(proposi[çc][ãa]o|proposi[çc][õo]es|tabela-verdade|contrapositiva|silogismo|tautologia|equival[êe]ncia l[óo]gica|permuta[çc][õo]es|an[áa]lise combinat[óo]ria)\b/i.test(t),
  },
  { materia: /^l[ií]ngua inglesa$/i, marca: (t) => (t.match(/\b(the|and|of|to|is|that|which|are)\b/gi) ?? []).length >= 4 },
];
const MAX_PISTA = 10;

function cueCandidates(item: AcervoItem, vocab: Vocabulario): string[] {
  const text = itemText(item);
  const ids: string[] = [];
  for (const pista of PISTAS) {
    if (!pista.marca(text)) continue;
    const materia = vocab.assuntos.find((a) => a.caminho.length === 1 && pista.materia.test(a.caminho[0]));
    if (!materia) continue;
    for (const a of vocab.assuntos) if (a.caminho.length === 2 && a.caminho[0] === materia.caminho[0]) ids.push(a.id);
  }
  return ids.slice(0, MAX_PISTA);
}

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
  const top = scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, k);
  const present = new Set(top.map((c) => c.id));
  const extras = cueCandidates(item, vocab).filter((id) => !present.has(id)).map((id) => ({ id, score: 0 }));
  return [...top, ...extras];
}

/** Fila da classificação: o que mais casa com o vocabulário (o edital do dono) primeiro. */
export function queueOrder(items: AcervoItem[], vocab: Vocabulario): AcervoItem[] {
  const best = new Map(items.map((i) => [i.id, candidatesFor(i, vocab, 1)[0]?.score ?? 0]));
  return [...items].sort((a, b) => (best.get(b.id) ?? 0) - (best.get(a.id) ?? 0) || a.id.localeCompare(b.id));
}
