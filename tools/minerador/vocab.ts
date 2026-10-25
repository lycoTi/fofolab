import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseEdital, type EditalSubject } from '../../src/lib/editalParser';
import { textItemsToLines, type PdfTextItem } from '../../src/lib/pdfText';

/**
 * Vocabulário de assuntos canônicos (spec 12 §6.4). Nasce dos tópicos do edital da CGU 2026 — todas as matérias de
 * todos os cargos — e cresce por propostas da IA, com versão a cada mudança aceita. O id é estável: o caminho
 * normalizado (sem acento, minúsculas), níveis separados por ">".
 */
export interface Assunto {
  id: string;
  caminho: string[];
  sinonimos: string[];
  origem: 'edital' | 'proposta';
}

export interface Vocabulario {
  versao: number;
  assuntos: Assunto[];
  historico: { versao: number; mudancas: string[] }[];
}

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const assuntoId = (caminho: string[]): string => caminho.map(slug).join('>');

/** Linhas do PDF do edital, com a mesma montagem que o app usa na importação (spec 07). */
export async function readEditalLines(pdfPath: string): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(pdfPath)), verbosity: 0 }).promise;
  const lines: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const content = await (await doc.getPage(n)).getTextContent();
    lines.push(...textItemsToLines(content.items.filter((item) => 'str' in item) as PdfTextItem[]));
  }
  await doc.destroy();
  return lines;
}

/** Caminho de um tópico: matéria + títulos dos pais pelo código ("1.2" tem o pai "1") + o próprio título. */
function topicPaths(subject: EditalSubject): string[][] {
  const titleByCode = new Map(subject.topics.filter((t) => t.code).map((t) => [t.code as string, t.title]));
  return subject.topics.map((topic) => {
    const parents: string[] = [];
    const parts = topic.code ? topic.code.split('.') : [];
    for (let i = 1; i < parts.length; i += 1) {
      const parentTitle = titleByCode.get(parts.slice(0, i).join('.'));
      if (parentTitle) parents.push(parentTitle);
    }
    return [subject.name, ...parents, topic.title];
  });
}

export interface PropostaAssunto {
  caminho: string[];
  confianca: number;
}

/** Palavras de 3+ letras, sem acento, cortadas no 6º caractere: "estruturas" e "estrutura" contam igual. */
const nameWords = (text: string) => new Set(slug(text).split('-').filter((w) => w.length >= 3).map((w) => w.slice(0, 6)));

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = [...a].filter((w) => b.has(w)).length;
  return inter / (a.size + b.size - inter);
}

/** Mesmo pai e nome do assunto quase igual (≥ 0.8) — para não duplicar "Estrutura de dados" × "Estruturas de dados". */
const NEAR = 0.8;
const sameParent = (a: string[], b: string[]) => assuntoId(a.slice(0, -1)) === assuntoId(b.slice(0, -1));

function findExisting(assuntos: Assunto[], caminho: string[]): Assunto | undefined {
  const id = assuntoId(caminho);
  const exact = assuntos.find((a) => a.id === id);
  if (exact) return exact;
  const leaf = nameWords(caminho.at(-1) ?? '');
  return assuntos.find((a) => a.caminho.length === caminho.length && sameParent(a.caminho, caminho) && jaccard(nameWords(a.caminho.at(-1) ?? ''), leaf) >= NEAR);
}

/**
 * Propostas da IA (spec 12 §6.4): igual ou quase igual a um assunto existente vira esse assunto (`mapeadas`, chave =
 * id proposto); nova com confiança ≥ `minConfianca` entra numa versão nova (uma por chamada, com a lista do que mudou);
 * abaixo fica pendente — os itens dela ficam incertos até uma rodada com modelo melhor.
 */
export function applyProposals(
  vocab: Vocabulario,
  propostas: PropostaAssunto[],
  minConfianca: number
): { vocab: Vocabulario; aceitas: string[]; pendentes: PropostaAssunto[]; mapeadas: Record<string, string> } {
  const assuntos = [...vocab.assuntos];
  const aceitas: string[] = [];
  const pendentes: PropostaAssunto[] = [];
  const mapeadas: Record<string, string> = {};
  for (const proposta of propostas) {
    const caminho = proposta.caminho.map((p) => p.trim()).filter(Boolean);
    if (caminho.length === 0) continue;
    const existing = findExisting(assuntos, caminho);
    if (existing) {
      mapeadas[assuntoId(caminho)] = existing.id;
      continue;
    }
    if (proposta.confianca < minConfianca) {
      pendentes.push(proposta);
      continue;
    }
    const novo: Assunto = { id: assuntoId(caminho), caminho, sinonimos: [], origem: 'proposta' };
    assuntos.push(novo);
    aceitas.push(novo.id);
  }
  if (aceitas.length === 0) return { vocab, aceitas, pendentes, mapeadas };
  const versao = vocab.versao + 1;
  const byId = new Map(assuntos.map((a) => [a.id, a]));
  const mudancas = aceitas.map((id) => `novo assunto: ${byId.get(id)!.caminho.join(' › ')}`);
  return {
    vocab: { versao, assuntos: assuntos.sort((a, b) => a.id.localeCompare(b.id)), historico: [...vocab.historico, { versao, mudancas }] },
    aceitas,
    pendentes,
    mapeadas,
  };
}

/** Pares de irmãos com nomes quase iguais: sugestão de junção para o relatório (não junta sozinho). */
export function mergeCandidates(vocab: Vocabulario): [string, string][] {
  const pares: [string, string][] = [];
  const list = vocab.assuntos;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const [a, b] = [list[i], list[j]];
      if (a.caminho.length !== b.caminho.length || !sameParent(a.caminho, b.caminho)) continue;
      if (jaccard(nameWords(a.caminho.at(-1) ?? ''), nameWords(b.caminho.at(-1) ?? '')) >= NEAR) {
        pares.push([a.id, b.id].sort() as [string, string]);
      }
    }
  }
  return pares;
}

export function seedFromEdital(lines: string[]): Vocabulario {
  const edital = parseEdital(lines);
  const subjects = [...edital.commonSubjects, ...Object.values(edital.roleSubjects).flat()];
  const byId = new Map<string, Assunto>();
  const add = (caminho: string[]) => {
    const id = assuntoId(caminho);
    if (!byId.has(id)) byId.set(id, { id, caminho, sinonimos: [], origem: 'edital' });
  };
  for (const subject of subjects) {
    // A matéria também é assunto: item que cabe nela sem caber num tópico específico
    add([subject.name]);
    for (const path of topicPaths(subject)) add(path);
  }
  const assuntos = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { versao: 1, assuntos, historico: [{ versao: 1, mudancas: [`semente: ${assuntos.length} assuntos do edital`] }] };
}
