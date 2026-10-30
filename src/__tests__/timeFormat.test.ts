import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, formatTimeOfDay } from '../lib/timeFormat';

describe('Tempo sempre em HH:mm', () => {
  it('formata durações em minutos', () => {
    expect(formatDuration(240)).toBe('04:00');
    expect(formatDuration(47)).toBe('00:47');
    expect(formatDuration(1260)).toBe('21:00');
    expect(formatDuration(108.4)).toBe('01:48');
    expect(formatDuration(-5)).toBe('00:00');
  });

  it('formata o relógio da contagem regressiva', () => {
    expect(formatClock(18 * 60_000 + 42_000)).toBe('18:42');
    expect(formatClock(500)).toBe('00:01');
    expect(formatClock(65 * 60_000 + 9_000)).toBe('1:05:09');
  });

  it('formata a hora do dia em HH:mm (relógio local)', () => {
    expect(formatTimeOfDay(new Date(2026, 9, 29, 9, 5))).toBe('09:05');
    expect(formatTimeOfDay(new Date(2026, 9, 29, 16, 18, 59))).toBe('16:18');
    expect(formatTimeOfDay(new Date(2026, 9, 29, 0, 0))).toBe('00:00');
  });

  it('data inválida não vira "NaN:NaN" na tela', () => {
    expect(formatTimeOfDay(new Date(Number.NaN))).toBe('');
  });
});
