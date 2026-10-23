import { describe, expect, it } from 'vitest';
import { blendMastery, isValidLog } from '../lib/questionLogs';

describe('domínio a partir de questões feitas fora do app', () => {
  it('média ponderada pela evidência: o acerto de agora pesa pelo número de questões', () => {
    expect(blendMastery(40, 10, 14, 20)).toBe(60);
  });
  it('sem evidência anterior vale o acerto puro', () => {
    expect(blendMastery(40, 0, 14, 20)).toBe(70);
  });
  it('o histórico pesa no máximo 40: um registro grande ainda move o domínio', () => {
    expect(blendMastery(90, 500, 0, 40)).toBe(45);
  });
  it('valida os números', () => {
    expect(isValidLog({ total: 20, correct: 14, blank: 2 })).toBe(true);
    expect(isValidLog({ total: 10, correct: 8, blank: 3 })).toBe(false);
    expect(isValidLog({ total: 0, correct: 0, blank: 0 })).toBe(false);
    expect(isValidLog({ total: 501, correct: 0, blank: 0 })).toBe(false);
    expect(isValidLog({ total: 10, correct: -1, blank: 0 })).toBe(false);
    expect(isValidLog({ total: 10.5, correct: 1, blank: 0 })).toBe(false);
  });
});
