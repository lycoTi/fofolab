import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CurrentFofo, FofoOutfitProvider, useFofoOutfit } from '../features/mascot/FofoOutfitContext';

afterEach(() => {
  vi.useRealTimers();
});

describe('Roupa do Fofo no app', () => {
  it('quem mostra o Fofo veste a roupa que o app escolheu; sem escolha, a base', () => {
    const { unmount } = render(
      <FofoOutfitProvider outfit="natal">
        <CurrentFofo />
      </FofoOutfitProvider>,
    );
    expect(screen.getByRole('img', { name: 'Fofo de Natal' })).toBeTruthy();
    unmount();

    render(<CurrentFofo />);
    expect(screen.getByRole('img', { name: 'Fofo' })).toBeTruthy();
  });

  it('troca sozinha quando o relógio passa das 22:00, sem precisar mudar de aba', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12, 21, 59, 30));
    const { result } = renderHook(() => useFofoOutfit('questions', []));
    expect(result.current).toBe('explorador');

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe('madrugada');
  });

  it('a data da prova cadastrada veste a roupa da prova', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 6, 8, 0));
    const { result } = renderHook(() => useFofoOutfit('today', ['2026-12-06']));
    expect(result.current).toBe('prova');
  });
});
