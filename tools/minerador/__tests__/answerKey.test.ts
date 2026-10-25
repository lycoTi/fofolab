// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GabaritoInvalido, parseAnswerKey } from '../answerKey';
import type { PdfLine } from '../types';
import { fixtureLines, PMSC_GABARITO, SERPRO_GABARITO } from './fixtures';

describe('Gabarito definitivo: grade número → resposta', () => {
  it('SERPRO 2023 (Certo/Errado): itens 51 a 120, X é anulado, posições vazias não contam', async () => {
    const key = parseAnswerKey(await fixtureLines(SERPRO_GABARITO, { singleColumn: true }));
    expect(key.size).toBe(70);
    expect(Math.min(...key.keys())).toBe(51);
    expect(Math.max(...key.keys())).toBe(120);
    expect(key.get(51)).toBe('E');
    expect(key.get(52)).toBe('C');
    expect(key.get(60)).toBe('X');
    expect(key.get(66)).toBe('X');
    expect(key.get(120)).toBe('C');
    expect(key.has(0)).toBe(false);
    expect([...key.values()].filter((v) => v === 'X')).toHaveLength(9);
  });

  it('grade com numeração repetida (línguas estrangeiras 1–10 e 1–10) não é ignorada: o gabarito é inválido', () => {
    const line = (text: string, y: number): PdfLine => ({ page: 1, column: 'L', x: 30, y, text, atMargin: true });
    const lines = [
      line('Item 1 2 3 4 5 1 2 3 4 5', 500),
      line('Gabarito C E C E C E E C C E', 490),
      line('Item 6 7 8 9 10', 480),
      line('Gabarito C C E E C', 470),
    ];
    expect(() => parseAnswerKey(lines)).toThrow(GabaritoInvalido);
    // A grade de zeros do preenchimento continua aceita
    expect(parseAnswerKey([line('Item 1 2', 500), line('Gabarito C E', 490), line('0 0 0 0', 480), line('0 0 0 0', 470)]).size).toBe(2);
  });

  it('PM SC 2023 (múltipla escolha): questões 1 a 80, a 16 anulada', async () => {
    const key = parseAnswerKey(await fixtureLines(PMSC_GABARITO, { singleColumn: true }));
    expect(key.size).toBe(80);
    expect(key.get(1)).toBe('D');
    expect(key.get(16)).toBe('X');
    expect(key.get(80)).toBe('E');
  });
});
