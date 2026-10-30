import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearAllHighlights,
  loadHighlights,
  mergeHighlights,
  removeHighlightAt,
  saveHighlights,
  splitTextByHighlights,
  type HighlightRange,
} from '../features/questions/questionHighlights';

describe('Grifos no enunciado da questão (questionHighlights)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('salva e recupera grifos por questão no localStorage', () => {
    const qId = 'q-101';
    expect(loadHighlights(qId)).toEqual([]);

    const ranges: HighlightRange[] = [{ start: 5, end: 15 }];
    saveHighlights(qId, ranges);
    expect(loadHighlights(qId)).toEqual(ranges);

    clearAllHighlights(qId);
    expect(loadHighlights(qId)).toEqual([]);
  });

  it('adiciona novo grifo ordenado e sem sobreposição', () => {
    const initial: HighlightRange[] = [{ start: 10, end: 20 }];
    // Novo grifo antes
    const withBefore = mergeHighlights(initial, { start: 0, end: 5 });
    expect(withBefore).toEqual([
      { start: 0, end: 5 },
      { start: 10, end: 20 },
    ]);

    // Novo grifo depois
    const withAfter = mergeHighlights(withBefore, { start: 25, end: 30 });
    expect(withAfter).toEqual([
      { start: 0, end: 5 },
      { start: 10, end: 20 },
      { start: 25, end: 30 },
    ]);
  });

  it('mescla intervalos sobrepostos ou adjacentes', () => {
    const initial: HighlightRange[] = [
      { start: 10, end: 20 },
      { start: 30, end: 40 },
    ];
    // Grifo que conecta e sobrepõe os dois
    const merged = mergeHighlights(initial, { start: 15, end: 35 });
    expect(merged).toEqual([{ start: 10, end: 40 }]);
  });

  it('remove intervalo pelo índice', () => {
    const list: HighlightRange[] = [
      { start: 0, end: 5 },
      { start: 10, end: 15 },
      { start: 20, end: 25 },
    ];
    const after = removeHighlightAt(list, 1);
    expect(after).toEqual([
      { start: 0, end: 5 },
      { start: 20, end: 25 },
    ]);
  });

  it('divide o texto do enunciado em segmentos normais e grifados', () => {
    const text = 'A confidencialidade de dados no Judiciário pode ser garantida por criptografia.';
    const startCripto = text.indexOf('criptografia');
    const ranges: HighlightRange[] = [
      { start: 2, end: 19 },
      { start: startCripto, end: startCripto + 'criptografia'.length },
    ];

    const segments = splitTextByHighlights(text, ranges);
    expect(segments).toEqual([
      { text: 'A ', isHighlight: false },
      { text: 'confidencialidade', isHighlight: true, index: 0 },
      { text: ' de dados no Judiciário pode ser garantida por ', isHighlight: false },
      { text: 'criptografia', isHighlight: true, index: 1 },
      { text: '.', isHighlight: false },
    ]);
  });
});
