import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readConcurso } from './acervoStore';
import { LimiteDiario, type AiProvider } from './aiProvider';
import { candidatesFor, queueOrder } from './candidates';
import { consensus, readClassificacao, writeClassificacao, type ClassificacaoConcurso, type Opiniao } from './classificationStore';
import { buildBatchPrompt, estimateTokens, parseBatchResponse, type AssuntoDoItem, type BatchEntry } from './classifyPrompt';
import type { AcervoItem } from './types';
import { applyProposals, assuntoId, juntarAssunto, mergeCandidates, readVocabulario, writeVocabulario, type Assunto, type Vocabulario } from './vocab';

/**
 * Uma rodada de classificação (spec 12 §6.4) com um provedor: fila por relevância, lotes, validação, propostas e
 * gravação ao fim de cada lote — interromper e rodar de novo continua de onde parou. `alvo`:
 * - 'sem-opiniao': 1ª classificação (itens sem nenhuma opinião);
 * - 'todos': conferência independente — itens sem opinião DESTE modelo (o prompt é o mesmo, sem a opinião anterior);
 * - 'discordantes': desempate — itens em que as opiniões discordam e falta a deste modelo.
 */
export type Alvo = 'sem-opiniao' | 'todos' | 'discordantes';

export interface ClassifyReport {
  classificados: number;
  incertos: number;
  concordam: number;
  discordam: number;
  semResposta: number;
  propostasAceitas: string[];
  propostasPendentes: number;
  juncoesSugeridas: [string, string][];
  versaoVocabulario: number;
  parouNoLimite: boolean;
}

/** Proposta aceita entra com confiança alta o bastante para valer; abaixo, fica pendente e o item incerto. */
const MIN_CONFIANCA_PROPOSTA = 0.8;
/** Groq grátis: 8.000 tokens por minuto por modelo — um pedido não passa disto. */
const MAX_PROMPT_TOKENS = { groq: 6000, default: 40000 };
const TOKENS_POR_ITEM = 60;

/**
 * Refaz o consenso de todos os itens a partir das opiniões guardadas, sem chamar IA — as opiniões são a fonte; o
 * consenso é derivado e muda quando a regra muda.
 */
export function recalcularConsenso(
  acervoDir: string,
  remap: Record<string, string> = {}
): { concordam: number; discordam: number; umaOpiniao: number; incertos: number; afetados: number } {
  const dir = join(acervoDir, 'classificacao');
  const totals = { concordam: 0, discordam: 0, umaOpiniao: 0, incertos: 0, afetados: 0 };
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const c = readClassificacao(dir, file.slice(0, -5));
    for (const [id, item] of Object.entries(c.itens)) {
      const opinioes = remapOpinioes(item.opinioes, remap);
      if (opinioes !== item.opinioes) totals.afetados += 1;
      const updated = { opinioes, ...consensus(opinioes) };
      c.itens[id] = updated;
      if (updated.concordancia === 'concordam') totals.concordam += 1;
      if (updated.concordancia === 'discordam') totals.discordam += 1;
      if (updated.concordancia === 'uma-opiniao') totals.umaOpiniao += 1;
      if (updated.incerto) totals.incertos += 1;
    }
    writeClassificacao(dir, c);
  }
  return totals;
}

/** Troca os ids juntados; dois assuntos que viram o mesmo ficam um só, com a confiança maior. Sem troca, o mesmo objeto. */
function remapOpinioes(opinioes: Record<string, Opiniao>, remap: Record<string, string>): Record<string, Opiniao> {
  const touched = Object.values(opinioes).some((o) => o.assuntos.some((a) => remap[a.id]));
  if (!touched) return opinioes;
  const out: Record<string, Opiniao> = {};
  for (const [key, o] of Object.entries(opinioes)) {
    const best = new Map<string, number>();
    for (const a of o.assuntos) {
      const id = remap[a.id] ?? a.id;
      best.set(id, Math.max(best.get(id) ?? 0, a.confianca));
    }
    out[key] = { ...o, assuntos: [...best.entries()].map(([id, confianca]) => ({ id, confianca })).sort((x, y) => y.confianca - x.confianca) };
  }
  return out;
}

/** Junta `de` em `para` no vocabulário e em todas as opiniões guardadas; o consenso é refeito. */
export function juntar(acervoDir: string, de: string, para: string): { versaoVocabulario: number; itensAfetados: number } {
  const vocabPath = join(acervoDir, 'vocabulario.json');
  const loaded = readVocabulario(vocabPath);
  if (!loaded) throw new Error('Falta acervo/vocabulario.json: rode "npm run minerar -- semente" primeiro.');
  const { vocab, remap } = juntarAssunto(loaded, de, para);
  writeVocabulario(vocabPath, vocab);
  const { afetados } = recalcularConsenso(acervoDir, remap);
  return { versaoVocabulario: vocab.versao, itensAfetados: afetados };
}

/** Matérias (primeiro nível) do vocabulário atual: vão no prompt para a proposta não inventar variação de nome. */
const materiasOf = (vocab: Vocabulario) => vocab.assuntos.filter((a) => a.caminho.length === 1).map((a) => a.caminho[0]).sort();

interface Queued {
  item: AcervoItem;
  concurso: string;
}

function loadQueue(acervoDir: string, classifDir: string, alvo: Alvo, key: string) {
  const concursosDir = join(acervoDir, 'cebraspe');
  const classif = new Map<string, ClassificacaoConcurso>();
  const queue: Queued[] = [];
  const ids = readdirSync(concursosDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  for (const concurso of ids) {
    const c = readClassificacao(classifDir, concurso);
    classif.set(concurso, c);
    for (const item of readConcurso(concursosDir, concurso)) {
      if (item.anulado) continue;
      const opinioes = c.itens[item.id]?.opinioes ?? {};
      const hasAny = Object.keys(opinioes).length > 0;
      const wanted =
        (alvo === 'sem-opiniao' && !hasAny) ||
        (alvo === 'todos' && !opinioes[key]) ||
        (alvo === 'discordantes' && c.itens[item.id]?.concordancia === 'discordam' && !opinioes[key]);
      if (wanted) queue.push({ item, concurso });
    }
  }
  return { classif, queue };
}

/** Lotes de até `tamanhoLote` itens sem passar do teto de tokens do provedor. */
function batches(queue: Queued[], vocab: Vocabulario, provider: AiProvider, k: number): { entries: BatchEntry[]; owners: Queued[] }[] {
  const byId = new Map(vocab.assuntos.map((a) => [a.id, a]));
  const maxTokens = provider.nome === 'groq' ? MAX_PROMPT_TOKENS.groq : MAX_PROMPT_TOKENS.default;
  const out: { entries: BatchEntry[]; owners: Queued[] }[] = [];
  let current: { entries: BatchEntry[]; owners: Queued[] } = { entries: [], owners: [] };
  for (const q of queue) {
    const candidatos = candidatesFor(q.item, vocab, k).map((c) => byId.get(c.id)).filter((a): a is Assunto => !!a);
    const entry = { item: q.item, candidatos };
    const tooBig = current.entries.length > 0 && estimateTokens(buildBatchPrompt([...current.entries, entry], materiasOf(vocab))) > maxTokens;
    if (current.entries.length >= provider.tamanhoLote || tooBig) {
      out.push(current);
      current = { entries: [], owners: [] };
    }
    current.entries.push(entry);
    current.owners.push(q);
  }
  if (current.entries.length > 0) out.push(current);
  return out;
}

/**
 * `paralelo`: lotes ao mesmo tempo (o `agy` leva ~1,5 min por lote de 30). O que vem depois de cada resposta — validar,
 * aplicar propostas, gravar — não tem `await`, então dois lotes nunca se atropelam ao mexer no vocabulário ou nos arquivos.
 */
export async function runClassificacao(opts: {
  provider: AiProvider;
  acervoDir: string;
  limite: number;
  alvo: Alvo;
  k: number;
  paralelo?: number;
  /** Matérias (ids de 1º nível) que vão para o começo da fila — as do edital do dono. */
  prioridade?: ReadonlySet<string>;
}): Promise<ClassifyReport> {
  const vocabPath = join(opts.acervoDir, 'vocabulario.json');
  const classifDir = join(opts.acervoDir, 'classificacao');
  const loaded = readVocabulario(vocabPath);
  if (!loaded) throw new Error('Falta acervo/vocabulario.json: rode "npm run minerar -- semente" primeiro.');
  let vocab: Vocabulario = loaded;
  const key = `${opts.provider.nome}:${opts.provider.modelo}`;
  const report: ClassifyReport = {
    classificados: 0, incertos: 0, concordam: 0, discordam: 0, semResposta: 0, propostasAceitas: [], propostasPendentes: 0,
    juncoesSugeridas: [], versaoVocabulario: vocab.versao, parouNoLimite: false,
  };

  const { classif, queue } = loadQueue(opts.acervoDir, classifDir, opts.alvo, key);
  const ordered = queueOrder(queue.map((q) => q.item), vocab, opts.prioridade).slice(0, opts.limite);
  const concursoOf = new Map(queue.map((q) => [q.item.id, q.concurso]));
  const selected = ordered.map((item) => ({ item, concurso: concursoOf.get(item.id)! }));

  const pending = batches(selected, vocab, opts.provider, opts.k);
  const worker = async () => {
    for (let batch = pending.shift(); batch && !report.parouNoLimite; batch = pending.shift()) {
      let text: string;
      try {
        text = await opts.provider.complete(buildBatchPrompt(batch.entries, materiasOf(vocab)), TOKENS_POR_ITEM * batch.entries.length + 100);
      } catch (err) {
        if (err instanceof LimiteDiario) {
          report.parouNoLimite = true;
          return;
        }
        // Falha avulsa (rede, resposta fora do esquema): os itens voltam à fila na próxima rodada
        report.semResposta += batch.entries.length;
        continue;
      }
      absorb(batch, text);
    }
  };

  /** Síncrono de propósito: validar, aplicar propostas e gravar sem pausa no meio (seguro com lotes em paralelo). */
  const absorb = (batch: { entries: BatchEntry[]; owners: Queued[] }, text: string) => {
    const parsed = parseBatchResponse(text, batch.entries);
    const propostas = [...parsed.values()].flatMap((r) => (r.proposta ? [r.proposta] : []));
    const applied = applyProposals(vocab, propostas, MIN_CONFIANCA_PROPOSTA);
    vocab = applied.vocab;
    report.propostasAceitas.push(...applied.aceitas);
    report.propostasPendentes += applied.pendentes.length;

    const touched = new Set<string>();
    for (const { item, concurso } of batch.owners) {
      const result = parsed.get(item.id);
      if (!result) {
        report.semResposta += 1;
        continue;
      }
      const assuntos: AssuntoDoItem[] = [...result.assuntos];
      if (result.proposta) {
        const proposed = assuntoId(result.proposta.caminho);
        // Aceita ou casada com uma existente, a proposta tem destino canônico em `mapeadas`; pendente, não tem
        const target = applied.mapeadas[proposed] ?? null;
        if (target && !assuntos.some((a) => a.id === target)) assuntos.push({ id: target, confianca: result.proposta.confianca });
      }
      const c = classif.get(concurso)!;
      const opinioes = { ...(c.itens[item.id]?.opinioes ?? {}), [key]: { assuntos, versaoVocabulario: vocab.versao } };
      const merged = { opinioes, ...consensus(opinioes) };
      c.itens[item.id] = merged;
      touched.add(concurso);
      report.classificados += 1;
      if (merged.incerto) report.incertos += 1;
      if (merged.concordancia === 'concordam') report.concordam += 1;
      if (merged.concordancia === 'discordam') report.discordam += 1;
    }
    for (const concurso of touched) writeClassificacao(classifDir, classif.get(concurso)!);
    if (applied.aceitas.length > 0) writeVocabulario(vocabPath, vocab);
  };

  const workers = Math.max(1, opts.paralelo ?? 1);
  await Promise.all(Array.from({ length: workers }, () => worker()));

  report.versaoVocabulario = vocab.versao;
  report.juncoesSugeridas = mergeCandidates(vocab);
  return report;
}
