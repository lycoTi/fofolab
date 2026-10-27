import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiReply } from '../lib/aiRouter';
import type { FofoContext } from '../lib/fofoia/context';

// A IA responde quando o teste mandar (para simular a resposta chegando depois de uma troca de tópico)
let resolveReply: (r: AiReply) => void = () => {};
let askCalls = 0;
let lastAsk: { mode: string; extra?: { resumeAfter?: string } } | null = null;
vi.mock('../lib/fofoia/ask', () => ({
  askFofoIa: (input: { mode: string; extra?: { resumeAfter?: string } }) => {
    askCalls += 1;
    lastAsk = input;
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

describe('Conversa da FofoIA: resposta cortada no teto de tamanho', () => {
  it('marca a resposta cortada; continuar de onde parou manda o final e mantém a parte da aula', async () => {
    const { result } = renderHook(() => useFofoConversation({ topicKey: 'C', topicLabel: 'C', ctx, baseSignals: base, editalTopics: [] }));
    act(() => {
      void result.current.send('Aula completa sobre C.', 'LESSON');
    });
    await act(async () => {
      resolveReply({ reply: 'Parte 1 de 3\n\nO mesh externaliza políticas.', provider: 'GROQ_FREE', simulated: false, cut: true });
    });
    const cut = result.current.turns[1];
    expect(cut.cut).toBe(true);
    expect(cut.part).toEqual({ n: 1, total: 3 });

    act(() => {
      void result.current.resume(cut);
    });
    expect(lastAsk?.mode).toBe('LESSON');
    expect(lastAsk?.extra?.resumeAfter).toContain('O mesh externaliza políticas.');
    await act(async () => {
      resolveReply({ reply: 'E também cuida do mTLS.', provider: 'GROQ_FREE', simulated: false });
    });
    const rest = result.current.turns[result.current.turns.length - 1];
    expect(rest.content).toBe('E também cuida do mTLS.');
    expect(rest.cut).toBeUndefined();
    expect(rest.part).toEqual({ n: 1, total: 3 });
  });
});

describe('Conversa da FofoIA: sobrevive a recarregar a página por 20 minutos', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 26, 20, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function talk(topicKey: string) {
    const hook = renderHook(() => useFofoConversation({ topicKey, topicLabel: topicKey, ctx, baseSignals: base, editalTopics: [] }));
    act(() => {
      void hook.result.current.send('o que é service mesh?');
    });
    await act(async () => {
      resolveReply({ reply: 'É a camada que cuida da comunicação entre serviços.', provider: 'GROQ_FREE', simulated: false });
    });
    hook.unmount();
  }
  const reopen = (topicKey: string) =>
    renderHook(() => useFofoConversation({ topicKey, topicLabel: topicKey, ctx, baseSignals: base, editalTopics: [] })).result.current.turns;

  it('reabrir no mesmo tópico, até 20 minutos depois, traz a conversa de volta', async () => {
    await talk('D');
    vi.setSystemTime(new Date(2026, 9, 26, 20, 19));
    expect(reopen('D').map((t) => t.content)).toEqual(['o que é service mesh?', 'É a camada que cuida da comunicação entre serviços.']);
  });

  it('ao recarregar, o painel pode abrir num tópico e só depois ir para o do bloco: a conversa volta mesmo assim', async () => {
    await talk('G');
    const { result, rerender } = renderHook((p: { key: string }) =>
      useFofoConversation({ topicKey: p.key, topicLabel: p.key, ctx, baseSignals: base, editalTopics: [] }), { initialProps: { key: 'primeiro-da-lista' } });
    expect(result.current.turns).toEqual([]);
    rerender({ key: 'G' });
    expect(result.current.turns.map((t) => t.content)).toEqual(['o que é service mesh?', 'É a camada que cuida da comunicação entre serviços.']);
  });

  it('depois de 20 minutos, ou em outro tópico, começa do zero', async () => {
    await talk('E');
    expect(reopen('F')).toEqual([]);
    vi.setSystemTime(new Date(2026, 9, 26, 20, 21));
    expect(reopen('E')).toEqual([]);
  });
});
