import { expect, type Page } from '@playwright/test';
import { backToLobby, expectSignedOutStart, login, openSettings, openSubpage, visitLobby } from './support/flowHelpers.js';
import { fail, me, ok, profile, test } from './support/mockUi.js';

async function queueLocalUnits(page: Page, answers: string[]) {
  await page.evaluate(async (choices) => {
    const controllerPath = '/src/offline/offlinePracticeController.ts';
    const { OfflineDirectLearningSession } = await import(controllerPath);
    for (const answer of choices) {
      const local = await OfflineDirectLearningSession.create({ subject: 'english', mode: 'standard' });
      let view = local.toView();
      for (let guard = 0; !view.completed && guard < 8; guard++) {
        for (const q of view.currentStep.questions) await local.submit(q.questionId,
          { status: 'submitted', answer, hintUsed: answer === 'A' });
        view = local.toView();
        if (!view.completed) view = await local.advance();
      }
      if (!view.completed) throw new Error('local study did not complete');
    }
  }, answers);
}

test('manual sync preserves two real local units across HTTP retry and keeps legacy data untouched', async ({ page, mock }) => {
  const requests: Array<{ idempotencyKey: string; submissions: Record<string, { answer: unknown; hintUsed?: boolean }> }> = [];
  await mock({
    'POST /api/learning/offline/sync': (route) => {
      const input = route.request().postDataJSON(); requests.push(input);
      if (requests.length === 1) return fail(route, 'OFFLINE_SYNC_RETRY');
      return ok(route, { attemptIds: Object.keys(input.submissions).map((id) => `confirmed:${id}`),
        wrongQuestionIds: [], rewardPointsGranted: 0, isOfflineUnverified: true });
    },
  });
  await visitLobby(page);
  await queueLocalUnits(page, ['A', 'B']);
  const legacy = await page.evaluate(async () => {
    const bridgePath = '/src/platform/hostBridge.ts';
    const { offlineDb } = await import(bridgePath);
    const record = { questionId: 'legacy-unknown', familyId: 'legacy-family', subject: 'english',
      knowledgeNode: 'legacy-node', isCorrect: false, isSkipped: false,
      createdAtIso: '2026-01-01T00:00:00Z', synced: false };
    const id = await offlineDb.offlineAttempts.add(record);
    return { ...record, id };
  });
  await openSubpage(page, 'learning');
  await expect(page.getByTestId('offline-sync-banner')).toContainText('7 条');
  await page.getByTestId('sync-offline-attempts-btn').click();
  await expect(page.getByText(/OFFLINE_SYNC_RETRY/)).toBeVisible();
  await expect(page.getByTestId('sync-offline-attempts-btn')).toBeEnabled();
  await page.getByTestId('sync-offline-attempts-btn').click();
  await expect(page.getByText('已同步 6 条；1 条旧记录缺原始答案，已保留', { exact: true })).toBeVisible();
  await expect(page.getByTestId('offline-sync-banner')).toContainText('1 条');
  expect(requests).toHaveLength(3);
  expect(requests[0]).toEqual(requests[1]);
  expect(requests[1]!.idempotencyKey).not.toBe(requests[2]!.idempotencyKey);
  expect(Object.keys(requests[1]!.submissions)).toEqual(Object.keys(requests[2]!.submissions));
  expect(Object.values(requests[1]!.submissions).every((sub) => sub.answer === 'A' && sub.hintUsed === true)).toBe(true);
  expect(Object.values(requests[2]!.submissions).every((sub) => sub.answer === 'B' && sub.hintUsed === false)).toBe(true);
  const stored = await page.evaluate(async (id) => {
    const path = '/src/platform/hostBridge.ts';
    const { offlineDb } = await import(path);
    return { legacy: await offlineDb.offlineAttempts.get(id), rows: await offlineDb.offlineAttempts.toArray() };
  }, legacy.id);
  expect(stored.legacy).toEqual(legacy);
  expect(stored.rows.filter((row: { synced: boolean }) => row.synced)).toHaveLength(6);
});


test('a failed upload remains owned by its first account and only that account can retry', async ({ page, mock }) => {
  const owner = { username: 'audit_owner', password: 'audit-password', nickname: '队列主人' };
  const peer = { username: 'audit_peer', password: 'audit-password', nickname: '另一位指挥官' };
  const account = (credentials: typeof owner) => ({ ...profile, userId: credentials.username,
    username: credentials.username, nickname: credentials.nickname });
  const requests: Array<{ authorization: string | undefined; input: { idempotencyKey: string; submissions: Record<string, unknown> } }> = [];
  await mock({
    'POST /api/auth/login': (route) => {
      const credentials = route.request().postDataJSON().username === owner.username ? owner : peer;
      const current = account(credentials);
      return ok(route, { token: current.userId, profile: current, userId: current.userId, sessionEpoch: 1, activeSeat: null });
    },
    'GET /api/me': (route) => {
      const credentials = route.request().headers().authorization === `Bearer ${owner.username}` ? owner : peer;
      return ok(route, { ...me, profile: account(credentials) });
    },
    'POST /api/learning/offline/sync': (route) => {
      const input = route.request().postDataJSON();
      requests.push({ authorization: route.request().headers().authorization, input });
      if (requests.length === 1) return fail(route, 'OFFLINE_SYNC_RETRY');
      return ok(route, { attemptIds: Object.keys(input.submissions).map((id) => `confirmed:${id}`),
        wrongQuestionIds: [], rewardPointsGranted: 0, isOfflineUnverified: true });
    },
  }, null);
  const logout = async () => {
    await backToLobby(page);
    const settings = await openSettings(page, 'account');
    await settings.getByTestId('explicit-logout-btn').click();
    await expectSignedOutStart(page);
  };
  await page.goto('/');
  await login(page, owner);
  await expect(page.getByTestId('lobby-page')).toContainText(owner.nickname);
  await queueLocalUnits(page, ['A']);
  await openSubpage(page, 'learning');
  const banner = page.getByTestId('offline-sync-banner');
  const sync = page.getByTestId('sync-offline-attempts-btn');
  await expect(banner).toContainText('3 条');
  await sync.click();
  await expect(page.getByText(/OFFLINE_SYNC_RETRY/)).toBeVisible();
  await logout();
  await login(page, peer);
  await expect(page.getByTestId('lobby-page')).toContainText(peer.nickname);
  await queueLocalUnits(page, ['B']);
  await openSubpage(page, 'learning');
  await expect(banner).toContainText('3 条');
  await sync.click();
  await expect(banner).toHaveCount(0);
  await logout();
  await login(page, owner);
  await expect(page.getByTestId('lobby-page')).toContainText(owner.nickname);
  await openSubpage(page, 'learning');
  await expect(banner).toContainText('3 条');
  await sync.click();
  await expect(banner).toHaveCount(0);
  expect(requests.map((request) => request.authorization)).toEqual([
    `Bearer ${owner.username}`, `Bearer ${peer.username}`, `Bearer ${owner.username}`,
  ]);
  expect(requests[2]).toEqual(requests[0]);
  expect(requests[1]!.input.idempotencyKey).not.toBe(requests[0]!.input.idempotencyKey);
});
