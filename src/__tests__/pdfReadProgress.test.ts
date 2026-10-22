import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseReadPages,
  SECONDS_TO_COUNT_PAGE_AS_READ,
  usePageReadTimer,
  withPageRead,
} from '../features/pdf-reader/readProgress';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Leitor de PDF: páginas lidas', () => {
  it('lê o JSON do banco ignorando lixo, repetidos e páginas fora do total', () => {
    expect(parseReadPages('[3, 1, 3, 0, 7, 2.5, "x"]', 5)).toEqual([1, 3]);
    expect(parseReadPages('não é json', 5)).toEqual([]);
    expect(parseReadPages(null, 5)).toEqual([]);
  });

  it('marca e desmarca mantendo a lista ordenada', () => {
    expect(withPageRead([1, 5], 3, true)).toEqual([1, 3, 5]);
    expect(withPageRead([1, 3, 5], 3, false)).toEqual([1, 5]);
  });

  function setup(initialPage: number, focused = true) {
    vi.useFakeTimers();
    vi.spyOn(document, 'hasFocus').mockReturnValue(focused);
    const onPageRead = vi.fn();
    const hook = renderHook((props: { currentPage: number; readPages: number[] }) =>
      usePageReadTimer({ enabled: true, onPageRead, ...props }),
      { initialProps: { currentPage: initialPage, readPages: [] as number[] } }
    );
    const wait = (seconds: number) => act(() => vi.advanceTimersByTime(seconds * 1000));
    return { onPageRead, hook, wait };
  }

  it(`conta a página como lida depois de ${SECONDS_TO_COUNT_PAGE_AS_READ} s na tela, uma vez só`, () => {
    const { onPageRead, wait } = setup(4);
    wait(SECONDS_TO_COUNT_PAGE_AS_READ - 1);
    expect(onPageRead).not.toHaveBeenCalled();
    wait(1);
    expect(onPageRead).toHaveBeenCalledWith(4);
    wait(30);
    expect(onPageRead).toHaveBeenCalledTimes(1);
  });

  it('folhear rápido não marca nada, e o tempo de cada página se acumula', () => {
    const { onPageRead, hook, wait } = setup(1);
    for (let page = 1; page <= 10; page++) {
      hook.rerender({ currentPage: page, readPages: [] });
      wait(2);
    }
    expect(onPageRead).not.toHaveBeenCalled();

    hook.rerender({ currentPage: 1, readPages: [] });
    wait(SECONDS_TO_COUNT_PAGE_AS_READ - 2);
    expect(onPageRead).toHaveBeenCalledWith(1);
  });

  it('não conta com a janela fora de foco', () => {
    const { onPageRead, wait } = setup(2, false);
    wait(60);
    expect(onPageRead).not.toHaveBeenCalled();
  });

  it('página desmarcada à mão não é remarcada sozinha', () => {
    const { onPageRead, hook, wait } = setup(6);
    act(() => hook.result.current.suppress(6));
    wait(60);
    expect(onPageRead).not.toHaveBeenCalled();
  });
});
