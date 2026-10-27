import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const SAFE_ACERVO_FILE = /^\/__acervo\/([a-z0-9._-]+\.json)(?:\?.*)?$/i;

/**
 * Serve os pacotes gerados pelo minerador (`acervo/pacote/*.json`) em `/__acervo/*` para o app sincronizar sozinho
 * sem o estudante precisar abrir o seletor de arquivos (spec 12d §3.1).
 */
function fofolabAcervoStatic(): Plugin {
  return {
    name: 'fofolab-acervo-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
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
  plugins: [react(), fofolabAcervoStatic()],
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
