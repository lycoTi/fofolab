import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AssuntoDoItem } from './classifyPrompt';

/**
 * Classificação do acervo, separada dos itens (`acervo/classificacao/<ID>.json`): uma opinião por modelo e o consenso
 * calculado. Conferir com outro modelo acrescenta uma opinião — nunca apaga a anterior.
 */
export interface Opiniao {
  assuntos: AssuntoDoItem[];
  versaoVocabulario: number;
}

export type Concordancia = 'uma-opiniao' | 'concordam' | 'discordam';

export interface ClassificacaoItem {
  opinioes: Record<string, Opiniao>;
  consenso: AssuntoDoItem[];
  incerto: boolean;
  concordancia: Concordancia;
}

export interface ClassificacaoConcurso {
  identificador: string;
  itens: Record<string, ClassificacaoItem>;
}

/** Abaixo disto o item é incerto (selinho no app). */
export const CONFIANCA_CERTA = 0.7;
/** Assunto secundário mais fraco que isto é ruído ("Modelagem 0,15" ao lado de "SQL 0,95") e não entra no consenso. */
const SECUNDARIO_MINIMO = 0.4;

const byConfidence = (a: AssuntoDoItem, b: AssuntoDoItem) => b.confianca - a.confianca || a.id.localeCompare(b.id);
const round = (n: number) => Math.round(n * 100) / 100;

function cleanOpinion(assuntos: AssuntoDoItem[]): AssuntoDoItem[] {
  const sorted = [...assuntos].sort(byConfidence);
  return sorted.filter((a, i) => i === 0 || a.confianca >= SECUNDARIO_MINIMO);
}

/**
 * Uma opinião: o consenso é ela; incerto se o principal tem confiança < 0,7 ou se nada foi escolhido. Duas ou mais: os
 * assuntos escolhidos pela maioria (com a confiança média); "concordam" quando o principal de todas é o mesmo; senão
 * "discordam", incerto, e o consenso leva o principal de cada uma.
 */
export function consensus(opinioes: Record<string, Opiniao>): Pick<ClassificacaoItem, 'consenso' | 'incerto' | 'concordancia'> {
  const lists = Object.keys(opinioes).sort().map((k) => cleanOpinion(opinioes[k].assuntos));
  if (lists.length <= 1) {
    const only = lists[0] ?? [];
    return { consenso: only, incerto: only.length === 0 || only[0].confianca < CONFIANCA_CERTA, concordancia: 'uma-opiniao' };
  }
  // Concordam quando o principal de cada opinião está na escolha de todas as outras: os mesmos dois assuntos em ordem
  // trocada ("Leitura dos balanços" × "Relações entre execuções", SECONT 2022) não é discordância
  const sets = lists.map((l) => new Set(l.map((a) => a.id)));
  const agree = lists.every((l) => l.length > 0 && sets.every((s) => s.has(l[0].id)));
  const votes = new Map<string, number[]>();
  for (const list of lists) for (const a of list) votes.set(a.id, [...(votes.get(a.id) ?? []), a.confianca]);
  const majority = Math.floor(lists.length / 2) + 1;
  const chosen = [...votes.entries()]
    .filter(([, confs]) => confs.length >= majority)
    .map(([id, confs]) => ({ id, confianca: round(confs.reduce((s, c) => s + c, 0) / lists.length) }))
    .sort(byConfidence);
  if (agree) return { consenso: chosen, incerto: (chosen[0]?.confianca ?? 0) < CONFIANCA_CERTA, concordancia: 'concordam' };
  const fallback = lists.flatMap((l) => (l[0] ? [{ id: l[0].id, confianca: round(l[0].confianca / lists.length) }] : []));
  const consenso = chosen.length > 0 ? chosen : [...new Map(fallback.map((a) => [a.id, a])).values()].sort(byConfidence);
  return { consenso, incerto: true, concordancia: 'discordam' };
}

const filePath = (dir: string, identificador: string) => join(dir, `${identificador}.json`);

export function readClassificacao(dir: string, identificador: string): ClassificacaoConcurso {
  const path = filePath(dir, identificador);
  if (!existsSync(path)) return { identificador, itens: {} };
  return JSON.parse(readFileSync(path, 'utf8')) as ClassificacaoConcurso;
}

/** Determinístico: itens e opiniões em ordem de chave, chaves de objeto em ordem fixa. */
export function writeClassificacao(dir: string, c: ClassificacaoConcurso): void {
  mkdirSync(dir, { recursive: true });
  const itens: Record<string, ClassificacaoItem> = {};
  for (const id of Object.keys(c.itens).sort()) {
    const item = c.itens[id];
    const opinioes: Record<string, Opiniao> = {};
    for (const k of Object.keys(item.opinioes).sort()) {
      opinioes[k] = { assuntos: item.opinioes[k].assuntos.map((a) => ({ id: a.id, confianca: a.confianca })), versaoVocabulario: item.opinioes[k].versaoVocabulario };
    }
    itens[id] = { opinioes, consenso: item.consenso.map((a) => ({ id: a.id, confianca: a.confianca })), incerto: item.incerto, concordancia: item.concordancia };
  }
  writeFileSync(filePath(dir, c.identificador), `${JSON.stringify({ identificador: c.identificador, itens }, null, 2)}\n`);
}
