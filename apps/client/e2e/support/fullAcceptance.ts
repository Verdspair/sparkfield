import { randomUUID } from 'node:crypto';
import { expect, test as base, type Locator, type Page } from '@playwright/test';
import type { GiftCatalogItem, RedeemOrder, UserProfile } from '@pkg/contracts';
import type { MatchRoomSnapshot } from '../../src/api/matchSocket.js';
import english from '../../../../content/courses/compiled/english-core-starter.json' with { type: 'json' };
import math from '../../../../content/courses/compiled/math-core-starter.json' with { type: 'json' };
import type { BoardStageEngine } from '../../src/stage/BoardStageEngine.js';
import { closeSettings, localToken, openSettings } from './flowHelpers.js';
import { expectShopGeometry } from './shopGeometry.js';

export { english };

export function newPilot(nickname: string) {
  return { username: `pilot_${randomUUID().replaceAll('-', '').slice(0, 16)}`, password: randomUUID(), nickname };
}

export function watchPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  return errors;
}

export const test = base.extend<{ checkedPage: Page; newPeer: () => Promise<Page> }>({
  checkedPage: async ({ page }, use) => {
    const errors = watchPageErrors(page);
    await use(page);
    expect(errors).toEqual([]);
  },
  newPeer: async ({ browser, baseURL, viewport }, use) => {
    const peers: Array<{ context: Awaited<ReturnType<typeof browser.newContext>>; errors: string[] }> = [];
    try {
      await use(async () => {
        const context = await browser.newContext({ baseURL, viewport });
        const page = await context.newPage();
        peers.push({ context, errors: watchPageErrors(page) });
        return page;
      });
    } finally {
      await Promise.all(peers.map(({ context }) => context.close()));
      expect(peers.flatMap(({ errors }) => errors)).toEqual([]);
    }
  },
});

export function apiUrl(path: string) {
  const origin = process.env.E2E_API_ORIGIN;
  if (!origin) throw new Error('E2E_API_ORIGIN is required');
  return new URL(path, origin).href;
}

export async function authenticatedApi(page: Page) {
  await expect.poll(() => localToken(page)).toBeTruthy();
  const headers = { Authorization: `Bearer ${await localToken(page)}` };
  return async <T>(path: string, data?: unknown): Promise<T> => {
    const response = data === undefined
      ? await page.request.get(apiUrl(path), { headers })
      : await page.request.post(apiUrl(path), { headers, data });
    expect(response.ok(), `${response.status()} ${path}`).toBe(true);
    return await response.json() as T;
  };
}

export type ProfileRead = { profile: UserProfile; rewardPointsBalance: number };
export type RewardRead = {
  balance: number;
  gifts: GiftCatalogItem[];
  orders: RedeemOrder[];
  ledger: Array<{ reason: string; related_order_id: string | null; points_delta: number }>;
};

const items = new Map([...english.items, ...math.items].map((item) => [item.questionId, item]));

export async function answerQuestion(card: Locator) {
  const id = await card.getAttribute('data-question-id');
  const item = id ? items.get(id) : undefined;
  if (!item) throw new Error(`No answer fixture for ${id}`);
  const answer = item.answerSpec.trim();
  switch (item.questionType) {
    case 'single_choice':
    case 'multi_choice':
      for (const key of answer.split('|')) await card.getByTestId(`option-${key.trim()}`).click();
      break;
    case 'short_fill':
      await card.getByTestId('short-fill-input').fill(answer.split('|')[0]!.trim());
      break;
    case 'numeric':
      await card.getByTestId('numeric-input').fill(answer.split(':')[0]!.trim());
      break;
    case 'multi_step_numeric':
      for (const part of answer.split(';')) {
        const [step, value] = part.split('=');
        await card.getByTestId(`multistep-input-${step!.trim()}`).fill(value!.trim());
      }
      break;
    case 'matching':
      for (const part of answer.split(';')) {
        const [left, right] = part.split('=');
        const matching = card.getByTestId('matching-board');
        await matching.getByTestId(/^match-left-/).filter({ hasText: left!.trim() }).click();
        await matching.getByTestId(/^match-right-/).filter({ hasText: right!.trim() }).click();
      }
      break;
    default:
      throw new Error(`Unsupported question type for ${id}: ${item.questionType}`);
  }
  await card.getByTestId('submit-answer-btn').click();
  await expect(card.getByTestId('question-feedback-box')).toContainText('回答正确');
}

export async function completeLesson(overlay: Locator, complete: Locator) {
  const card = overlay.getByTestId('question-step-card');
  const ready = card.locator('button[data-testid="advance-step-btn"]:enabled').or(card.getByTestId('submit-answer-btn'));
  const steps = new Set<string>();
  for (let stepsLeft = 24; stepsLeft > 0; stepsLeft--) {
    await expect(ready.first().or(complete).first()).toBeVisible();
    if (await complete.isVisible()) return steps;
    steps.add((await card.getAttribute('data-step-kind'))!);
    if (await card.getByTestId('submit-answer-btn').isVisible()) await answerQuestion(card);
    if (!(await complete.isVisible())) await card.getByTestId('advance-step-btn').click();
  }
  throw new Error('Lesson did not finish');
}

export async function setShopDock(page: Page, position: 'top' | 'bottom', inMatch = false) {
  const settings = await openSettings(page, 'match', inMatch);
  await settings.getByTestId(`shop-dock-${position}-btn`).click();
  await expect(settings.getByRole('radio', { checked: true })).toHaveAttribute('data-testid', `shop-dock-${position}-btn`);
  await expect(settings.getByTestId('shop-layout-diagram')).toHaveAttribute('data-position', position);
  await closeSettings(page);
}

export async function exerciseShopDock(page: Page, position: 'top' | 'bottom') {
  const shop = page.getByTestId('strategy-shop-dock');
  await expectShopGeometry(page, position);
  await shop.getByTestId('toggle-shop-collapse-btn').click();
  await expect(shop).toBeHidden();
  const expand = position === 'top'
    ? page.getByTestId('floating-shop-toggle-btn')
    : page.getByTestId('hud-economy-capsule').getByTestId('toggle-shop-collapse-btn');
  await expand.click();
  await expectShopGeometry(page, position);
}

export async function finishOfflineMatch(page: Page) {
  const summary = page.getByTestId('match-summary-modal');
  const shop = page.getByTestId('strategy-shop-dock');
  const phase = page.getByTestId('hud-phase-capsule').locator('.blc-phase-label');
  let checkedShop = false;
  for (let phasesLeft = 55; phasesLeft > 0 && !(await summary.isVisible()); phasesLeft--) {
    const choice = page.getByTestId('choice-event-modal');
    if (await choice.isVisible()) {
      const pick = choice.getByTestId('pick-augment-0').or(choice.getByTestId('pick-anvil-0')).first();
      if (await pick.isVisible()) await pick.click();
      const peek = choice.getByTestId('peek-battlefield-btn');
      if (await peek.isVisible()) await peek.click();
      await expect(choice).toBeHidden();
    }
    if (!checkedShop && await shop.isVisible()) {
      await exerciseShopDock(page, 'top');
      await setShopDock(page, 'bottom', true);
      await exerciseShopDock(page, 'bottom');
      checkedShop = true;
    }
    const before = await phase.textContent();
    await page.getByTestId('offline-skip-phase-btn').click();
    await expect.poll(async () => (await summary.isVisible()) || (await phase.textContent()) !== before).toBe(true);
  }
  expect(checkedShop).toBe(true);
  await expect(summary.getByTestId('summary-competitive-col')).toBeVisible();
  await expect(summary.getByTestId('summary-learning-col')).toBeVisible();
  return summary;
}

type StageWindow = Window & { __getStageEngine?: () => BoardStageEngine };

export const readStage = (page: Page) => page.evaluate(() => {
  const engine = (window as StageWindow).__getStageEngine?.();
  return engine ? { ...engine.getPerfStats(), arena: engine.getArenaTheme(), tactician: engine.getTacticianId() } : null;
});

export const readMatch = async (page: Page) => {
  const api = await authenticatedApi(page);
  return (await api<{ activeSeat: MatchRoomSnapshot | null }>('/api/matches/active')).activeSeat;
};
