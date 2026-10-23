import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PEEK_NUDGE_MS, peekKind, usePeek } from '../features/routine/usePeek';
import type { StudyBlockController } from '../features/study-block/useStudyBlock';
import type { BlockState } from '../features/study-block/studyBlockMachine';
import type { Topic } from '../types/database';

const topic = (id: string, parentId: string | null = null) =>
  ({ id, subject_id: 's', code: id, title: id, parent_id: parentId }) as unknown as Topic;

const blockTopic = topic('owasp', 'g22');
const sibling = topic('jwt', 'g22');
const outside = topic('pcasp');

function controller(running: boolean): StudyBlockController {
  const state = {
    phase: 'FOCUS',
    running,
    block: { subjectId: 's', subjectName: 'TI', topicId: 'owasp', topicCode: '2.2.1', topicTitle: 'OWASP', targetMinutes: 60 },
  } as unknown as BlockState;
  return { state, pause: vi.fn(), pauseSilently: vi.fn(), resume: vi.fn() } as unknown as StudyBlockController;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('olhada fora do roteiro', () => {
  it('classifica a olhada: mesmo tópico, irmão ou fora', () => {
    expect(peekKind(blockTopic, blockTopic)).toBe('none');
    expect(peekKind(sibling, blockTopic)).toBe('sibling');
    expect(peekKind(outside, blockTopic)).toBe('outside');
    expect(peekKind(null, blockTopic)).toBe('none');
  });

  it('bloco sem tópico nunca vira olhada', () => {
    expect(peekKind(outside, null)).toBe('none');
  });

  it('entrar na olhada pausa o bloco em foco e voltar retoma', () => {
    const block = controller(true);
    const { result, rerender } = renderHook((props) => usePeek(props), {
      initialProps: { selectedTopic: blockTopic, blockTopic, studyBlock: block },
    });
    rerender({ selectedTopic: outside, blockTopic, studyBlock: block });
    expect(block.pauseSilently).toHaveBeenCalledTimes(1);
    expect(result.current.kind).toBe('outside');
    expect(result.current.pausedByPeek).toBe(true);

    const paused = controller(false);
    rerender({ selectedTopic: outside, blockTopic, studyBlock: paused });
    rerender({ selectedTopic: blockTopic, blockTopic, studyBlock: paused });
    expect(paused.resume).toHaveBeenCalledTimes(1);
    expect(result.current.pausedByPeek).toBe(false);
  });

  it('não retoma um bloco que o estudante já tinha pausado', () => {
    const block = controller(false);
    const { rerender } = renderHook((props) => usePeek(props), {
      initialProps: { selectedTopic: blockTopic, blockTopic, studyBlock: block },
    });
    rerender({ selectedTopic: outside, blockTopic, studyBlock: block });
    rerender({ selectedTopic: blockTopic, blockTopic, studyBlock: block });
    expect(block.pauseSilently).not.toHaveBeenCalled();
    expect(block.resume).not.toHaveBeenCalled();
  });

  it('dica aparece uma vez depois de 3 min de olhada', () => {
    const block = controller(false);
    const { result, rerender } = renderHook((props) => usePeek(props), {
      initialProps: { selectedTopic: outside, blockTopic, studyBlock: block },
    });
    act(() => vi.advanceTimersByTime(PEEK_NUDGE_MS - 1000));
    expect(result.current.showNudge).toBe(false);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.showNudge).toBe(true);

    rerender({ selectedTopic: blockTopic, blockTopic, studyBlock: block });
    expect(result.current.showNudge).toBe(false);
    rerender({ selectedTopic: sibling, blockTopic, studyBlock: block });
    expect(result.current.showNudge).toBe(false);
    act(() => vi.advanceTimersByTime(PEEK_NUDGE_MS));
    expect(result.current.showNudge).toBe(true);
  });
});
