import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration } from '../lib/timeFormat';

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
});
