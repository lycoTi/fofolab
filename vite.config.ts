import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const SAFE_ACERVO_FILE = /^\/__acervo\/([a-z0-9._-]+\.json)(?:\?.*)?$/i;
const AGY_TIMEOUT_MS = 60_000;
const AGY_REPLY_SCHEMA = {
  type: 'object',
  properties: { reply: { type: 'string' } },
  required: ['reply'],
  additionalProperties: false,
};

function runLocalAgy(prompt: string, strong?: boolean): Promise<string | null> {
  const exe = join(process.env.LOCALAPPDATA ?? '', 'agy', 'bin', 'agy.exe');
  if (!existsSync(exe)) return Promise.resolve(null);
  const base = join(tmpdir(), 'fofolab-fofoia-agy');
  const workDir = join(base, 'sandbox');
  mkdirSync(workDir, { recursive: true });
  const schemaPath = join(base, 'reply-schema.json');
  writeFileSync(schemaPath, JSON.stringify(AGY_REPLY_SCHEMA));

  const model = strong
    ? (process.env.VITE_AGY_MODEL_STRONG || 'gemini-3.8-flash-high')
    : (process.env.VITE_AGY_MODEL || 'gemini-3.8-flash-low');

  const args = [
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--json-schema', schemaPath,
    '--model', model,
    '--disable-slash-commands',
    '--sandbox',
    '-p=',
  ];
  const stdin = JSON.stringify({ event: 'user', message: { role: 'user', content: prompt } });

  return new Promise((resolve) => {
    const child = spawn(exe, args, { cwd: workDir, windowsHide: true });
    let stdout = '';
    const timer = setTimeout(() => child.kill(), AGY_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stdout += chunk));
    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on('close', () => {
      clearTimeout(timer);
      const line = stdout.split(/\r?\n/).reverse().find((l) => l.includes('"event":"result"'));
      if (!line) return resolve(null);
      try {
        const parsed = JSON.parse(line) as { result?: { status?: string; structured_output?: { reply?: unknown } } };
        const reply = parsed.result?.structured_output?.reply;
        resolve(parsed.result?.status === 'SUCCESS' && typeof reply === 'string' && reply.trim() ? reply.trim() : null);
      } catch {
        resolve(null);
      }
    });
    child.stdin.end(stdin);
  });
}

/**
 * Serve os pacotes gerados pelo minerador (`acervo/pacote/*.json`) em `/__acervo/*` (spec 12d §3.1) e expõe a ponte
 * local `/__ai/agy` para a FofoIA usar o Antigravity CLI instalado no computador quando necessário.
 */
function fofolabLocalBridges(): Plugin {
  return {
    name: 'fofolab-local-bridges',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method === 'POST' && req.url === '/__ai/agy') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              const { prompt, strong } = JSON.parse(body) as { prompt?: unknown; strong?: unknown };
              if (typeof prompt !== 'string' || !prompt.trim()) {
                res.statusCode = 400;
                res.end();
                return;
              }
              void runLocalAgy(prompt, Boolean(strong)).then((reply) => {
                if (!reply) {
                  res.statusCode = 502;
                  res.end();
                  return;
                }
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ reply, truncated: false }));
              });
            } catch {
              res.statusCode = 400;
              res.end();
            }
          });
          return;
        }
        if (req.method !== 'GET' || !req.url?.startsWith('/__acervo/')) return next();
        if (process.env.FOFOLAB_DISABLE_ACERVO_STATIC === '1') {
          res.statusCode = 404;
          res.end();
          return;
        }
        const match = SAFE_ACERVO_FILE.exec(req.url);
        if (!match) {
          res.statusCode = 404;
          res.end();
          return;
        }
        const filePath = join(process.cwd(), 'acervo', 'pacote', match[1]);
        if (!existsSync(filePath)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(readFileSync(filePath));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), fofolabLocalBridges()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // e2e/ roda com o Playwright (npm run test:e2e), não com o Vitest
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
