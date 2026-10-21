import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEED_QUESTIONS } from '../data/initialSeed';
import {
  askReverseStudyTutor,
  buildReverseStudyPrompt,
  escapeXml,
  generateQuestionDissection,
  getAiStatus,
  parseDissectionResponse,
} from '../lib/aiRouter';

const question = SEED_QUESTIONS[0];

function stubNoAi() {
  vi.stubEnv('VITE_FOFOLAB_AI_GATEWAY_URL', '');
  vi.stubEnv('VITE_GEMINI_API_KEY', '');
  vi.stubEnv('VITE_DEEPSEEK_API_KEY', '');
}

function geminiResponse(text: string) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Roteador de IA: modo demonstração honesto, grounding e explicação guardada', () => {
  it('detecta quais provedores estão configurados', () => {
    stubNoAi();
    expect(getAiStatus()).toEqual({ configured: false, providers: [] });

    vi.stubEnv('VITE_GEMINI_API_KEY', 'chave-teste');
    expect(getAiStatus()).toEqual({ configured: true, providers: ['GEMINI_FREE'] });
  });

  it('o prompt do tutor leva gabarito definitivo, eliminação contrastiva e regra de abstenção', () => {
    const prompt = buildReverseStudyPrompt({ question, dissection: null, promptText: 'Qual a pegadinha?' });
    expect(prompt).toContain(`<gabarito_definitivo>${question.final_answer}</gabarito_definitivo>`);
    expect(prompt).toContain('Eliminação contrastiva');
    expect(prompt).toContain('NUNCA invente');
    expect(prompt).toContain('Inversão Conceitual');
  });

  it('escapa o contexto enviado à IA (aspas e < > em títulos não quebram o prompt)', () => {
    expect(escapeXml('Lei "A" <B> & C')).toBe('Lei &quot;A&quot; &lt;B&gt; &amp; C');
  });

  it('com chave configurada usa a IA real, sem marcar como simulação', async () => {
    stubNoAi();
    vi.stubEnv('VITE_GEMINI_API_KEY', 'chave-teste');
    const fetchMock = vi.fn(async () => geminiResponse('Resposta real da IA'));
    vi.stubGlobal('fetch', fetchMock);

    const reply = await askReverseStudyTutor({ question, dissection: null, promptText: 'Explique' });

    expect(reply).toEqual({ reply: 'Resposta real da IA', provider: 'GEMINI_FREE', simulated: false });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0].text).toContain('NUNCA invente');
  });

  it('se a IA configurada falhar, avisa que não respondeu (sem inventar um exemplo)', async () => {
    stubNoAi();
    vi.stubEnv('VITE_GEMINI_API_KEY', 'chave-teste');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('erro', { status: 500 })));

    const reply = await askReverseStudyTutor({ question, dissection: null, promptText: 'Explique' });
    expect(reply.failed).toBe(true);
    expect(reply.simulated).toBe(false);
    expect(reply.reply).toMatch(/Não consegui falar com a IA/);
  });

  it('gera a explicação-base em JSON (aceitando cercas de código) e recusa formato inválido', async () => {
    expect(
      parseDissectionResponse('```json\n{"explicacao_markdown": "Porque C.", "pre_requisitos": ["ISSAI 100"]}\n```')
    ).toEqual({ dissectionMarkdown: 'Porque C.', prerequisites: ['ISSAI 100'] });
    expect(parseDissectionResponse('não sou json')).toBeNull();

    stubNoAi();
    expect(await generateQuestionDissection(question)).toEqual({ status: 'not-configured' });

    vi.stubEnv('VITE_GEMINI_API_KEY', 'chave-teste');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => geminiResponse('{"explicacao_markdown": "Síntese.", "pre_requisitos": ["A", "B"]}'))
    );
    expect(await generateQuestionDissection(question)).toEqual({
      status: 'ok',
      provider: 'GEMINI_FREE',
      dissectionMarkdown: 'Síntese.',
      prerequisites: ['A', 'B'],
    });
  });
});
