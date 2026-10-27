import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEED_QUESTIONS } from '../data/initialSeed';
import { askFofoIa } from '../lib/fofoia/ask';
import { buildFofoContext } from '../lib/fofoia/context';
import {
  escapeXml,
  generateQuestionDissection,
  getAiStatus,
  GROQ_FREE_OUTPUT_TOKENS_PER_MINUTE,
  parseDissectionResponse,
} from '../lib/aiRouter';

const question = SEED_QUESTIONS[0];
const ctx = buildFofoContext({
  context: {
    planTitle: 'CGU', organ: 'CGU', examBoard: 'FGV', roleTitle: 'Auditor', daysUntilExam: 90, weeklyHoursTarget: 21,
    currentSubjectName: 'Auditoria', currentSubjectWeight: 2, currentSubjectMastery: 60, currentSubjectCoverage: 40,
    currentTopicCode: '1.1', currentTopicTitle: 'Normas de auditoria', currentTopicMastery: 60, currentTopicConfidence: 40,
    strongTopics: [], priorityWeakTopics: [], relatedPrerequisites: [],
  },
  notebook: null,
  activeQuestion: { question, answered: true, dissection: null },
  prerequisites: [],
});
const ask = (mode: 'QUICK' | 'LESSON' = 'QUICK') => askFofoIa({ mode, ctx, conversation: [], message: 'Explique' });

function stubNoAi() {
  vi.stubEnv('VITE_FOFOLAB_AI_GATEWAY_URL', '');
  vi.stubEnv('VITE_GROQ_API_KEY', '');
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
  vi.restoreAllMocks();
});

describe('Roteador de IA: modo demonstração honesto, grounding e explicação guardada', () => {
  it('detecta quais provedores estão configurados', () => {
    stubNoAi();
    expect(getAiStatus()).toEqual({ configured: false, providers: [] });

    vi.stubEnv('VITE_GEMINI_API_KEY', 'chave-teste');
    expect(getAiStatus()).toEqual({ configured: true, providers: ['GEMINI_FREE'] });
  });

  it('escapa o contexto enviado à IA (aspas e < > em títulos não quebram o prompt)', () => {
    expect(escapeXml('Lei "A" <B> & C')).toBe('Lei &quot;A&quot; &lt;B&gt; &amp; C');
  });

  it('com chave configurada usa a IA real, sem marcar como simulação', async () => {
    stubNoAi();
    vi.stubEnv('VITE_GEMINI_API_KEY', 'chave-teste');
    const fetchMock = vi.fn(async () => geminiResponse('Resposta real da IA'));
    vi.stubGlobal('fetch', fetchMock);

    const reply = await ask();

    expect(reply).toEqual({ reply: 'Resposta real da IA', provider: 'GEMINI_FREE', simulated: false });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0].text).toContain('não consigo confirmar o dispositivo exato');
    expect(body.contents[0].parts[0].text).toContain(`<gabarito_definitivo>${question.final_answer}</gabarito_definitivo>`);
  });

  it('se a IA configurada falhar, avisa que não respondeu (sem inventar um exemplo)', async () => {
    stubNoAi();
    vi.stubEnv('VITE_GEMINI_API_KEY', 'chave-teste');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('erro', { status: 500 })));

    const reply = await ask();
    expect(reply.failed).toBe(true);
    expect(reply.simulated).toBe(false);
    expect(reply.reply).toMatch(/Não consegui falar com a IA/);
  });

  it('tenta o Groq primeiro e, se ele falhar, cai no Gemini', async () => {
    stubNoAi();
    vi.stubEnv('VITE_GROQ_API_KEY', 'chave-groq');
    vi.stubEnv('VITE_GEMINI_API_KEY', 'chave-gemini');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('groq.com') ? new Response('limite', { status: 429 }) : geminiResponse('Resposta do Gemini')
    );
    vi.stubGlobal('fetch', fetchMock);

    const reply = await ask();
    expect(reply).toEqual({ reply: 'Resposta do Gemini', provider: 'GEMINI_FREE', simulated: false });
    const [groqUrl, groqInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(groqUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(JSON.parse(String(groqInit.body)).model).toBe('qwen/qwen3.8-27b');
  });

  it('aula completa usa o modelo forte do Groq quando configurado; a resposta rápida, o de sempre', async () => {
    stubNoAi();
    vi.stubEnv('VITE_GROQ_API_KEY', 'chave-groq');
    vi.stubEnv('VITE_GROQ_MODEL_STRONG', 'modelo-forte');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await ask('LESSON');
    await ask('QUICK');
    const models = fetchMock.mock.calls.map((call) => JSON.parse(String((call as unknown as [string, RequestInit])[1].body)).model);
    expect(models).toEqual(['modelo-forte', 'qwen/qwen3.8-27b']);
  });

  it('cada chamada pede um teto de resposta abaixo do limite grátis do Groq (1.000 por minuto); a aula pode mais que a rápida', async () => {
    stubNoAi();
    vi.stubEnv('VITE_GROQ_API_KEY', 'chave-groq');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await ask('QUICK');
    await ask('LESSON');
    const caps = fetchMock.mock.calls.map((call) => JSON.parse(String((call as unknown as [string, RequestInit])[1].body)).max_completion_tokens);
    expect(caps[0]).toBeGreaterThan(0);
    expect(caps[0]).toBeLessThan(caps[1]);
    expect(caps[1]).toBeLessThanOrEqual(GROQ_FREE_OUTPUT_TOKENS_PER_MINUTE);
  });

  it('limite por minuto do plano grátis: avisa a pausa com os segundos que o provedor pediu', async () => {
    stubNoAi();
    vi.stubEnv('VITE_GROQ_API_KEY', 'chave-groq');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('limite', { status: 429, headers: { 'retry-after': '12' } })));

    const reply = await ask();
    expect(reply.failed).toBe(true);
    expect(reply.simulated).toBe(false);
    expect(reply.reply).toMatch(/pausa/i);
    expect(reply.reply).toContain('12 segundos');
  });

  it('tira caracteres de outros alfabetos que o modelo às vezes deixa escapar no meio do português', async () => {
    stubNoAi();
    vi.stubEnv('VITE_GROQ_API_KEY', 'chave-groq');
    const content = 'Recomendo se você感觉 "vago" na diferença.';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })));
    expect((await ask()).reply).toBe('Recomendo se você "vago" na diferença.');
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

describe('Resposta cortada no teto de tamanho', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const cutText = 'Serverless e microsserviços coexistem.\n\nCamadas de conhecimento\n\n1. Conceito – Entender as';

  it('Groq avisando "length": a FofoIA mostra só até a última frase completa e marca que dá para continuar', async () => {
    stubNoAi();
    vi.stubEnv('VITE_GROQ_API_KEY', 'chave-groq');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: cutText }, finish_reason: 'length' }] }), { status: 200 })));
    const reply = await ask('LESSON');
    expect(reply.cut).toBe(true);
    expect(reply.reply).toBe('Serverless e microsserviços coexistem.');
  });

  it('Gemini avisando MAX_TOKENS também conta como cortada; resposta completa não', async () => {
    stubNoAi();
    vi.stubEnv('VITE_GEMINI_API_KEY', 'chave-gemini');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: cutText }] }, finishReason: 'MAX_TOKENS' }] }), { status: 200 })));
    expect((await ask('QUICK')).cut).toBe(true);

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Completa.' }, finish_reason: 'stop' }] }), { status: 200 })));
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('VITE_GROQ_API_KEY', 'chave-groq');
    const whole = await ask('QUICK');
    expect(whole.cut).toBeUndefined();
    expect(whole.reply).toBe('Completa.');
  });
});
