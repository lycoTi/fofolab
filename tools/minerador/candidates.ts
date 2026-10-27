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

interface Posting {
  idx: number;
  leafWeight: number;
  anyWeight: number;
}

const cache = new WeakMap<
  Vocabulario,
  { indexed: Indexed[]; idf: Map<string, number>; byWord: Map<string, Posting[]>; pistas: { marca: (text: string) => boolean; ids: string[] }[] }
>();

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
  const byWord = new Map<string, Posting[]>();
  for (let idx = 0; idx < indexed.length; idx++) {
    const { leaf, parents } = indexed[idx];
    const all = new Set([...leaf, ...parents]);
    for (const w of all) {
      const weight = idf.get(w) ?? 0;
      const list = byWord.get(w);
      const posting: Posting = { idx, leafWeight: leaf.has(w) ? 2 * weight : weight, anyWeight: 0.25 * weight };
      if (list) list.push(posting);
      else byWord.set(w, [posting]);
    }
  }
  const pistas = PISTAS.flatMap((pista) => {
    const materia = vocab.assuntos.find((a) => a.caminho.length === 1 && pista.materia.test(a.caminho[0]));
    if (!materia) return [];
    const ids = vocab.assuntos.filter((a) => a.caminho.length === 2 && a.caminho[0] === materia.caminho[0]).map((a) => a.id);
    return [{ marca: pista.marca, ids }];
  });
  const built = { indexed, idf, byWord, pistas };
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
/** Código do texto de apoio da Cebraspe ("texto CB2A1", "texto 1A1-I"): a questão é sobre aquele texto. */
const CODIGO_DO_TEXTO = /\b[Tt]exto (?=[A-Z0-9]*\d)[A-Z0-9]{3,}\b/;

const PISTAS: { materia: RegExp; marca: (text: string) => boolean }[] = [
  {
    materia: /^l[ií]ngua portuguesa$/i,
    marca: (t) =>
      CODIGO_DO_TEXTO.test(t) ||
      /\b(trecho|voc[áa]bulo|ora[çc][ãa]o|corre[çc][ãa]o gramatical|crase|concord[âa]ncia (verbal|nominal)|reg[êe]ncia|pontua[çc][ãa]o|acentua[çc][ãa]o|reescrit\w*|coes[ãa]o|pronome|conjun[çc][ãa]o|preposi[çc][ãa]o|v[íi]rgula|sentido original|par[áa]grafo|tipologia|g[êe]nero textual|fun[çc][ãa]o sint[áa]tica|aspas|ideias veiculadas|(palavra|termo|express[ãa]o) [“"])/i.test(t),
  },
  {
    materia: /racioc[íi]nio l[óo]gico/i,
    marca: (t) =>
      /\b(proposi[çc][ãa]o|proposi[çc][õo]es|tabela-verdade|contrapositiva|silogismo|tautologia|equival[êe]ncia l[óo]gica|permuta[çc][õo]es|an[áa]lise combinat[óo]ria)\b/i.test(t),
  },
  { materia: /^l[ií]ngua inglesa$/i, marca: (t) => (t.match(/\b(the|and|of|to|is|that|which|are)\b/gi) ?? []).length >= 4 },
];
const MAX_PISTA = 12;

function cueCandidates(item: AcervoItem, vocab: Vocabulario): string[] {
  const { pistas } = index(vocab);
  const text = itemText(item);
  const ids: string[] = [];
  for (const pista of pistas) {
    if (pista.marca(text)) ids.push(...pista.ids);
  }
  return ids.slice(0, MAX_PISTA);
}

function scoreItem(item: AcervoItem, vocab: Vocabulario): { indexed: Indexed[]; scores: Float64Array; touched: number[] } {
  const { indexed, byWord } = index(vocab);
  const words = keywords(itemText(item));
  // A matéria de origem é pista fraca: soma pouco, nunca decide sozinha
  const origin = keywords(item.materiaOrigem ?? '');
  const scores = new Float64Array(indexed.length);
  const touched: number[] = [];
  for (const w of words) {
    const postings = byWord.get(w);
    if (!postings) continue;
    for (const p of postings) {
      if (scores[p.idx] === 0) touched.push(p.idx);
      scores[p.idx] += p.leafWeight;
    }
  }
  for (const w of origin) {
    const postings = byWord.get(w);
    if (!postings) continue;
    for (const p of postings) {
      if (scores[p.idx] > 0) scores[p.idx] += p.anyWeight;
    }
  }
  return { indexed, scores, touched };
}

export function candidatesFor(item: AcervoItem, vocab: Vocabulario, k: number): { id: string; score: number }[] {
  const { indexed, scores, touched } = scoreItem(item, vocab);
  const top = touched
    .map((idx) => ({ id: indexed[idx].assunto.id, score: scores[idx] }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, k);
  const present = new Set(top.map((c) => c.id));
  const extras = cueCandidates(item, vocab).filter((id) => !present.has(id)).map((id) => ({ id, score: 0 }));
  return [...top, ...extras];
}

function bestCandidate(item: AcervoItem, vocab: Vocabulario): { id: string; score: number } | undefined {
  const { indexed, scores, touched } = scoreItem(item, vocab);
  let bestIdx = -1;
  let bestScore = 0;
  for (const idx of touched) {
    const s = scores[idx];
    if (s > bestScore || (s === bestScore && bestIdx >= 0 && indexed[idx].assunto.id.localeCompare(indexed[bestIdx].assunto.id) < 0)) {
      bestScore = s;
      bestIdx = idx;
    }
  }
  return bestIdx >= 0 ? { id: indexed[bestIdx].assunto.id, score: bestScore } : undefined;
}

/**
 * Fila da classificação: primeiro os itens cujo melhor candidato é de uma matéria de `prioridade` (ids de 1º nível — as
 * matérias do edital do dono; o acervo tem ~27 mil itens e a cota do Gemini faz ~5 mil por semana); dentro de cada
 * grupo, o que mais casa com o vocabulário.
 */
export function queueOrder(items: AcervoItem[], vocab: Vocabulario, prioridade: ReadonlySet<string> = new Set()): AcervoItem[] {
  const best = new Map(items.map((i) => [i.id, bestCandidate(i, vocab)]));
  const score = (i: AcervoItem) => best.get(i.id)?.score ?? 0;
  const preferred = (i: AcervoItem) => {
    const top = best.get(i.id);
    return top !== undefined && top.score > 0 && prioridade.has(top.id.split('>')[0]) ? 1 : 0;
  };
  return [...items].sort((a, b) => preferred(b) - preferred(a) || score(b) - score(a) || a.id.localeCompare(b.id));
}
