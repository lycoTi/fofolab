// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { readPdfLines } from '../pdfLines';
import type { PdfLine } from '../types';

export const readFixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, '..', '__fixtures__', name)));

describe('Linhas do PDF da prova (SERPRO 2023, específicos)', () => {
  let lines: PdfLine[];
  beforeAll(async () => {
    lines = await readPdfLines(readFixture('846_SERPRO_23_001_01.PDF'));
  });

  it('linha justificada ganha os espaços que o PDF não tem', () => {
    const i = lines.findIndex((l) => l.text.startsWith('51 A integridade é uma propriedade que visa aplicar'));
    expect(i).toBeGreaterThan(-1);
    expect(lines[i].atMargin).toBe(true);
    expect(lines[i + 1].text.startsWith('conhecimentos e habilidades para garantir a assinatura')).toBe(true);
    expect(lines[i + 1].atMargin).toBe(false);
  });

  it('tira o cabeçalho repetido de cada página', () => {
    expect(lines.some((l) => l.text.includes('CEBRASPE – SERPRO – Edital'))).toBe(false);
  });

  it('lê na ordem: texto-base antes do item, coluna da esquerda antes da direita', () => {
    const base = lines.findIndex((l) => l.text.startsWith('Com base na NBR ISO/IEC 27000, julgue os próximos itens, a'));
    const item51 = lines.findIndex((l) => l.text.startsWith('51 '));
    const item65 = lines.findIndex((l) => l.text.startsWith('65 '));
    const item66 = lines.findIndex((l) => l.text.startsWith('66 '));
    expect(base).toBeGreaterThan(-1);
    expect(base).toBeLessThan(item51);
    expect(item51).toBeLessThan(item65);
    expect(item65).toBeLessThan(item66);
  });
});
