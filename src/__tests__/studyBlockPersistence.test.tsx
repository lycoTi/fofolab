import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STUDY_BLOCK_KEY, useStudyBlock } from '../features/study-block/useStudyBlock';

const block = { subjectId: 's1', subjectName: 'Arquitetura', topicId: 't1', topicCode: '2.1', topicTitle: 'Microsserviços', targetMinutes: 60 };
const MIN = 60_000;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 24, 9, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Bloco em andamento sobrevive a recarregar a página', () => {
  it('recarregar no meio do foco volta ao mesmo bloco, com o relógio no ponto certo', () => {
    const first = renderHook(() => useStudyBlock({ ticking: true }));
    act(() => first.result.current.start(block));
    const endsAt = first.result.current.state.phaseEndsAt;
    first.unmount();

    vi.setSystemTime(new Date(2026, 9, 24, 9, 5));
    const second = renderHook(() => useStudyBlock({ ticking: true }));
    expect(second.result.current.state.phase).toBe('FOCUS');
    expect(second.result.current.state.block?.topicId).toBe('t1');
    expect(second.result.current.state.phaseEndsAt).toBe(endsAt);
  });

  it('pomodoro que terminou com a página fechada é gravado quando o banco fica pronto, não antes', () => {
    const first = renderHook(() => useStudyBlock({ ticking: true }));
    act(() => first.result.current.start(block));
    first.unmount();

    vi.setSystemTime(new Date(2026, 9, 24, 10, 0));
    const recorded = vi.fn();
    const second = renderHook(({ ticking }) => useStudyBlock({ ticking }), { initialProps: { ticking: false } });
    second.result.current.onRecordedRef.current = recorded;
    act(() => vi.advanceTimersByTime(2_000));
    expect(recorded).not.toHaveBeenCalled();

    second.rerender({ ticking: true });
    act(() => vi.advanceTimersByTime(1_000));
    expect(recorded).toHaveBeenCalledWith(expect.objectContaining({ subjectId: 's1', topicId: 't1' }));
    // Uma hora depois, a pausa também acabou: o bloco espera o estudante (o foco nunca recomeça sozinho)
    expect(second.result.current.state.phase).toBe('READY');
  });

  it('bloco guardado há mais de 3 horas não volta (ninguém estudou com o app fechado esse tempo todo)', () => {
    const first = renderHook(() => useStudyBlock({ ticking: true }));
    act(() => first.result.current.start(block));
    first.unmount();

    vi.setSystemTime(new Date(2026, 9, 24, 9, 0).getTime() + 3 * 60 * MIN + MIN);
    const second = renderHook(() => useStudyBlock({ ticking: true }));
    expect(second.result.current.state.phase).toBe('IDLE');
    expect(second.result.current.state.block).toBeNull();
  });

  it('bloco concluído ou zerado não fica guardado; guardado estragado é ignorado', () => {
    const first = renderHook(() => useStudyBlock({ ticking: true }));
    act(() => first.result.current.start(block));
    expect(localStorage.getItem(STUDY_BLOCK_KEY)).not.toBeNull();
    act(() => first.result.current.reset());
    expect(localStorage.getItem(STUDY_BLOCK_KEY)).toBeNull();
    first.unmount();

    localStorage.setItem(STUDY_BLOCK_KEY, '{quebrado');
    const second = renderHook(() => useStudyBlock({ ticking: true }));
    expect(second.result.current.state.phase).toBe('IDLE');
  });
});
