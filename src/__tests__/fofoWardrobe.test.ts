import { describe, expect, it } from 'vitest';
import { coordsForTimeZone, sunTimes } from '../features/mascot/sun';
import { carnivalWindow, pickOutfit, type OutfitInput } from '../features/mascot/wardrobe';

const at = (year: number, month: number, day: number, hour = 14, minute = 0) => new Date(year, month - 1, day, hour, minute);
/** Sol do dia de `now`: nasce 05:30 e se põe 18:10 (horário local). */
const sunOf = (now: Date) => ({
  sunrise: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 30),
  sunset: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 10),
});
/** Dia comum (agosto, sem festa), 14:00. */
const plain = (overrides: Partial<OutfitInput> = {}): OutfitInput => {
  const now = overrides.now ?? at(2026, 8, 12);
  return { now, examDates: [], sun: sunOf(now), ...overrides };
};

describe('Guarda-roupa do Fofo: o dia pelo sol', () => {
  it('fazendeiro do nascer ao pôr do sol, explorador do pôr do sol às 22:00, madrugada das 22:00 ao nascer do sol', () => {
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 5, 29) }))).toBe('madrugada');
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 5, 30) }))).toBe('fazendeiro');
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 14, 0) }))).toBe('fazendeiro');
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 18, 10) }))).toBe('explorador');
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 21, 59) }))).toBe('explorador');
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 22, 0) }))).toBe('madrugada');
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 3, 0) }))).toBe('madrugada');
  });

  it('sem saber o sol (fuso desconhecido), vale 06:00 e 18:00', () => {
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 5, 59), sun: null }))).toBe('madrugada');
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 6, 0), sun: null }))).toBe('fazendeiro');
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 18, 0), sun: null }))).toBe('explorador');
  });

  it('no FofoDoro é o Fofo do relógio, a não ser em festa, marco ou roupa fixa', () => {
    expect(pickOutfit(plain({ place: 'fofodoro' }))).toBe('fofodeck');
    expect(pickOutfit(plain({ place: 'fofodoro', now: at(2026, 8, 12, 23, 0) }))).toBe('fofodeck');
    expect(pickOutfit(plain({ place: 'fofodoro', now: at(2026, 10, 20) }))).toBe('halloween');
    expect(pickOutfit(plain({ place: 'fofodoro', fixedOutfit: 'junina' }))).toBe('junina');
  });

  it('o sol de São Paulo em 26/10/2026: nasce perto de 05:20 e se põe perto de 18:15 (horário de Brasília)', () => {
    const coords = coordsForTimeZone('America/Sao_Paulo');
    expect(coords).not.toBeNull();
    const sun = sunTimes(new Date(Date.UTC(2026, 9, 26, 15, 0)), coords!.lat, coords!.lon)!;
    const brasilia = (d: Date) => (d.getUTCHours() - 3) * 60 + d.getUTCMinutes();
    expect(Math.abs(brasilia(sun.sunrise) - (5 * 60 + 20))).toBeLessThanOrEqual(15);
    expect(Math.abs(brasilia(sun.sunset) - (18 * 60 + 15))).toBeLessThanOrEqual(15);
    expect(coordsForTimeZone('Fuso/Inventado')).toBeNull();
  });
});

describe('Guarda-roupa do Fofo: festas e marcos', () => {
  it('data especial ganha da hora do dia, só dentro do seu período', () => {
    expect(pickOutfit(plain({ now: at(2026, 10, 1) }))).toBe('halloween');
    expect(pickOutfit(plain({ now: at(2026, 10, 31, 23, 30) }))).toBe('halloween');
    expect(pickOutfit(plain({ now: at(2026, 11, 1) }))).toBe('fazendeiro');
    expect(pickOutfit(plain({ now: at(2026, 12, 1) }))).toBe('natal');
    expect(pickOutfit(plain({ now: at(2026, 12, 30) }))).toBe('natal');
    expect(pickOutfit(plain({ now: at(2026, 12, 31) }))).toBe('anonovo');
    expect(pickOutfit(plain({ now: at(2027, 1, 22) }))).toBe('anonovo');
    expect(pickOutfit(plain({ now: at(2026, 6, 1) }))).toBe('junina');
    expect(pickOutfit(plain({ now: at(2026, 6, 30) }))).toBe('junina');
    expect(pickOutfit(plain({ now: at(2026, 7, 1) }))).toBe('fazendeiro');
  });

  it('Carnaval vai das 2 semanas antes até a Quarta-feira de Cinzas, calculado pela Páscoa (e ganha do Ano-novo)', () => {
    // Páscoa de 2027: 28/03 → Carnaval de sábado 06/02 a terça 09/02; Cinzas 10/02
    expect(carnivalWindow(2027)).toEqual({ start: '2027-01-23', end: '2027-02-10' });
    // Páscoa de 2026: 05/04 → Cinzas 18/02
    expect(carnivalWindow(2026)).toEqual({ start: '2026-01-31', end: '2026-02-18' });
    expect(pickOutfit(plain({ now: at(2027, 1, 23) }))).toBe('carnaval');
    expect(pickOutfit(plain({ now: at(2027, 2, 10) }))).toBe('carnaval');
    expect(pickOutfit(plain({ now: at(2027, 2, 11) }))).toBe('fazendeiro');
  });

  it('no dia da prova cadastrada, a roupa da prova passa na frente das festas', () => {
    expect(pickOutfit(plain({ now: at(2026, 12, 6, 7, 0), examDates: ['2026-12-06'] }))).toBe('prova');
    expect(pickOutfit(plain({ now: at(2026, 12, 7), examDates: ['2026-12-06'] }))).toBe('natal');
  });

  it('nomeado fica até ser desligado e só perde para o dia de uma prova nova', () => {
    expect(pickOutfit(plain({ now: at(2026, 12, 20), appointed: true }))).toBe('nomeado');
    expect(pickOutfit(plain({ now: at(2027, 3, 14), appointed: true, examDates: ['2027-03-14'] }))).toBe('prova');
  });

  it('roupa fixa escolhida pelo estudante passa na frente de todas as regras', () => {
    expect(pickOutfit(plain({ now: at(2026, 12, 6), examDates: ['2026-12-06'], appointed: true, fixedOutfit: 'explorador' }))).toBe('explorador');
  });
});
