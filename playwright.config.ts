import { defineConfig } from '@playwright/test';

/**
 * Testes de ponta a ponta (E2E) da bancada no navegador, contra um servidor do Vite só deles.
 * Usa o Microsoft Edge instalado no Windows (mesmo motor do WebView2 do .exe Tauri),
 * então não precisa baixar navegador. Em outro SO: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.
 *
 * Porta 1421, não a 1420 do `npm run dev`: o servidor de uso do dia a dia (com a chave de IA do .env e o banco no
 * IndexedDB daquela origem) pode ficar aberto sem ser reaproveitado pelos testes nem sujar os dados de estudo.
 */
const E2E_PORT = 1421;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge',
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --port ${E2E_PORT} --strictPort`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
    // Os testes conferem o modo demonstração: a chave do .env do PC não pode entrar (vazio no ambiente vence o .env).
    env: {
      VITE_FOFOLAB_AI_GATEWAY_URL: '',
      VITE_GROQ_API_KEY: '',
      VITE_GEMINI_API_KEY: '',
      VITE_DEEPSEEK_API_KEY: '',
      FOFOLAB_DISABLE_ACERVO_STATIC: '1',
    },
  },
});
