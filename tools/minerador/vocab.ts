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
