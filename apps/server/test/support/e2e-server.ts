import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { createDatabase } from '../../src/db/client.js';
import { createAppServer } from '../../src/index.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://127.0.0.1:5432/beyond_light_cone_test';
const admin = createDatabase(databaseUrl);
const schema = `browser_${randomUUID().replace(/-/g, '')}`;
await sql.raw(`CREATE SCHEMA "${schema}"`).execute(admin);
const scopedUrl = new URL(databaseUrl);
scopedUrl.searchParams.set('options', `-c search_path=${schema}`);
let server: Awaited<ReturnType<typeof createAppServer>> | undefined;
let closing: Promise<void> | undefined;

function close(): Promise<void> {
  closing ??= (async () => {
    await server?.close();
    await sql.raw(`DROP SCHEMA "${schema}" CASCADE`).execute(admin);
    await admin.destroy();
  })();
  return closing;
}

try {
  server = await createAppServer({
    databaseUrl: scopedUrl.href,
    corsOrigins: [process.env.E2E_WEB_ORIGIN ?? 'http://127.0.0.1:5183', 'tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'],
  });
  const address = await server.listen(Number(process.env.PORT ?? 3001));
  console.log(`Browser test server listening at ${address}`);
  const stop = () => { void close().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); }); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} catch (error) {
  await close();
  throw error;
}
