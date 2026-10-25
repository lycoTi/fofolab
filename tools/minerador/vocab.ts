import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
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

/**
 * Palavras de 3+ letras, sem acento, sem o "s" do plural, cortadas no 6º caractere: "estruturas" e "estrutura",
 * "textos" e "texto" contam igual.
 */
const nameWords = (text: string) =>
  new Set(
    slug(text)
      .split('-')
      .filter((w) => w.length >= 3)
      .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w).slice(0, 6))
  );

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = [...a].filter((w) => b.has(w)).length;
  return inter / (a.size + b.size - inter);
}

/** Mesmo pai e nome do assunto quase igual (≥ 0.8) — para não duplicar "Estrutura de dados" × "Estruturas de dados". */
const NEAR = 0.8;
const sameParent = (a: string[], b: string[]) => assuntoId(a.slice(0, -1)) === assuntoId(b.slice(0, -1));

/**
 * Dois nomes do mesmo assunto: quase iguais (Jaccard ≥ 0.8) ou um contido no outro com 2+ palavras ("Auditoria
 * Governamental" ⊂ "Fundamentos de Auditoria Governamental e Atuação Integrada da CGU"; "Interpretação de texto" ⊂
 * "Compreensão e interpretação de textos").
 */
function sameName(a: string, b: string): boolean {
  const [wa, wb] = [nameWords(a), nameWords(b)];
  if (jaccard(wa, wb) >= NEAR) return true;
  const [small, large] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  return small.size >= 2 && [...small].every((w) => large.has(w));
}

/** Nomes já usados num nível, abaixo de um pai (os pais existem implícitos nos caminhos dos assuntos). */
function namesAt(assuntos: Assunto[], parent: string[]): string[] {
  const parentId = assuntoId(parent);
  const names = new Set<string>();
  for (const a of assuntos) {
    if (a.caminho.length <= parent.length) continue;
    if (assuntoId(a.caminho.slice(0, parent.length)) === parentId) names.add(a.caminho[parent.length]);
  }
  return [...names].sort();
}

/**
 * Caminho canônico da proposta: cada nível casa com um nome que já existe abaixo do mesmo pai (a IA escreve "Raciocínio
 * Lógico e Matemática" num lote e "Raciocínio Lógico-Matemático" no outro).
 */
function canonicalPath(assuntos: Assunto[], caminho: string[]): string[] {
  const out: string[] = [];
  for (const name of caminho) {
    const existing = namesAt(assuntos, out).find((n) => sameName(n, name));
    out.push(existing ?? name);
  }
  return out;
}

/**
 * Propostas da IA (spec 12 §6.4): o caminho é canonizado contra o vocabulário; se o assunto já existe, a proposta vira
 * ele; senão, com confiança ≥ `minConfianca`, entra (com a matéria e os níveis de cima que faltarem) numa versão nova —
 * uma por chamada, com a lista do que mudou; abaixo fica pendente. `mapeadas` dá o destino de toda proposta resolvida
 * (chave = id do caminho como a IA escreveu).
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
    const original = proposta.caminho.map((p) => p.trim()).filter(Boolean);
    if (original.length === 0) continue;
    const caminho = canonicalPath(assuntos, original);
    const id = assuntoId(caminho);
    if (assuntos.some((a) => a.id === id)) {
      mapeadas[assuntoId(original)] = id;
      continue;
    }
    if (proposta.confianca < minConfianca) {
      pendentes.push(proposta);
      continue;
    }
    // A matéria (e os níveis de cima) também viram assunto: a próxima proposta casa com eles
    for (let level = 1; level <= caminho.length; level += 1) {
      const path = caminho.slice(0, level);
      const pathId = assuntoId(path);
      if (assuntos.some((a) => a.id === pathId)) continue;
      assuntos.push({ id: pathId, caminho: path, sinonimos: [], origem: 'proposta' });
      aceitas.push(pathId);
    }
    mapeadas[assuntoId(original)] = id;
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

export function readVocabulario(path: string): Vocabulario | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as Vocabulario;
}

/** Determinístico: assuntos em ordem de id e chaves em ordem fixa — o diff do git mostra só mudança real. */
export function writeVocabulario(path: string, vocab: Vocabulario): void {
  mkdirSync(dirname(path), { recursive: true });
  const file = {
    versao: vocab.versao,
    assuntos: [...vocab.assuntos]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((a) => ({ id: a.id, caminho: a.caminho, sinonimos: a.sinonimos, origem: a.origem })),
    historico: vocab.historico,
  };
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
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
