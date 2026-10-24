import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEED_QUESTIONS } from '../data/initialSeed';
import { askFofoIa } from '../lib/fofoia/ask';
import { buildFofoContext } from '../lib/fofoia/context';
import {
  escapeXml,
  generateQuestionDissection,
  getAiStatus,
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
