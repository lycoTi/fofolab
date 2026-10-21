import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
