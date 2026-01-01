import { expect, test, type Page } from '@playwright/test';
import { deferred, fail, mockUiPage, ok, season } from './support/mockUi.js';

const settleUi = (page: Page) => page.evaluate(() => new Promise<void>((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

const board = (nickname: string) => ({
  entries: [{ leaderboardRank: 1, userId: nickname, nickname, tierLabel: '青铜', rankScore: 100 }],
  self: null, isEmpty: false, selfInTopN: false, currentSeasonTerm: season,
});

test('late standard response cannot replace the selected quick board', async ({ browser }) => {
  const gate = deferred(); const started = deferred();
  const { page, context, errors } = await mockUiPage(browser, {
    'GET /api/ranking/standard': async (route) => {
      started.resolve(); await gate.promise; await ok(route, board('Standard Player'));
    },
    'GET /api/ranking/quick': (route) => ok(route, board('Quick Player')),
  });
  try {
    await page.goto('/'); await expect(page.getByTestId('lobby-page')).toBeVisible();
    await page.getByTestId('dock-tab-ranking').click(); await started.promise;
    await page.getByTestId('ranking-tab-quick').click();
    await expect(page.getByTestId('ranking-board-section')).toContainText('Quick Player');
    const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/ranking/standard');
    gate.resolve(); await response; await settleUi(page);
    await expect(page.getByTestId('ranking-tab-quick')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('ranking-board-section')).toContainText('Quick Player');
    await expect(page.getByTestId('ranking-board-section')).not.toContainText('Standard Player');
    expect(errors).toEqual([]);
  } finally { gate.resolve(); await context.close(); }
});

test('failed quick request cannot show the previous standard board under quick', async ({ browser }) => {
  const gate = deferred(); const started = deferred();
  const { page, context, errors } = await mockUiPage(browser, {
    'GET /api/ranking/standard': (route) => ok(route, board('Standard Player')),
    'GET /api/ranking/quick': async (route) => {
      started.resolve(); await gate.promise; await fail(route);
    },
  });
  try {
    await page.goto('/'); await expect(page.getByTestId('lobby-page')).toBeVisible();
    await page.getByTestId('dock-tab-ranking').click();
    await expect(page.getByTestId('ranking-board-section')).toContainText('Standard Player');
    await page.getByTestId('ranking-tab-quick').click(); await started.promise;
    const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/ranking/quick');
    gate.resolve(); await response; await settleUi(page);
    await expect(page.getByTestId('ranking-tab-quick')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('ranking-empty-state')).toBeVisible();
    await expect(page.getByTestId('ranking-board-section')).not.toContainText('Standard Player');
    expect(errors).toEqual([]);
  } finally { gate.resolve(); await context.close(); }
});
