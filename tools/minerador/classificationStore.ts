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

/** Palavras que não identificam um tópico sozinhas: "Conceitos básicos" existe em quase toda matéria. */
const GENERICAS = new Set([
  'conceitos', 'basicos', 'basicas', 'nocoes', 'gerais', 'geral', 'introducao', 'fundamentos', 'principios', 'aspectos',
  'definicao', 'definicoes', 'caracteristicas', 'tipos', 'classificacao', 'disposicoes', 'outros', 'outras', 'temas',
]);

const leafOf = (id: string) => id.slice(id.lastIndexOf('>') + 1);
const depth = (id: string) => id.split('>').length;
/** O último nível identifica o tópico quando tem duas palavras de 4+ letras que não sejam genéricas. */
const distinctiveLeaf = (id: string) => leafOf(id).split('-').filter((w) => w.length >= 4 && !GENERICAS.has(w)).length >= 2;

/**
 * Mesmo tópico: o mesmo id; um dentro do outro (pai e filho do mesmo ramo); ou o mesmo nome no último nível em matérias
 * diferentes — o vocabulário junta editais, e "Despesas de exercícios anteriores" vem em Finanças Públicas num e em
 * Administração Orçamentária noutro (amostra de 25/10: discordâncias que eram o mesmo tópico).
 */
function sameTopic(a: string, b: string): boolean {
  if (a === b || a.startsWith(`${b}>`) || b.startsWith(`${a}>`)) return true;
  return leafOf(a) === leafOf(b) && distinctiveLeaf(a);
}

function groupTopics(ids: string[]): string[][] {
  const groups: string[][] = [];
  for (const id of ids) {
    const matching = groups.filter((g) => g.some((m) => sameTopic(m, id)));
    for (const g of matching) groups.splice(groups.indexOf(g), 1);
    groups.push([...matching.flat(), id]);
  }
  return groups;
}

/**
 * Uma opinião: o consenso é ela; incerto se o principal tem confiança < 0,7 ou se nada foi escolhido. Duas ou mais: os
 * assuntos de todas viram grupos quando são o mesmo tópico (`sameTopic`), e o grupo fala pelo mais específico; entram
 * os grupos escolhidos pela maioria (com a confiança média); "concordam" quando o principal de alguma opinião está na
 * escolha de todas; senão "discordam", incerto, e o consenso leva o principal de cada uma.
 */
export function consensus(opinioes: Record<string, Opiniao>): Pick<ClassificacaoItem, 'consenso' | 'incerto' | 'concordancia'> {
  const lists = Object.keys(opinioes).sort().map((k) => cleanOpinion(opinioes[k].assuntos));
  if (lists.length <= 1) {
    const only = lists[0] ?? [];
    return { consenso: only, incerto: only.length === 0 || only[0].confianca < CONFIANCA_CERTA, concordancia: 'uma-opiniao' };
  }
  const groups = groupTopics([...new Set(lists.flatMap((l) => l.map((a) => a.id)))].sort());
  const scored = groups.map((members) => {
    // A melhor confiança de cada opinião dentro do grupo (uma opinião pode ter escolhido o pai e o filho)
    const confs = lists.flatMap((l) => {
      const inGroup = l.filter((a) => members.includes(a.id));
      return inGroup.length > 0 ? [Math.max(...inGroup.map((a) => a.confianca))] : [];
    });
    const id = [...members].sort((a, b) => depth(b) - depth(a) || a.localeCompare(b))[0];
    return { members, id, votes: confs.length, confianca: round(confs.reduce((s, c) => s + c, 0) / lists.length) };
  });
  const votesOf = (id: string) => scored.find((g) => g.members.includes(id))?.votes ?? 0;
  // Concordam quando o principal de alguma opinião está na escolha de todas: ordem trocada ("Leitura dos balanços" ×
  // "Relações entre execuções", SECONT 2022) ou um como secundário do outro (amostra de 25/10: políticas sociais ×
  // direitos humanos, com direitos humanos nos dois). Secundário fraco puxa a média para baixo e deixa o selinho
  const agree = lists.every((l) => l.length > 0) && lists.some((l) => votesOf(l[0].id) === lists.length);
  const majority = Math.floor(lists.length / 2) + 1;
  const chosen = scored
    .filter((g) => g.votes >= majority)
    .map(({ id, confianca }) => ({ id, confianca }))
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
