import { randomUUID } from 'node:crypto';
import { defineConfig } from '@playwright/test';

const e2eAdminUser = process.env.ADMIN_USERNAME ?? `admin_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
const e2eAdminPass = process.env.ADMIN_PASSWORD ?? `adm_${randomUUID()}`;
process.env.ADMIN_USERNAME = e2eAdminUser;
process.env.ADMIN_PASSWORD = e2eAdminPass;
const apiPort = process.env.E2E_API_PORT ?? '3101';
const webPort = process.env.E2E_WEB_PORT ?? '5183';
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
process.env.E2E_API_ORIGIN = apiOrigin;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'full-acceptance.spec.ts',
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  webServer: [
    {
      command: 'pnpm --filter @app/server exec tsx test/support/e2e-server.ts',
      cwd: '../..',
      url: `${apiOrigin}/api/health`,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://127.0.0.1:5432/beyond_light_cone_test',
        PORT: apiPort,
        E2E_WEB_ORIGIN: webOrigin,
        ADMIN_USERNAME: e2eAdminUser,
        ADMIN_PASSWORD: e2eAdminPass,
      },
    },
    {
      command: `pnpm --filter @app/client exec vite --port ${webPort} --strictPort`,
      cwd: '../..',
      url: webOrigin,
      reuseExistingServer: false,
      env: { VITE_SERVER_ORIGIN: apiOrigin, VITE_API_ORIGIN: apiOrigin, VITE_WS_ORIGIN: apiOrigin },
    },
  ],
  use: {
    baseURL: webOrigin,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      args: ['--use-angle=metal', '--enable-webgl'],
    },
  },
});
