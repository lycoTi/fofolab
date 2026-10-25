import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AiReply } from '../lib/aiRouter';
import type { FofoContext } from '../lib/fofoia/context';

// A IA responde quando o teste mandar (para simular a resposta chegando depois de uma troca de tópico)
let resolveReply: (r: AiReply) => void = () => {};
let askCalls = 0;
vi.mock('../lib/fofoia/ask', () => ({
  askFofoIa: () => {
    askCalls += 1;
    return new Promise<AiReply>((resolve) => {
      resolveReply = resolve;
    });
  },
}));

const { useFofoConversation } = await import('../features/fofoia/useFofoConversation');

const ctx = { student: { currentTopicMastery: 60 }, notebookExcerpt: null, activeQuestion: null, prerequisites: [] } as unknown as FofoContext;
const base = { topicMastery: 60, firstContact: false, activeQuestion: null };

describe('Conversa da FofoIA: respostas fora de hora', () => {
  it('resposta que chega depois da troca de tópico é descartada (não cai na conversa nova)', async () => {
    const { result, rerender } = renderHook((p: { key: string }) =>
      useFofoConversation({ topicKey: p.key, topicLabel: p.key, ctx, baseSignals: base, editalTopics: [] }), { initialProps: { key: 'A' } });
    act(() => {
      void result.current.send('resumo de A');
    });
    rerender({ key: 'B' });
    await act(async () => {
      resolveReply({ reply: 'Resumo do tópico A', provider: 'OFFLINE_DEMO', simulated: true });
    });
    expect(result.current.turns.map((t) => t.content)).toEqual(['Nova conversa sobre B.']);
    expect(result.current.loading).toBe(false);
  });
});

describe('Conversa da FofoIA: cumprimento sem IA', () => {
  it('"oi" é respondido pelo app, sem jeito nem botões de resumo, e não conta como pergunta', async () => {
    askCalls = 0;
    const { result } = renderHook(() => useFofoConversation({ topicKey: 'A', topicLabel: '1.1 Microsserviços', ctx, baseSignals: base, editalTopics: [] }));
    await act(async () => {
      await result.current.send('oi');
    });
    expect(askCalls).toBe(0);
    expect(result.current.loading).toBe(false);
    const [student, tutor] = result.current.turns;
    expect(student.content).toBe('oi');
    expect(tutor.role).toBe('tutor');
    expect(tutor.mode).toBeUndefined();
    expect(tutor.content).toContain('1.1 Microsserviços');
    // A pergunta seguinte vai para a IA
    act(() => {
      void result.current.send('o que é orquestração?');
    });
    expect(askCalls).toBe(1);
  });
});
