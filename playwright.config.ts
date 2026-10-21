import { defineConfig } from '@playwright/test';

/**
 * Testes de ponta a ponta (E2E) da bancada no navegador, contra o `npm run dev`.
 * Usa o Microsoft Edge instalado no Windows (mesmo motor do WebView2 do .exe Tauri),
 * então não precisa baixar navegador. Em outro SO: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:1420',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge',
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
