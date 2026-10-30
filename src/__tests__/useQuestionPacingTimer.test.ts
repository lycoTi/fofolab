import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuestionPacingTimer, type UseQuestionPacingTimerOptions } from '../features/questions/useQuestionPacingTimer';

describe('useQuestionPacingTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não corre automaticamente se blockRunning for false (modo livre sem bloco ativo)', () => {
    const { result } = renderHook(() =>
      useQuestionPacingTimer({
        questionId: 'q-1',
        locked: false,
        blockRunning: false,
      })
    );

    expect(result.current.seconds).toBe(0);
    expect(result.current.formatted).toBe('00:00');
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isWaitingBlock).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Continua zerado e parado
    expect(result.current.seconds).toBe(0);
  });

  it('corre automaticamente quando blockRunning for true', () => {
    const { result } = renderHook(() =>
      useQuestionPacingTimer({
        questionId: 'q-1',
        locked: false,
        blockRunning: true,
      })
    );

    expect(result.current.isRunning).toBe(true);
    expect(result.current.isWaitingBlock).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.seconds).toBe(2);
    expect(result.current.formatted).toBe('00:02');
  });

  it('pausa quando o bloco de foco para e retoma quando o bloco volta', () => {
    const { result, rerender } = renderHook(
      (props: UseQuestionPacingTimerOptions) => useQuestionPacingTimer(props),
      {
        initialProps: {
          questionId: 'q-1',
          locked: false,
          blockRunning: true,
        },
      }
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.seconds).toBe(10);

    // Bloco de foco pausado pelo estudante no FofoDoro
    rerender({ questionId: 'q-1', locked: false, blockRunning: false });
    expect(result.current.isRunning).toBe(false);

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.seconds).toBe(10); // não avançou

    // Bloco retomado
    rerender({ questionId: 'q-1', locked: false, blockRunning: true });
    expect(result.current.isRunning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.seconds).toBe(15);
  });

  it('permite play manual mesmo fora de bloco e pausa manual durante bloco', () => {
    const { result } = renderHook(() =>
      useQuestionPacingTimer({
        questionId: 'q-1',
        locked: false,
        blockRunning: false,
      })
    );

    expect(result.current.isRunning).toBe(false);

    // Estudante dá play manual na questão avulsa
    act(() => {
      result.current.togglePlayPause();
    });
    expect(result.current.isRunning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.seconds).toBe(3);

    // Estudante pausa manualmente
    act(() => {
      result.current.togglePlayPause();
    });
    expect(result.current.isRunning).toBe(false);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.seconds).toBe(3);
  });

  it('pausa automaticamente quando a aba fica oculta (visibilityState) e retoma ao voltar', () => {
    const { result } = renderHook(() =>
      useQuestionPacingTimer({
        questionId: 'q-1',
        locked: false,
        blockRunning: true,
      })
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.seconds).toBe(5);

    // Simula troca de aba (document.visibilityState = 'hidden')
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.isTabHidden).toBe(true);
    expect(result.current.isRunning).toBe(false);

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.seconds).toBe(5);

    // Volta para a aba
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.isTabHidden).toBe(false);
    expect(result.current.isRunning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.seconds).toBe(7);
  });

  it('pausa por inatividade após 60s sem interação e retoma no movimento do mouse', () => {
    const { result } = renderHook(() =>
      useQuestionPacingTimer({
        questionId: 'q-1',
        locked: false,
        blockRunning: true,
        idleTimeoutMs: 60000,
      })
    );

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(result.current.seconds).toBe(30);
    expect(result.current.isIdle).toBe(false);

    // Passam mais 31s sem nenhum evento (total 61s de inatividade)
    act(() => {
      vi.advanceTimersByTime(31000);
    });
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isRunning).toBe(false);

    // Tempo não deve avançar enquanto ausente
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(result.current.seconds).toBe(59);

    // Usuário mexe o mouse
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'));
    });
    expect(result.current.isIdle).toBe(false);
    expect(result.current.isRunning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.seconds).toBe(64);
  });

  it('muda para tom warning aos 120s e extended aos 180s', () => {
    const { result } = renderHook(() =>
      useQuestionPacingTimer({
        questionId: 'q-1',
        locked: false,
        blockRunning: true,
        idleTimeoutMs: 300_000,
      })
    );

    act(() => {
      vi.advanceTimersByTime(120000);
    });
    expect(result.current.tone).toBe('warning');

    act(() => {
      vi.advanceTimersByTime(61000);
    });
    expect(result.current.tone).toBe('extended');
  });

  it('congela a contagem quando a questão é respondida (locked vira true)', () => {
    const { result, rerender } = renderHook(
      (props: UseQuestionPacingTimerOptions) => useQuestionPacingTimer(props),
      {
        initialProps: {
          questionId: 'q-1',
          locked: false,
          blockRunning: true,
        },
      }
    );

    act(() => {
      vi.advanceTimersByTime(40000);
    });
    expect(result.current.seconds).toBe(40);

    rerender({ questionId: 'q-1', locked: true, blockRunning: true });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.seconds).toBe(40);

    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(result.current.seconds).toBe(40);
  });

  it('exibe frozenSeconds se a questão já estiver travada ao carregar', () => {
    const { result } = renderHook(() =>
      useQuestionPacingTimer({
        questionId: 'q-done',
        locked: true,
        frozenSeconds: 85,
        blockRunning: true,
      })
    );

    expect(result.current.seconds).toBe(85);
    expect(result.current.formatted).toBe('01:25');
    expect(result.current.isRunning).toBe(false);
  });
});
