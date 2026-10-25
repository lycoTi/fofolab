// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createAgyProvider, createProvider, LimiteDiario, loadKeys } from '../aiProvider';

/** Saída real do `agy … --output-format stream-json` registrada em 25/10/2026 (encurtada): eventos NDJSON, o último é `result`. */
const AGY_OK = [
  JSON.stringify({ event: 'init', conversation_id: '33f1677c', init: { model: 'gemini-3.8-flash-low' } }),
  JSON.stringify({
    event: 'result',
    result: {
      conversation_id: '33f1677c', status: 'SUCCESS', response: '{"resultados":[]}\n', num_turns: 2,
      structured_output: { resultados: [{ assuntos: [{ confianca: 0.95, id: 'bd>sql' }], id: 'SERPRO_23:846:66' }] },
      usage: { input_tokens: 12304, output_tokens: 67 },
    },
  }),
].join('\n');

describe('Chaves de API', () => {
  it('lê do .env e o ambiente vence o arquivo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'keys-'));
    writeFileSync(join(dir, '.env'), 'VITE_GROQ_API_KEY=do-arquivo\nVITE_DEEPSEEK_API_KEY="ds-arquivo"\n');
    expect(loadKeys({}, [join(dir, '.env')])).toEqual({ groq: 'do-arquivo', deepseek: 'ds-arquivo' });
    expect(loadKeys({ VITE_GROQ_API_KEY: 'do-ambiente' }, [join(dir, '.env')]).groq).toBe('do-ambiente');
  });
});

describe('Provedor HTTP (Groq/DeepSeek)', () => {
  const ok = () => new Response(JSON.stringify({ choices: [{ message: { content: '{"resultados":[]}' } }] }), { status: 200 });

  it('manda modelo e teto de resposta; 429 curto espera e tenta de novo', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('limite', { status: 429, headers: { 'retry-after': '5' } })).mockResolvedValueOnce(ok());
    const sleep = vi.fn(async () => {});
    const p = createProvider({ nome: 'groq', chave: 'segredo-123', fetchImpl, sleep });
    expect(await p.complete('oi', 300)).toBe('{"resultados":[]}');
    expect(sleep).toHaveBeenCalledWith(5000);
    const body = JSON.parse(String((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ model: 'qwen/qwen3.8-27b', max_completion_tokens: 300 });
    expect(p.tamanhoLote).toBe(10);
  });

  it('429 com espera longa é o limite diário; a chave nunca aparece no erro', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('segredo-123 estourou', { status: 429, headers: { 'retry-after': '3600' } }));
    const p = createProvider({ nome: 'groq', chave: 'segredo-123', fetchImpl, sleep: async () => {} });
    const err = await p.complete('oi', 300).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LimiteDiario);
    expect(String((err as Error).message)).not.toContain('segredo-123');
  });

  it('gpt-oss no Groq: raciocínio "low" e folga no teto, senão o raciocínio come a resposta', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    await createProvider({ nome: 'groq', chave: 'k', modelo: 'openai/gpt-oss-120b', fetchImpl }).complete('oi', 700);
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ model: 'openai/gpt-oss-120b', reasoning_effort: 'low', max_completion_tokens: 1700 });
  });

  it('DeepSeek desliga o modo de raciocínio', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    await createProvider({ nome: 'deepseek', chave: 'k', fetchImpl }).complete('oi', 100);
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ model: 'deepseek-flash', max_tokens: 100, thinking: { type: 'disabled' } });
  });
});

describe('Provedor Antigravity CLI (agy)', () => {
  it('prompt pela entrada padrão (stream-json), com esquema, sandbox e pasta própria; devolve o structured_output', async () => {
    const run = vi.fn(async () => ({ stdout: `ERROR: logging before google.Init: I1025 ruído\n${AGY_OK}`, code: 0 }));
    const p = createAgyProvider({ workDir: 'C:/vazia', schemaPath: 'C:/vazia/schema.json', run });
    const longo = 'x'.repeat(40_000);
    const out = JSON.parse(await p.complete(longo, 900));
    expect(out.resultados[0].assuntos[0].id).toBe('bd>sql');
    const [args, cwd, stdin] = run.mock.calls[0] as unknown as [string[], string, string];
    expect(args).toEqual(expect.arrayContaining(['--input-format', 'stream-json', '--output-format', 'stream-json', '--model', 'gemini-3.8-flash-low', '--json-schema', 'C:/vazia/schema.json', '--sandbox', '-p=']));
    // O prompt longo NÃO vai na linha de comando (o Windows corta em 32 mil caracteres)
    expect(args.join(' ')).not.toContain(longo);
    expect(JSON.parse(stdin)).toEqual({ event: 'user', message: { role: 'user', content: longo } });
    expect(cwd).toBe('C:/vazia');
    expect(p.nome).toBe('agy');
    expect(p.tamanhoLote).toBe(30);
  });

  it('status diferente de SUCCESS é erro; cota esgotada é limite diário', async () => {
    const result = JSON.stringify({ event: 'result', result: { status: 'ERROR', response: '', error: 'falhou' } });
    const failed = createAgyProvider({ workDir: 'x', schemaPath: 's', run: async () => ({ stdout: result, code: 0 }) });
    await expect(failed.complete('p', 10)).rejects.toThrow(/falhou|ERROR/);
    const quota = createAgyProvider({ workDir: 'x', schemaPath: 's', run: async () => ({ stdout: 'Error: quota exhausted for model', code: 1 }) });
    await expect(quota.complete('p', 10)).rejects.toBeInstanceOf(LimiteDiario);
  });
});
