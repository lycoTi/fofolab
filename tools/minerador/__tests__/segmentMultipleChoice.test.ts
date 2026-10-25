// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { segmentMultipleChoice } from '../segmentMultipleChoice';
import type { ExtractedItem } from '../types';
import { fixtureLines, PMSC_PROVA } from './fixtures';

describe('Questões de múltipla escolha (PM SC 2023, Oficial)', () => {
  let items: ExtractedItem[];
  const q = (n: number) => items.find((i) => i.numero === n)!;
  beforeAll(async () => {
    items = segmentMultipleChoice(await fixtureLines(PMSC_PROVA));
  });

  it('80 questões, de 1 a 80, cada uma com 5 alternativas', () => {
    expect(items.map((i) => i.numero)).toEqual(Array.from({ length: 80 }, (_, k) => 1 + k));
    expect(items.every((i) => i.formato === 'MULTIPLA_ESCOLHA' && i.alternativas?.length === 5)).toBe(true);
  });

  it('enunciado, alternativas com continuação e matéria de origem', () => {
    expect(q(1).enunciado.replace(/\n/g, ' ')).toBe('No que se refere à segurança pública, é correto afirmar que às polícias');
    expect(q(1).alternativas![0]).toBe('A) militares competem as funções de polícia judiciária da União.');
    expect(q(1).alternativas![1].replace(/\n/g, ' ')).toBe('B) civis competem as funções de polícia judiciária e a apuração de infrações penais comuns e militares.');
    expect(q(1).materiaOrigem).toBe('DIREITO CONSTITUCIONAL');
    expect(q(1).textoBase).toBeNull();
  });

  it('página de uma coluna só (a última) não é cortada ao meio', () => {
    expect(q(79).alternativas![4]).toBe('E) Firefox, compactando-se os arquivos antes de enviar.');
    expect(q(80).textoBase).toBeNull();
    expect(q(80).alternativas![4]).toBe('E) spyware');
    expect(q(80).enunciado).toContain('sem o conhecimento do usuário.');
  });

  it('"A" no começo do texto da alternativa não abre alternativa nova', () => {
    expect(q(3).alternativas![0].startsWith('A) Lei que tipifica')).toBe(true);
    expect(q(3).alternativas![1].startsWith('B) A prática de racismo')).toBe(true);
  });

  it('o texto da prova de Português vai como texto-base das questões que vêm depois dele', () => {
    const withText = items.filter((i) => i.textoBase?.startsWith('Texto 1A9-I'));
    expect(withText.length).toBeGreaterThan(0);
    expect(withText[0].textoBase).toContain('A situação carcerária é uma das questões mais complexas');
    expect(withText[0].materiaOrigem).toBe('LÍNGUA PORTUGUESA');
  });
});
