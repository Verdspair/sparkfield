import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './schema.js';

export type AppDatabase = Kysely<Database>;
export function createDatabase(connectionString = process.env.DATABASE_URL ?? 'postgres://127.0.0.1:5432/beyond_light_cone'): AppDatabase {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: 20 }) }) });
}
