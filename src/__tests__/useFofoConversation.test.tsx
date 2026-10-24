import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AiReply } from '../lib/aiRouter';
import type { FofoContext } from '../lib/fofoia/context';

// A IA responde quando o teste mandar (para simular a resposta chegando depois de uma troca de tópico)
let resolveReply: (r: AiReply) => void = () => {};
vi.mock('../lib/fofoia/ask', () => ({
  askFofoIa: () => new Promise<AiReply>((resolve) => {
    resolveReply = resolve;
  }),
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
