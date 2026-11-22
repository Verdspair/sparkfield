import { expect } from '@playwright/test';
import { apiResponse, openSubpage, settleUi, visitLobby } from './support/flowHelpers.js';
import { deferred, fail, ok, season, test } from './support/mockUi.js';

const board = (nickname: string) => ({
  entries: [{ leaderboardRank: 1, userId: nickname, nickname, tierLabel: '青铜', rankScore: 100 }],
  self: null, isEmpty: false, selfInTopN: false, currentSeasonTerm: season,
});

test('late standard response cannot replace the selected quick board', async ({ page, mock }) => {
  const gate = deferred(); const started = deferred();
  await mock({
    'GET /api/ranking/standard': async (route) => {
      started.resolve(); await gate.promise; await ok(route, board('Standard Player'));
    },
    'GET /api/ranking/quick': (route) => ok(route, board('Quick Player')),
  });
  try {
    await visitLobby(page);
    await openSubpage(page, 'ranking'); await started.promise;
    await page.getByTestId('ranking-tab-quick').click();
    await expect(page.getByTestId('ranking-board-section')).toContainText('Quick Player');
    const response = apiResponse(page, '/api/ranking/standard');
    gate.resolve(); await (await response).finished(); await settleUi(page);
    await expect(page.getByTestId('ranking-tab-quick')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('ranking-board-section')).toContainText('Quick Player');
    await expect(page.getByTestId('ranking-board-section')).not.toContainText('Standard Player');
  } finally { gate.resolve(); }
});

test('failed quick request cannot show the previous standard board under quick', async ({ page, mock }) => {
  const gate = deferred(); const started = deferred();
  await mock({
    'GET /api/ranking/standard': (route) => ok(route, board('Standard Player')),
    'GET /api/ranking/quick': async (route) => {
      started.resolve(); await gate.promise; await fail(route);
    },
  });
  try {
    await visitLobby(page);
    await openSubpage(page, 'ranking');
    await expect(page.getByTestId('ranking-board-section')).toContainText('Standard Player');
    await page.getByTestId('ranking-tab-quick').click(); await started.promise;
    const response = apiResponse(page, '/api/ranking/quick');
    gate.resolve(); await (await response).finished(); await settleUi(page);
    await expect(page.getByTestId('ranking-tab-quick')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('ranking-empty-state')).toBeVisible();
    await expect(page.getByTestId('ranking-board-section')).not.toContainText('Standard Player');
  } finally { gate.resolve(); }
});
