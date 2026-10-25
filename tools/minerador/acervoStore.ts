import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeStatement } from '../../src/lib/questionImport';
import type { AcervoItem, CebraspeEvent, Procedencia } from './types';

/**
 * Acervo no git (spec 12 §6.2): um JSON por concurso em `acervo/cebraspe/<ID>.json`. A saída é determinística — mesma
 * entrada, mesmo arquivo byte a byte — para o diff do git mostrar só mudança real.
 */
export const LOTE_PALAVRAS_PADRAO = [
  'TI', 'TECNOLOGIA', 'SISTEMAS', 'DADOS', 'INFORMATICA', 'SERPRO', 'DATAPREV', 'AUDITOR', 'CONTROLE', 'TCU', 'TCE', 'TCM',
  'CGU', 'CGE', 'MPU', 'STJ', 'STF', 'TST', 'TSE', 'BACEN', 'BANCO CENTRAL', 'ANALISTA',
];

const plain = (text: string) => normalizeStatement(text).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

/** Concursos de `anoMinimo` em diante cujo nome casa alguma palavra inteira do recorte (o dono confere a lista). */
export function buildLote(events: CebraspeEvent[], opts: { anoMinimo: number; palavras: string[] }): string[] {
  const words = opts.palavras.map((p) => plain(p));
  return events
    .filter((e) => e.ano >= opts.anoMinimo)
    .filter((e) => {
      const name = ` ${plain(e.nome)} `;
      return words.some((w) => name.includes(` ${w} `));
    })
    .map((e) => e.identificador)
    .sort();
}

const byOrigin = (a: Procedencia, b: Procedencia) =>
  a.identificador.localeCompare(b.identificador) || a.caderno.localeCompare(b.caderno) || a.numero - b.numero;

const firstOrigin = (item: AcervoItem) => item.procedencias[0];

/** Mesmo texto-base + enunciado + alternativas (sem acento, caixa ou espaço extra) = mesmo item; procedências se somam. */
export function mergeDuplicates(itens: AcervoItem[]): AcervoItem[] {
  const byKey = new Map<string, AcervoItem>();
  const sorted = [...itens].sort((a, b) => byOrigin(firstOrigin(a), firstOrigin(b)));
  for (const item of sorted) {
    const key = normalizeStatement(`${item.textoBase ?? ''} ${item.enunciado} ${(item.alternativas ?? []).join(' ')}`);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item, procedencias: [...item.procedencias] });
      continue;
    }
    const seen = new Set(existing.procedencias.map((p) => `${p.identificador}:${p.caderno}:${p.numero}`));
    for (const p of item.procedencias) {
      if (!seen.has(`${p.identificador}:${p.caderno}:${p.numero}`)) existing.procedencias.push(p);
    }
    existing.procedencias.sort(byOrigin);
  }
  return [...byKey.values()];
}

/** Chaves em ordem fixa: o JSON não muda de ordem entre rodadas. */
function stable(item: AcervoItem): AcervoItem {
  return {
    id: item.id,
    formato: item.formato,
    textoBase: item.textoBase,
    enunciado: item.enunciado,
    alternativas: item.alternativas,
    gabarito: item.gabarito,
    anulado: item.anulado,
    materiaOrigem: item.materiaOrigem,
    temCodigo: item.temCodigo,
    dependeDeFigura: item.dependeDeFigura,
    procedencias: item.procedencias.map((p) => ({
      banca: p.banca, identificador: p.identificador, concurso: p.concurso, ano: p.ano, areas: p.areas, prova: p.prova,
      caderno: p.caderno, numero: p.numero,
    })),
  };
}

const concursoPath = (dir: string, identificador: string) => join(dir, `${identificador}.json`);

export function readConcurso(dir: string, identificador: string): AcervoItem[] {
  const path = concursoPath(dir, identificador);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8')) as AcervoItem[];
}

export function writeConcurso(dir: string, identificador: string, itens: AcervoItem[]): void {
  mkdirSync(dir, { recursive: true });
  const ordered = [...itens].sort((a, b) => byOrigin(firstOrigin(a), firstOrigin(b))).map(stable);
  writeFileSync(concursoPath(dir, identificador), `${JSON.stringify(ordered, null, 2)}\n`);
}
