import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Provedores de IA da ferramenta (fora do app, sem o roteador do Vite): `agy` (Antigravity CLI, login da conta Google —
 * sem chave), `groq` e `deepseek` (HTTP OpenAI-compatível, chave no `.env`). Todos devolvem o texto JSON da resposta;
 * a validação é do `classifyPrompt`.
 */
export interface AiProvider {
  /** "agy", "groq" ou "deepseek"; com o modelo, forma a chave da opinião ("agy:gemini-3.8-flash-low"). */
  nome: string;
  modelo: string;
  /** Itens por chamada: o `agy` carrega ~12 mil tokens do próprio agente a cada chamada, então lotes maiores. */
  tamanhoLote: number;
  complete(prompt: string, maxTokens: number): Promise<string>;
}

/** Cota do dia acabou (ou a espera pedida é longa demais): a rodada para e grava o que já fez. */
export class LimiteDiario extends Error {
  constructor(public readonly retryAfterSec: number, detalhe: string) {
    super(`limite de uso atingido (${detalhe}); rode de novo mais tarde — a fila continua de onde parou`);
    this.name = 'LimiteDiario';
  }
}

/** Ambiente primeiro; depois `.env.local` e `.env`, na ordem. A chave nunca é impressa. */
export function loadKeys(env: NodeJS.ProcessEnv, files: string[]): { groq?: string; deepseek?: string } {
  const fromFiles: Record<string, string> = {};
  for (const file of [...files].reverse()) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && m[2]) fromFiles[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  const pick = (name: string) => env[name]?.trim() || fromFiles[name] || undefined;
  return { groq: pick('VITE_GROQ_API_KEY'), deepseek: pick('VITE_DEEPSEEK_API_KEY') };
}

const SHORT_WAIT_SEC = 120;
const MAX_RETRIES = 3;
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const HTTP = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', modelo: 'qwen/qwen3.8-27b' },
  deepseek: { url: 'https://api.deepseek.com/chat/completions', modelo: 'deepseek-flash' },
} as const;

export function createProvider(opts: {
  nome: 'groq' | 'deepseek';
  chave: string;
  modelo?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): AiProvider {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const { url } = HTTP[opts.nome];
  const modelo = opts.modelo ?? HTTP[opts.nome].modelo;

  const body = (prompt: string, maxTokens: number) =>
    opts.nome === 'groq'
      ? { model: modelo, max_completion_tokens: maxTokens, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }
      : { model: modelo, max_tokens: maxTokens, thinking: { type: 'disabled' }, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] };

  return {
    nome: opts.nome,
    modelo,
    tamanhoLote: 10,
    async complete(prompt, maxTokens) {
      for (let attempt = 0; ; attempt += 1) {
        const response = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.chave}` },
          body: JSON.stringify(body(prompt, maxTokens)),
        });
        if (response.status === 429) {
          const wait = Number(response.headers.get('retry-after')) || 60;
          if (wait > SHORT_WAIT_SEC || attempt >= MAX_RETRIES) throw new LimiteDiario(wait, `${opts.nome} pediu ${wait} s`);
          await sleep(wait * 1000);
          continue;
        }
        // Só o status: o corpo do erro pode ecoar dados do pedido
        if (!response.ok) throw new Error(`${opts.nome} respondeu ${response.status}`);
        const data = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
        const text = data.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) throw new Error(`${opts.nome} respondeu vazio`);
        return text;
      }
    },
  };
}

type Runner = (args: string[], cwd: string, stdin: string) => Promise<{ stdout: string; code: number }>;

const DEFAULT_AGY = join(process.env.LOCALAPPDATA ?? '', 'agy', 'bin', 'agy.exe');
const AGY_TIMEOUT_MS = 10 * 60 * 1000;

/** Sem shell (argumentos em lista) e com tempo limite: o texto dos itens nunca vira comando. */
const defaultRunner =
  (exe: string): Runner =>
  (args, cwd, stdin) =>
    new Promise((resolve, reject) => {
      const child = spawn(exe, args, { cwd, windowsHide: true });
      let stdout = '';
      const timer = setTimeout(() => child.kill(), AGY_TIMEOUT_MS);
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stdout += chunk));
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ stdout, code: code ?? 1 });
      });
      child.stdin.end(stdin);
    });

const QUOTA = /quota|rate.?limit|exhausted|resource_exhausted|too many requests/i;

/**
 * Antigravity CLI em modo não interativo. O prompt vai pela entrada padrão em `stream-json` (a linha de comando do
 * Windows corta em 32 mil caracteres e um lote passa disso); a resposta presa ao esquema vem em `structured_output` do
 * evento `result`. Roda numa pasta vazia e com `--sandbox`: o texto dos itens é entrada não confiável e o agente tem
 * ferramentas (num teste, o sandbox barrou um `RunCommand`).
 */
export function createAgyProvider(opts: { modelo?: string; exe?: string; workDir: string; schemaPath: string; run?: Runner }): AiProvider {
  const modelo = opts.modelo ?? 'gemini-3.8-flash-low';
  const run = opts.run ?? defaultRunner(opts.exe ?? DEFAULT_AGY);
  return {
    nome: 'agy',
    modelo,
    tamanhoLote: 30,
    async complete(prompt) {
      const args = [
        '--input-format', 'stream-json', '--output-format', 'stream-json', '--json-schema', opts.schemaPath,
        '--model', modelo, '--disable-slash-commands', '--sandbox', '-p=',
      ];
      const stdin = JSON.stringify({ event: 'user', message: { role: 'user', content: prompt } });
      const { stdout, code } = await run(args, opts.workDir, stdin);
      const resultLine = stdout.split(/\r?\n/).reverse().find((l) => l.includes('"event":"result"'));
      if (!resultLine) {
        if (QUOTA.test(stdout)) throw new LimiteDiario(3600, 'cota do Antigravity');
        throw new Error(`agy terminou sem resultado (código ${code})`);
      }
      const { result } = JSON.parse(resultLine) as { result: { status?: string; error?: string; structured_output?: unknown } };
      if (result.status !== 'SUCCESS' || result.structured_output === undefined) {
        const detalhe = result.error || result.status || 'sem resposta estruturada';
        if (QUOTA.test(detalhe)) throw new LimiteDiario(3600, 'cota do Antigravity');
        throw new Error(`agy: ${detalhe}`);
      }
      return JSON.stringify(result.structured_output);
    },
  };
}
