import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestionsView } from '../lib/acervo/topicQuestions';
import type { Question, Topic } from '../types/database';

const ACERVO = { fake: 'acervo' };
const linked = new Set<string>();
const calls = {
  open: vi.fn(async () => ACERVO),
  view: vi.fn((input: { topicId: string; acervo: unknown }): QuestionsView => {
    const own = [{ question: { id: `own-${input.topicId}` } as Question, dissection: null, attemptSummary: null }];
    const fromAcervo = input.acervo ? [{ question: { id: `acv-${input.topicId}` } as Question, dissection: null, attemptSummary: null }] : [];
    return { items: [...own, ...fromAcervo], links: [], excluded: [], groupCode: null, acervoMissing: input.acervo === null && linked.has(input.topicId) };
  }),
};

vi.mock('../lib/acervo/acervoStore', () => ({ openAcervo: () => calls.open() }));
vi.mock('../lib/acervo/topicQuestions', () => ({
  scopeTopicIds: (input: { topicId: string }) => [input.topicId],
  hasActiveLinks: (ids: string[]) => ids.some((id) => linked.has(id)),
  getQuestionsView: (input: { topicId: string; acervo: unknown }) => calls.view(input),
  countNonAnnulledQuestions: (items: { question: Question }[]) => items.filter((i) => i.question.is_annulled !== 1).length,
}));

const { useTopicQuestions, useTopicQuestionCount } = await import('../features/acervo/useTopicQuestions');

const base = { ready: true, planId: 'p1', subjectId: 's1', scope: 'topic' as const, version: 0 };

describe('Questões do tópico na tela (acervo aberto sob demanda)', () => {
  beforeEach(() => {
    linked.clear();
    calls.open.mockClear();
    calls.view.mockClear();
  });

  it('tópico sem ligação não abre o acervo', async () => {
    const { result } = renderHook(() => useTopicQuestions({ ...base, topicId: 't1' }));
    await waitFor(() => expect(result.current.items.map((i) => i.question.id)).toEqual(['own-t1']));
    expect(calls.open).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('tópico com ligação: mostra as próprias enquanto abre, depois os itens do acervo', async () => {
    linked.add('t2');
    const { result } = renderHook(() => useTopicQuestions({ ...base, topicId: 't2' }));
    expect(result.current.loading).toBe(true);
    expect(result.current.acervoMissing).toBe(false);
    await waitFor(() => expect(result.current.items.map((i) => i.question.id)).toEqual(['own-t2', 'acv-t2']));
    expect(result.current.loading).toBe(false);
    expect(calls.view).toHaveBeenLastCalledWith(expect.objectContaining({ topicId: 't2', acervo: ACERVO }));
  });

  it('acervo que não está neste computador: avisa e fica com as próprias', async () => {
    linked.add('t3');
    calls.open.mockResolvedValueOnce(null as never);
    const { result } = renderHook(() => useTopicQuestions({ ...base, topicId: 't3' }));
    await waitFor(() => expect(result.current.acervoMissing).toBe(true));
    expect(result.current.items.map((i) => i.question.id)).toEqual(['own-t3']);
  });

  it('banco ainda não pronto: lista vazia e nada é consultado', () => {
    const { result } = renderHook(() => useTopicQuestions({ ...base, ready: false, topicId: 't1' }));
    expect(result.current.items).toEqual([]);
    expect(calls.view).not.toHaveBeenCalled();
  });

  it('contagem do bloco = só as do próprio tópico', async () => {
    linked.add('t4');
    const topic = { id: 't4', subject_id: 's1' } as Topic;
    const { result } = renderHook(() => useTopicQuestionCount({ ready: true, topic, version: 0 }));
    await waitFor(() => expect(result.current).toBe(2));
    expect(calls.view).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'topic', topicId: 't4' }));
  });
});
