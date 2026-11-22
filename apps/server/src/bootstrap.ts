import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import { CoursePackSchema, RegisterRequestSchema } from '@pkg/contracts';
import { compileCoursePack, serializeCoursePackToAuthoring } from '@pkg/pack-compiler';
import type { AppDatabase } from './db/client.js';
import type { Database } from './db/schema.js';
import { migrateDatabase } from './db/migrate.js';
import { publishCoursePack } from './db/repositories.js';
import { hashPassword } from './auth/authService.js';
import { ServiceError } from './db/errors.js';

export interface BootstrapOptions {
  contentRoot?: string;
  defaultAdmin?: { username: string; password: string; nickname?: string } | false;
}
export interface BootstrapResult { packIds: string[]; adminUserId: string | null }

export async function bootstrapDatabase(db: AppDatabase, options: BootstrapOptions = {}): Promise<BootstrapResult> {
  await migrateDatabase(db);
  const contentRoot = options.contentRoot ?? fileURLToPath(new URL('../../../content/', import.meta.url));
  const compiledRoot = join(contentRoot, 'courses', 'compiled');
  const packIds: string[] = [];
  for (const file of (await readdir(compiledRoot)).filter((name) => name.endsWith('.json')).sort()) {
    const pack = CoursePackSchema.parse(JSON.parse(await readFile(join(compiledRoot, file), 'utf8')));
    const authoring = serializeCoursePackToAuthoring(pack);
    const checked = compileCoursePack({ meta: authoring.meta, createdAtIso: authoring.createdAtIso,
      csvSources: [{ file: `${file}.csv`, text: authoring.csvText }],
      mdSources: [{ file: `${file}.md`, text: authoring.mdText }] });
    if (!checked.ok || checked.pack.manifest.contentSha256 !== pack.manifest.contentSha256) {
      throw new ServiceError('INVALID_SEED_COURSE_PACK', `Invalid seed pack: ${file}`);
    }
    await db.transaction().execute(async (tx) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${`pack:${pack.manifest.packId}`},0))`.execute(tx);
      const active = await tx.selectFrom('course_packs').select('course_pack_version').where('pack_id', '=', pack.manifest.packId)
        .where('is_active', '=', true).executeTakeFirst();
      const seedVersion = pack.manifest.coursePackVersion.split('.').map(BigInt);
      const activeVersion = active?.course_pack_version.split('.').map(BigInt);
      const newer = !activeVersion || seedVersion.some((part, index) =>
        part > (activeVersion[index] ?? 0n) && seedVersion.slice(0, index).every((previous, i) => previous === activeVersion[i]));
      if (newer) {
        const borrowed = new Proxy(tx, {
          get(target, key) {
            if (key === 'transaction') return () => ({ execute: <T>(run: (inner: Transaction<Database>) => Promise<T>) => run(tx) });
            const value: unknown = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
        await publishCoursePack(borrowed, checked.pack, true);
      }
    });
    packIds.push(pack.manifest.packId);
  }
  let admin = options.defaultAdmin;
  if (admin === undefined) {
    const password = process.env.ADMIN_PASSWORD;
    if (process.env.NODE_ENV === 'production' && !password) throw new ServiceError('ADMIN_PASSWORD_REQUIRED');
    admin = password ? { username: process.env.ADMIN_USERNAME ?? 'admin', password, nickname: '管理员' } : false;
  }
  let adminUserId: string | null = null;
  if (admin !== false) {
    const validated = RegisterRequestSchema.parse({ ...admin, nickname: admin.nickname ?? '管理员' });
    const passwordHash = await hashPassword(validated.password);
    adminUserId = await db.transaction().execute(async (tx) => {
      await sql`select pg_advisory_xact_lock(102026, 3)`.execute(tx);
      const existing = await tx.selectFrom('users').select(['id', 'role']).where('username', '=', validated.username).executeTakeFirst();
      if (existing) {
        if (existing.role !== 'admin') throw new ServiceError('ADMIN_USERNAME_ALREADY_TAKEN');
        return existing.id;
      }
      const id = randomUUID();
      await tx.insertInto('users').values({ id, username: validated.username, nickname: validated.nickname,
        email: null, password_hash: passwordHash, role: 'admin', avatar_frame_id: null, board_plaque_id: null, cohort_group: null }).execute();
      return id;
    });
  }
  return { packIds, adminUserId };
}
