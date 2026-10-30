import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrentFofo, FofoOutfitProvider, useFofoOutfit } from '../features/mascot/FofoOutfitContext';
import { FOFO_PREFS_KEY, useFofoPrefs } from '../features/mascot/useFofoPrefs';

afterEach(() => {
  vi.useRealTimers();
});

describe('Roupa do Fofo no app', () => {
  it('quem mostra o Fofo veste a roupa que o app escolheu; no FofoDoro, a do FofoDoro; sem escolha, a base', () => {
    const { unmount } = render(
      <FofoOutfitProvider value={{ app: 'natal', fofodoro: 'fofodeck', focus: false }}>
        <CurrentFofo />
        <CurrentFofo place="fofodoro" />
      </FofoOutfitProvider>,
    );
    expect(screen.getByRole('img', { name: 'Fofo de Natal' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Fofo' })).toBeTruthy();
    unmount();

    render(<CurrentFofo />);
    expect(screen.getByRole('img', { name: 'Fofo' })).toBeTruthy();
  });

  it('se mexe o tempo todo, menos durante um bloco de foco, quando só pisca', () => {
    const { rerender } = render(
      <FofoOutfitProvider value={{ app: 'fazendeiro', fofodoro: 'fofodeck', focus: false }}>
        <CurrentFofo />
      </FofoOutfitProvider>,
    );
    expect(screen.getByRole('img').getAttribute('data-motion')).toBe('full');
    rerender(
      <FofoOutfitProvider value={{ app: 'fazendeiro', fofodoro: 'fofodeck', focus: true }}>
        <CurrentFofo />
      </FofoOutfitProvider>,
    );
    expect(screen.getByRole('img').getAttribute('data-motion')).toBe('blink');
  });

  it('em pausa (do FofoDoro ou apertada pelo estudante), o Fofo do cabeçalho cochila; os outros não', () => {
    render(
      <FofoOutfitProvider value={{ app: 'fazendeiro', fofodoro: 'fofodeck', focus: false, resting: true }}>
        <CurrentFofo sleepWhenResting />
        <CurrentFofo />
      </FofoOutfitProvider>,
    );
    const [header, other] = screen.getAllByRole('img');
    expect(header.getAttribute('data-pose')).toBe('dormindo');
    expect(other.getAttribute('data-pose')).toBeNull();
  });

  it('troca sozinha quando o relógio passa das 22:00', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12, 21, 59, 30));
    const { result } = renderHook(() => useFofoOutfit({ examDates: [] }));
    expect(result.current.app).toBe('explorador');

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.app).toBe('madrugada');
    expect(result.current.fofodoro).toBe('fofodeck');
  });

  it('entrega a hora e o sol do mesmo relógio que troca a roupa, para a janela do Fofo não ter outro timer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12, 21, 59, 30));
    const { result } = renderHook(() => useFofoOutfit({ examDates: [] }));
    expect(result.current.now.getTime()).toBe(new Date(2026, 7, 12, 21, 59, 30).getTime());
    // O sol depende do fuso de quem roda: ou é desconhecido, ou é o de hoje
    const { sun } = result.current;
    if (sun) expect(sun.sunrise.getDate()).toBe(12);
    else expect(sun).toBeNull();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.now.getTime()).toBe(new Date(2026, 7, 12, 22, 0, 30).getTime());
  });

  it('o sol mantém a mesma referência durante o dia, para efeitos que dependem dele não rodarem a cada minuto', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12, 10, 0));
    const { result } = renderHook(() => useFofoOutfit({ examDates: [] }));
    const first = result.current.sun;
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.sun).toBe(first);
  });

  it('a data da prova cadastrada veste a roupa da prova; roupa fixa ganha, mas a automática continua calculada', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 6, 8, 0));
    const { result } = renderHook(() => useFofoOutfit({ examDates: ['2026-12-06'], fixedOutfit: 'junina' }));
    expect(result.current.app).toBe('junina');
    expect(result.current.automatic).toBe('prova');
  });
});

describe('Guarda-roupa guardado neste computador', () => {
  const plan = { id: 'p1', exam_date: '2027-03-14' };
  beforeEach(() => window.localStorage.clear());

  it('a roupa fixa volta depois de fechar e abrir o app; valor estranho no arquivo vira automática', () => {
    const first = renderHook(() => useFofoPrefs(plan));
    act(() => first.result.current.setFixedOutfit('natal'));
    first.unmount();
    expect(renderHook(() => useFofoPrefs(plan)).result.current.fixedOutfit).toBe('natal');

    window.localStorage.setItem(FOFO_PREFS_KEY, JSON.stringify({ fixedOutfit: 'roupa-que-nao-existe' }));
    expect(renderHook(() => useFofoPrefs(plan)).result.current.fixedOutfit).toBeNull();
  });

  it('nomeado vale para o plano e a data de prova de quando foi marcado; prova nova volta ao normal', () => {
    const { result, rerender } = renderHook((p: { plan: { id: string; exam_date: string | null } }) => useFofoPrefs(p.plan), {
      initialProps: { plan },
    });
    act(() => result.current.setAppointed(true));
    expect(result.current.appointed).toBe(true);
    rerender({ plan: { id: 'p1', exam_date: '2027-09-01' } });
    expect(result.current.appointed).toBe(false);
    rerender({ plan: { id: 'p2', exam_date: '2027-03-14' } });
    expect(result.current.appointed).toBe(false);
    rerender({ plan });
    act(() => result.current.setAppointed(false));
    expect(result.current.appointed).toBe(false);
  });
});
