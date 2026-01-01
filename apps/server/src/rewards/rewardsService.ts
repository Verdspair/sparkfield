import { randomUUID } from 'node:crypto';
import { sql, type Selectable, type Transaction } from 'kysely';
import type { GiftCatalogItem, RedeemOrder } from '@pkg/contracts';
import type { AppDatabase } from '../db/client.js';
import type { Database, RedemptionOrdersTable, RewardPointsLedgerTable } from '../db/schema.js';
import { ServiceError } from '../db/errors.js';

export interface GrantRewardPointsInput {
  userId: string; points: number; reason: string; idempotencyKey: string;
  isOfflineUnverified?: boolean; attemptId?: string;
  taskQuota?: { taskKey: string; quotaWindow: string };
}
export type LedgerEntry = Selectable<RewardPointsLedgerTable>;
async function lockUser(tx: Transaction<Database>, userId: string): Promise<void> {
  const user = await tx.selectFrom('users').select('id').where('id', '=', userId).forUpdate().executeTakeFirst();
  if (!user) throw new ServiceError('USER_NOT_FOUND');
}
async function lockIdempotencyKey(tx: Transaction<Database>, key: string): Promise<void> {
  if (!key || key.length > 256) throw new ServiceError('INVALID_IDEMPOTENCY_KEY');
  await sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(tx);
}
export async function getRewardPointsBalance(db: AppDatabase | Transaction<Database>, userId: string): Promise<number> {
  const result = await db.selectFrom('reward_points_ledger').select(sql<string>`coalesce(sum(points_delta), 0)`.as('balance'))
    .where('user_id', '=', userId).executeTakeFirstOrThrow();
  return Number(result.balance);
}
export async function grantRewardPointsInTx(tx: Transaction<Database>, input: GrantRewardPointsInput): Promise<LedgerEntry> {
  if (!Number.isSafeInteger(input.points) || input.points <= 0 || input.points > 2147483647) throw new ServiceError('INVALID_POINTS');
  if (input.isOfflineUnverified) throw new ServiceError('OFFLINE_UNVERIFIED_NOT_REWARDABLE');
  await lockUser(tx, input.userId);
  await lockIdempotencyKey(tx, input.idempotencyKey);
  if (input.attemptId) {
    const attempt = await tx.selectFrom('learning_attempts').select(['user_id','is_offline_unverified'])
      .where('id', '=', input.attemptId).executeTakeFirst();
    if (!attempt || attempt.user_id !== input.userId) throw new ServiceError('ATTEMPT_NOT_FOUND');
    if (attempt.is_offline_unverified) throw new ServiceError('OFFLINE_UNVERIFIED_NOT_REWARDABLE');
  }
  const existing = await tx.selectFrom('reward_points_ledger').selectAll().where('idempotency_key', '=', input.idempotencyKey).executeTakeFirst();
  if (existing) {
    if (existing.user_id !== input.userId || existing.points_delta !== input.points || existing.reason !== input.reason
      || existing.related_attempt_id !== (input.attemptId ?? null)) throw new ServiceError('IDEMPOTENCY_KEY_CONFLICT');
    return existing;
  }
  if (input.taskQuota) {
    const used = await tx.selectFrom('reward_task_quotas as q').innerJoin('reward_points_ledger as l','l.id','q.ledger_id')
      .selectAll('l').where('q.user_id','=',input.userId).where('q.task_key','=',input.taskQuota.taskKey)
      .where('q.quota_window','=',input.taskQuota.quotaWindow).executeTakeFirst();
    if (used) return used;
  }
  const ledger = await tx.insertInto('reward_points_ledger').values({ id: randomUUID(), user_id: input.userId,
    points_delta: input.points, reason: input.reason, idempotency_key: input.idempotencyKey,
    related_order_id: null, related_attempt_id: input.attemptId ?? null, compensates_ledger_id: null }).returningAll().executeTakeFirstOrThrow();
  if (input.taskQuota) await tx.insertInto('reward_task_quotas').values({ user_id: input.userId,
    task_key: input.taskQuota.taskKey, quota_window: input.taskQuota.quotaWindow,
    idempotency_key: input.idempotencyKey, ledger_id: ledger.id }).execute();
  return ledger;
}
export async function grantRewardPoints(db: AppDatabase, input: GrantRewardPointsInput): Promise<LedgerEntry> {
  return db.transaction().execute((tx) => grantRewardPointsInTx(tx, input));
}
function toOrder(order: Selectable<RedemptionOrdersTable>): RedeemOrder {
  return { orderId: order.id, giftId: order.gift_id, giftTitle: order.gift_title, pointsDelta: order.points_cost,
    status: order.status, idempotencyKey: order.idempotency_key, createdAtIso: order.created_at.toISOString() };
}
export async function redeemGiftInSingleTx(db: AppDatabase, input: { userId: string; giftId: string; idempotencyKey: string }): Promise<RedeemOrder> {
  return db.transaction().execute(async (tx) => {
    await lockUser(tx, input.userId);
    await lockIdempotencyKey(tx, input.idempotencyKey);
    const existing = await tx.selectFrom('redemption_orders').selectAll().where('idempotency_key','=',input.idempotencyKey).executeTakeFirst();
    if (existing) {
      if (existing.user_id !== input.userId || existing.gift_id !== input.giftId) throw new ServiceError('IDEMPOTENCY_KEY_CONFLICT');
      return toOrder(existing);
    }
    const gift = await tx.selectFrom('gift_catalog').selectAll().where('id','=',input.giftId).forUpdate().executeTakeFirst();
    if (!gift) throw new ServiceError('GIFT_NOT_FOUND');
    if (gift.stock_remaining < 1) throw new ServiceError('OUT_OF_STOCK');
    if (await getRewardPointsBalance(tx, input.userId) < gift.points_cost) throw new ServiceError('INSUFFICIENT_POINTS');
    const orderId = randomUUID();
    const debitId = randomUUID();
    await tx.insertInto('reward_points_ledger').values({ id: debitId, user_id: input.userId,
      points_delta: -gift.points_cost, reason: 'gift_redemption', idempotency_key: `redeem:${input.idempotencyKey}`,
      related_order_id: orderId, related_attempt_id: null, compensates_ledger_id: null }).execute();
    await tx.updateTable('gift_catalog').set({ stock_remaining: sql<number>`stock_remaining - 1` }).where('id','=',gift.id).execute();
    const order = await tx.insertInto('redemption_orders').values({ id: orderId, user_id: input.userId, gift_id: gift.id,
      gift_title: gift.title, points_cost: gift.points_cost, idempotency_key: input.idempotencyKey,
      debit_ledger_id: debitId, compensation_ledger_id: null, status: 'confirmed' }).returningAll().executeTakeFirstOrThrow();
    return toOrder(order);
  });
}
export async function cancelOrderWithCompensation(db: AppDatabase, input: { userId: string; orderId: string }): Promise<RedeemOrder> {
  return db.transaction().execute(async (tx) => {
    await lockUser(tx, input.userId);
    const order = await tx.selectFrom('redemption_orders').selectAll().where('id','=',input.orderId)
      .where('user_id','=',input.userId).forUpdate().executeTakeFirst();
    if (!order) throw new ServiceError('ORDER_NOT_FOUND');
    if (order.status === 'cancelled_compensated') return toOrder(order);
    await tx.selectFrom('gift_catalog').select('id').where('id','=',order.gift_id).forUpdate().executeTakeFirstOrThrow();
    const compensationId = randomUUID();
    await tx.insertInto('reward_points_ledger').values({ id: compensationId, user_id: input.userId,
      points_delta: order.points_cost, reason: 'redemption_compensation', idempotency_key: `compensate:${order.id}`,
      related_order_id: order.id, related_attempt_id: null, compensates_ledger_id: order.debit_ledger_id }).execute();
    await tx.updateTable('gift_catalog').set({ stock_remaining: sql<number>`stock_remaining + 1` }).where('id','=',order.gift_id).execute();
    const updated = await tx.updateTable('redemption_orders').set({ status: 'cancelled_compensated', compensation_ledger_id: compensationId })
      .where('id','=',order.id).returningAll().executeTakeFirstOrThrow();
    return toOrder(updated);
  });
}
export async function listGiftCatalog(db: AppDatabase): Promise<GiftCatalogItem[]> {
  return (await db.selectFrom('gift_catalog').selectAll().orderBy('id').execute()).map((g) => ({ giftId: g.id,
    title: g.title, description: g.description, pointsCost: g.points_cost, stockRemaining: g.stock_remaining,
    isSampleReward: g.is_sample_reward }));
}
export async function listRedemptionOrders(db: AppDatabase, userId: string): Promise<RedeemOrder[]> {
  return (await db.selectFrom('redemption_orders').selectAll().where('user_id','=',userId).orderBy('created_at','desc').execute()).map(toOrder);
}

export async function listRewardPointsLedger(db: AppDatabase, userId: string, limit = 100): Promise<LedgerEntry[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new ServiceError('INVALID_LEDGER_LIMIT');
  return db.selectFrom('reward_points_ledger').selectAll().where('user_id','=',userId)
    .orderBy('created_at','desc').orderBy('id').limit(limit).execute();
}
