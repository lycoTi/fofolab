// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseAnswerKey } from '../answerKey';
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

  it('PM SC 2023 (múltipla escolha): questões 1 a 80, a 16 anulada', async () => {
    const key = parseAnswerKey(await fixtureLines(PMSC_GABARITO, { singleColumn: true }));
    expect(key.size).toBe(80);
    expect(key.get(1)).toBe('D');
    expect(key.get(16)).toBe('X');
    expect(key.get(80)).toBe('E');
  });
});
