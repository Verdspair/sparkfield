import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createAppServer } from '../src/index.js';
import { createDatabase } from '../src/db/client.js';

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://127.0.0.1:5432/beyond_light_cone_test';
const admin = createDatabase(databaseUrl);
const schema = `cors_${randomUUID().replace(/-/g, '')}`;
const scopedUrl = new URL(databaseUrl);
scopedUrl.searchParams.set('options', `-c search_path=${schema}`);
const db = createDatabase(scopedUrl.href);
let server: Awaited<ReturnType<typeof createAppServer>>;
let baseUrl: string;

beforeAll(async () => {
  await sql.raw(`CREATE SCHEMA "${schema}"`).execute(admin);
  server = await createAppServer({ db, defaultAdmin: false });
  baseUrl = await server.listen(0);
});

afterAll(async () => {
  await server?.close();
  await db.destroy();
  await sql.raw(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).execute(admin);
  await admin.destroy();
});

describe('native cross-origin profile writes over a real HTTP listener', () => {
  it.each(['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost', 'http://127.0.0.1:5173'])(
    'allows the PATCH preflight from %s, not just a successful OPTIONS status', async (origin) => {
      const response = await fetch(`${baseUrl}/api/auth/profile`, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'authorization,content-type' },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
      expect(response.headers.get('access-control-allow-methods')?.split(/,\s*/)).toContain('PATCH');
      const allowedHeaders = response.headers.get('access-control-allow-headers')?.toLowerCase();
      expect(allowedHeaders).toContain('authorization');
      expect(allowedHeaders).toContain('content-type');
    },
  );

  it('persists both onboarding and chapter choices with a native-origin authenticated PATCH', async () => {
    const username = `native_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const password = randomUUID();
    const headers = { Origin: 'tauri://localhost', 'Content-Type': 'application/json' };
    const registered = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers, body: JSON.stringify({ username, password, nickname: 'Pilot' }),
    });
    expect(registered.status).toBe(201);
    const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers, body: JSON.stringify({ username, password }) });
    const { token, userId } = await login.json() as { token: string; userId: string };
    expect(login.status).toBe(200);
    const selections = { english: 'ENG_N1_VOCAB_DIALOGUE', math: 'MATH_N1_SET_FUNC' };
    const saved = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PATCH', headers: { ...headers, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ onboardingChoice: 'skipped', learningStartSelections: selections }),
    });
    expect(saved.status).toBe(200);
    const row = await db.selectFrom('users').select(['onboarding_choice', 'learning_start_json']).where('id', '=', userId).executeTakeFirstOrThrow();
    expect(row.onboarding_choice).toBe('skipped');
    expect(row.learning_start_json).toEqual(selections);
  });

  it('does not grant cross-origin access to untrusted sites', async () => {
    const response = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'OPTIONS', headers: { Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'PATCH' },
    });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
