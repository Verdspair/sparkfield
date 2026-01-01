import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['ui-*.spec.ts', 'hud-actions.spec.ts'],
  timeout: 20_000,
  workers: 1,
  fullyParallel: false,
  webServer: {
    command: 'pnpm --filter @app/client exec vite --port 5185 --strictPort',
    cwd: '../..', url: 'http://127.0.0.1:5185', reuseExistingServer: true,
    env: { VITE_API_ORIGIN: '', VITE_WS_ORIGIN: '' },
  },
  use: {
    baseURL: 'http://127.0.0.1:5185', viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--use-angle=metal', '--enable-webgl'] },
  },
});
