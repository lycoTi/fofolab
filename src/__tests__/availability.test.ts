import { describe, expect, it } from 'vitest';
import {
  minutesForDay,
  parseWeekdayMinutes,
  scaleWeekdayMinutes,
  weekBudgetMinutes,
  weekDateKeys,
  weekdayIndex,
  weeklyReviewDay,
  weekReviewDuration,
  type WeekdayMinutes,
} from '../lib/availability';

// Segunda-feira 26/10/2026, meia-noite local
const MONDAY = new Date(2026, 9, 26);
const PATTERN: WeekdayMinutes = [150, 150, 150, 150, 150, 300, 0];

describe('Disponibilidade: minutos de cada dia e da semana (spec 13 §4.1)', () => {
  it('padrão nasce das horas da semana quando não há dias gravados (ou o gravado é inválido)', () => {
    expect(parseWeekdayMinutes(null, 31.5)).toEqual([270, 270, 270, 270, 270, 270, 270]);
    expect(parseWeekdayMinutes('lixo', 14)).toEqual([120, 120, 120, 120, 120, 120, 120]);
    expect(parseWeekdayMinutes('[1,2,3]', 7)).toEqual([60, 60, 60, 60, 60, 60, 60]);
    expect(parseWeekdayMinutes(JSON.stringify(PATTERN), 99)).toEqual(PATTERN);
  });

  it('dias da semana em chave local, começando na segunda', () => {
    expect(weekDateKeys(MONDAY)).toEqual([
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
    ]);
    expect(weekdayIndex('2026-10-26')).toBe(0);
    expect(weekdayIndex('2026-11-01')).toBe(6);
  });

  it('exceção do dia vence o padrão; exceção de outra semana não entra na conta', () => {
    const overrides = { '2026-10-27': 60, '2026-11-03': 0 };
    expect(minutesForDay('2026-10-27', PATTERN, overrides)).toBe(60);
    expect(minutesForDay('2026-10-28', PATTERN, overrides)).toBe(150);
    expect(minutesForDay('2026-11-01', PATTERN, overrides)).toBe(0);
    expect(weekBudgetMinutes(MONDAY, PATTERN, overrides)).toBe(150 * 4 + 60 + 300 + 0);
  });

  it('dia da revisão da semana: o mais longo; no empate, o mais tarde; semana de folga não tem', () => {
    expect(weeklyReviewDay(MONDAY, [120, 120, 120, 120, 120, 300, 300], {})).toBe('2026-11-01');
    expect(weeklyReviewDay(MONDAY, PATTERN, {})).toBe('2026-10-31');
    expect(weeklyReviewDay(MONDAY, [0, 0, 0, 0, 0, 0, 0], {})).toBeNull();
  });

  it('tempo da revisão da semana: 10% da semana, entre 00:30 e 01:30; semana curta não tem', () => {
    expect(weekReviewDuration(1260)).toBe(90);
    expect(weekReviewDuration(600)).toBe(60);
    expect(weekReviewDuration(320)).toBe(30);
    expect(weekReviewDuration(240)).toBe(0);
  });

  it('mudar as horas da semana em outro lugar mantém as folgas e a proporção dos dias', () => {
    // 17:30 → 35:00: cada dia dobra; o domingo de folga continua folga
    expect(scaleWeekdayMinutes(PATTERN, 2100)).toEqual([300, 300, 300, 300, 300, 600, 0]);
    // Padrão todo de folga não tem proporção: o tempo se divide pelos 7 dias
    expect(scaleWeekdayMinutes([0, 0, 0, 0, 0, 0, 0], 420)).toEqual([60, 60, 60, 60, 60, 60, 60]);
  });
});
