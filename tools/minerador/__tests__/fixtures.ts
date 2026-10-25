import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPdfLines } from '../pdfLines';
import type { PdfLine } from '../types';

/** Provas e gabaritos reais da Cebraspe guardados em `__fixtures__` (spec 12 §8). */
export const fixtureBytes = (name: string) => new Uint8Array(readFileSync(join(__dirname, '..', '__fixtures__', name)));
export const fixtureJson = (name: string): unknown => JSON.parse(readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8'));
export const fixtureLines = (name: string, opts: { singleColumn?: boolean } = {}): Promise<PdfLine[]> =>
  readPdfLines(fixtureBytes(name), opts);

export const SERPRO_PROVA = '846_SERPRO_23_001_01.PDF';
export const SERPRO_GABARITO = 'GAB_DEFINITIVO_846_SERPRO_23_001_01.PDF';
export const PMSC_PROVA = '860_PMSC_OFICIAL_OBJ_001_01.PDF';
export const PMSC_GABARITO = 'GAB_DEFINITIVO_860_PMSC_OFICIAL_OBJ_001_01.PDF';
