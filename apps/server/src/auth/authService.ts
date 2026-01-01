import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { sql, type Selectable, type Transaction } from 'kysely';
import { RegisterRequestSchema, LoginRequestSchema, UserProfileSchema, type UserProfile } from '@pkg/contracts';
import type { AppDatabase } from '../db/client.js';
import type { Database, UsersTable } from '../db/schema.js';
import { ServiceError } from '../db/errors.js';

const deriveKey = promisify(scrypt);
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, hex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !hex || !/^[a-f0-9]{128}$/.test(hex)) return false;
  const actual = await deriveKey(password, salt, 64) as Buffer;
  const expected = Buffer.from(hex, 'hex');
  return timingSafeEqual(expected, actual);
}
export function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
export function toUserProfile(user: Selectable<UsersTable>): UserProfile {
  const email = user.email;
  return UserProfileSchema.parse({ userId: user.id, username: user.username, nickname: user.nickname,
    emailMasked: email ? `${email.slice(0, 1)}***@${email.split('@')[1]}` : null,
    role: user.role, sessionEpoch: user.session_epoch, onboardingChoice: user.onboarding_choice,
    learningStartSelections: user.learning_start_json, preferredArena: user.preferred_arena,
    displaySettings: user.display_settings_json, avatarFrameId: user.avatar_frame_id, boardPlaqueId: user.board_plaque_id });
}
export interface AuthenticatedSession { userId: string; sessionEpoch: number; profile: UserProfile }
export interface LoginResult extends AuthenticatedSession { token: string; expiresAtIso: string; activeSeat: unknown | null }
export type ActiveSeatResolver = (userId: string) => unknown | null | Promise<unknown | null>;

export class AuthService {
  constructor(private readonly db: AppDatabase, private readonly resolveActiveSeat?: ActiveSeatResolver) {}

  async register(input: unknown): Promise<UserProfile> {
    const data = RegisterRequestSchema.parse(input);
    const user = await this.db.insertInto('users').values({ id: randomUUID(), username: data.username,
      nickname: data.nickname, email: data.email?.trim().toLowerCase() || null,
      password_hash: await hashPassword(data.password), avatar_frame_id: null, board_plaque_id: null, cohort_group: null,
    }).returningAll().executeTakeFirstOrThrow();
    return toUserProfile(user);
  }

  async login(input: unknown): Promise<LoginResult> {
    const data = LoginRequestSchema.parse(input);
    const result = await this.db.transaction().execute(async (tx) => {
      const user = await tx.selectFrom('users').selectAll().where('username', '=', data.username).forUpdate().executeTakeFirst();
      if (!user || !await verifyPassword(data.password, user.password_hash)) throw new ServiceError('INVALID_CREDENTIALS');
      const updated = await tx.updateTable('users').set({ session_epoch: sql<number>`session_epoch + 1` })
        .where('id', '=', user.id).returningAll().executeTakeFirstOrThrow();
      const token = `${updated.session_epoch}.${randomBytes(32).toString('base64url')}`;
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await tx.insertInto('user_sessions').values({ token_hash: tokenHash(token), user_id: user.id,
        session_epoch: updated.session_epoch, expires_at: expiresAt }).execute();
      return { token, userId: user.id, sessionEpoch: updated.session_epoch, profile: toUserProfile(updated), expiresAtIso: expiresAt.toISOString() };
    });
    return { ...result, activeSeat: await this.resolveActiveSeat?.(result.userId) ?? null };
  }

  private async validate(token: string, tx?: Transaction<Database>): Promise<AuthenticatedSession> {
    const db = tx ?? this.db;
    let query = db.selectFrom('user_sessions as s').innerJoin('users as u', 'u.id', 's.user_id')
      .selectAll('u').select(['s.session_epoch as token_epoch', 's.expires_at'])
      .where('s.token_hash', '=', tokenHash(token));
    if (tx) query = query.forUpdate('u');
    const row = await query.executeTakeFirst();
    if (!row) throw new ServiceError('SESSION_INVALID');
    if (row.token_epoch !== row.session_epoch) throw new ServiceError('SESSION_SUPERSEDED');
    if (row.expires_at.getTime() <= Date.now()) throw new ServiceError('SESSION_EXPIRED');
    return { userId: row.id, sessionEpoch: row.session_epoch, profile: toUserProfile(row) };
  }

  async authenticate(token: string): Promise<AuthenticatedSession> { return this.validate(token); }
  async withAuthenticatedSession<T>(token: string, command: (session: AuthenticatedSession, tx: Transaction<Database>) => Promise<T> | T): Promise<T> {
    return this.db.transaction().execute(async (tx) => command(await this.validate(token, tx), tx));
  }
  async logout(token: string): Promise<void> {
    await this.db.deleteFrom('user_sessions').where('token_hash', '=', tokenHash(token)).execute();
  }
  async adminResetPassword(input: { adminToken: string; userId: string; newPassword: string; identityVerified: boolean }): Promise<void> {
    if (!input.identityVerified) throw new ServiceError('IDENTITY_VERIFICATION_REQUIRED');
    RegisterRequestSchema.shape.password.parse(input.newPassword);
    const passwordHash = await hashPassword(input.newPassword);
    await this.withAuthenticatedSession(input.adminToken, async (actor, tx) => {
      if (actor.profile.role !== 'admin') throw new ServiceError('FORBIDDEN');
      const target = await tx.selectFrom('users').select(['email']).where('id', '=', input.userId).forUpdate().executeTakeFirst();
      if (!target) throw new ServiceError('USER_NOT_FOUND');
      if (target.email !== null) throw new ServiceError('EMAIL_ACCOUNT_RESET_NOT_SUPPORTED');
      await tx.updateTable('users').set({ password_hash: passwordHash, session_epoch: sql<number>`session_epoch + 1` })
        .where('id', '=', input.userId).execute();
    });
  }
  async getActiveSeat(token: string): Promise<unknown | null> {
    const session = await this.authenticate(token);
    return await this.resolveActiveSeat?.(session.userId) ?? null;
  }
  async updateProfileInTransaction(session: AuthenticatedSession, tx: Transaction<Database>, patch: Partial<Pick<UserProfile,
    'nickname' | 'onboardingChoice' | 'learningStartSelections' | 'preferredArena' | 'displaySettings'>>): Promise<UserProfile> {
    const profile = UserProfileSchema.parse({ ...session.profile, ...patch });
    const user = await tx.updateTable('users').set({ nickname: profile.nickname, onboarding_choice: profile.onboardingChoice,
      learning_start_json: JSON.stringify(profile.learningStartSelections), preferred_arena: profile.preferredArena,
      display_settings_json: JSON.stringify(profile.displaySettings) }).where('id', '=', session.userId)
      .returningAll().executeTakeFirstOrThrow();
    return toUserProfile(user);
  }
  async updateProfile(token: string, patch: Partial<Pick<UserProfile,
    'nickname' | 'onboardingChoice' | 'learningStartSelections' | 'preferredArena' | 'displaySettings'>>): Promise<UserProfile> {
    return this.withAuthenticatedSession(token, (session, tx) => this.updateProfileInTransaction(session, tx, patch));
  }
}
