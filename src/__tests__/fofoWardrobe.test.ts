import { describe, expect, it } from 'vitest';
import { carnivalWindow, pickOutfit, type OutfitInput } from '../features/mascot/wardrobe';

/** Dia comum (agosto, sem festa), 14:00, na aba Início. */
const plain = (overrides: Partial<OutfitInput> = {}): OutfitInput => ({
  now: new Date(2026, 7, 12, 14, 0),
  tab: 'today',
  examDates: [],
  ...overrides,
});
const at = (year: number, month: number, day: number, hour = 14, minute = 0) => new Date(year, month - 1, day, hour, minute);

describe('Guarda-roupa do Fofo', () => {
  it('num dia comum, cada aba tem a sua roupa e o resto usa a base', () => {
    expect(pickOutfit(plain())).toBe('fofodeck');
    expect(pickOutfit(plain({ tab: 'cycle' }))).toBe('fazendeiro');
    expect(pickOutfit(plain({ tab: 'questions' }))).toBe('explorador');
    expect(pickOutfit(plain({ tab: 'heatmap' }))).toBe('fofodeck');
  });

  it('de 22:00 às 05:00 é o estudante da madrugada, em qualquer aba', () => {
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 22, 0), tab: 'questions' }))).toBe('madrugada');
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 4, 59) }))).toBe('madrugada');
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 5, 0), tab: 'questions' }))).toBe('explorador');
    expect(pickOutfit(plain({ now: at(2026, 8, 12, 21, 59), tab: 'cycle' }))).toBe('fazendeiro');
  });

  it('data especial ganha da hora e da aba, só dentro do seu período', () => {
    expect(pickOutfit(plain({ now: at(2026, 10, 1), tab: 'cycle' }))).toBe('halloween');
    expect(pickOutfit(plain({ now: at(2026, 10, 31, 23, 30), tab: 'questions' }))).toBe('halloween');
    expect(pickOutfit(plain({ now: at(2026, 11, 1) }))).toBe('fofodeck');
    expect(pickOutfit(plain({ now: at(2026, 12, 1) }))).toBe('natal');
    expect(pickOutfit(plain({ now: at(2026, 12, 30) }))).toBe('natal');
    expect(pickOutfit(plain({ now: at(2026, 12, 31) }))).toBe('anonovo');
    expect(pickOutfit(plain({ now: at(2027, 1, 22) }))).toBe('anonovo');
    expect(pickOutfit(plain({ now: at(2026, 6, 1) }))).toBe('junina');
    expect(pickOutfit(plain({ now: at(2026, 6, 30) }))).toBe('junina');
    expect(pickOutfit(plain({ now: at(2026, 7, 1) }))).toBe('fofodeck');
  });

  it('Carnaval vai das 2 semanas antes até a Quarta-feira de Cinzas, calculado pela Páscoa (e ganha do Ano-novo)', () => {
    // Páscoa de 2027: 28/03 → Carnaval de sábado 06/02 a terça 09/02; Cinzas 10/02
    expect(carnivalWindow(2027)).toEqual({ start: '2027-01-23', end: '2027-02-10' });
    // Páscoa de 2026: 05/04 → Cinzas 18/02
    expect(carnivalWindow(2026)).toEqual({ start: '2026-01-31', end: '2026-02-18' });
    expect(pickOutfit(plain({ now: at(2027, 1, 23) }))).toBe('carnaval');
    expect(pickOutfit(plain({ now: at(2027, 2, 10) }))).toBe('carnaval');
    expect(pickOutfit(plain({ now: at(2027, 2, 11) }))).toBe('fofodeck');
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
