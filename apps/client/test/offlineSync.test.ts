import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { httpClient } from '../src/api/httpClient.js';
import { ENGLISH_STARTER_PACK } from '../src/content/starterPacks.js';
import { OfflineDirectLearningSession, buildOfflineLearningDashboard, getUnsyncedOfflineAttemptCount, syncPendingOfflineAttemptsToServer } from '../src/offline/offlinePracticeController.js';
import { clearAllPrivateSessionCache, offlineDb, type OfflineAttemptQueueItem } from '../src/platform/hostBridge.js';

let rows: OfflineAttemptQueueItem[];
let token: string | null;
let nextId: number;
let failMark: boolean;
const legacy = (): OfflineAttemptQueueItem => ({ id: nextId++, questionId: 'ENG_Q03', familyId: 'family',
  subject: 'english', knowledgeNode: 'node', isCorrect: false, isSkipped: false,
  createdAtIso: '2026-01-01T00:00:00Z', synced: false });
const queued = (key: string, answer: unknown, questionId = 'ENG_Q03') => ({ ...legacy(), questionId,
  packId: ENGLISH_STARTER_PACK.manifest.packId, coursePackVersion: ENGLISH_STARTER_PACK.manifest.coursePackVersion,
  nodeAttemptKey: key, submission: { answer, status: answer === null ? 'skipped' : 'submitted', hintUsed: false },
}) as OfflineAttemptQueueItem;
const confirm = async (input: Parameters<typeof httpClient.syncOfflineAttempts>[0]) => ({
  attemptIds: Object.keys(input.submissions).map((id) => `attempt:${id}`), wrongQuestionIds: [],
  rewardPointsGranted: 0 as const, isOfflineUnverified: true as const,
});
async function completeLocal(answer: string, hintUsed: boolean) {
  const local = await OfflineDirectLearningSession.create({ subject: 'english', mode: 'standard' });
  let view = local.toView();
  for (let guard = 0; !view.completed && guard < 8; guard++) {
    for (const q of view.currentStep.questions) await local.submit(q.questionId, { status: 'submitted', answer, hintUsed });
    view = local.toView();
    if (!view.completed) view = await local.advance();
  }
  expect(view.completed).toBe(true);
}

describe('lossless manual offline attempt synchronization', () => {
  beforeEach(() => {
    rows = []; token = 'token-a'; nextId = 1; failMark = false;
    vi.stubGlobal('window', { localStorage: {
      getItem: () => token, setItem: (_key: string, value: string) => { token = value; }, removeItem: () => { token = null; },
    } });
    vi.spyOn(offlineDb.fsrsCards, 'toArray').mockResolvedValue([]);
    vi.spyOn(offlineDb.fsrsCards, 'put').mockResolvedValue('card');
    vi.spyOn(offlineDb.fsrsCards, 'clear').mockResolvedValue(undefined);
    vi.spyOn(offlineDb.offlineAttempts, 'add').mockImplementation((item) => {
      const id = nextId++; rows.push(structuredClone({ ...item, id })); return Dexie.Promise.resolve(id);
    });
    vi.spyOn(offlineDb.offlineAttempts, 'toArray').mockImplementation(() => Dexie.Promise.resolve(structuredClone(rows)));
    vi.spyOn(offlineDb.offlineAttempts, 'get').mockImplementation(((id: number) =>
      Dexie.Promise.resolve(structuredClone(rows.find((row) => row.id === id)))) as typeof offlineDb.offlineAttempts.get);
    vi.spyOn(offlineDb.offlineAttempts, 'update').mockImplementation((id, changes) => {
      if (failMark && 'synced' in changes) { failMark = false; throw new Error('local mark failed'); }
      const row = rows.find((item) => item.id === id);
      if (!row) return Dexie.Promise.resolve(0);
      Object.assign(row, changes); return Dexie.Promise.resolve(1);
    });
    vi.spyOn(offlineDb.offlineAttempts, 'clear').mockImplementation(() => { rows = []; return Dexie.Promise.resolve(undefined); });
    vi.spyOn(offlineDb, 'transaction').mockImplementation((async (...args: unknown[]) => {
      const before = structuredClone(rows);
      try { return await (args.at(-1) as () => Promise<unknown>)(); }
      catch (err) { rows = before; throw err; }
    }) as typeof offlineDb.transaction);
    vi.spyOn(httpClient, 'syncOfflineAttempts').mockImplementation(confirm);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('keeps two real learning units with the same question ids and their original submissions', async () => {
    await completeLocal('A', true); await completeLocal('B', false);
    expect(rows).toHaveLength(6);
    const raw = rows as Array<OfflineAttemptQueueItem & { submission: unknown; nodeAttemptKey: string; packId: string }>;
    expect(raw.slice(0, 3).map((row) => row.submission)).toEqual(Array(3).fill({ status: 'submitted', answer: 'A', hintUsed: true }));
    expect(raw.slice(3).map((row) => row.submission)).toEqual(Array(3).fill({ status: 'submitted', answer: 'B', hintUsed: false }));
    expect(new Set(raw.map((row) => row.nodeAttemptKey)).size).toBe(2);
    expect(raw.every((row) => row.packId === ENGLISH_STARTER_PACK.manifest.packId)).toBe(true);
    await expect(syncPendingOfflineAttemptsToServer('student-a')).resolves.toEqual({ syncedCount: 6, legacyCount: 0 });
    const calls = vi.mocked(httpClient.syncOfflineAttempts).mock.calls.map(([input]) => input);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.idempotencyKey).not.toBe(calls[1]!.idempotencyKey);
    expect(Object.keys(calls[0]!.submissions)).toEqual(Object.keys(calls[1]!.submissions));
    expect(Object.values(calls[0]!.submissions).every((sub) => sub.answer === 'A' && sub.hintUsed === true)).toBe(true);
    expect(Object.values(calls[1]!.submissions).every((sub) => sub.answer === 'B' && sub.hintUsed === false)).toBe(true);
    expect(rows.every((row) => row.synced)).toBe(true);
  });

  it('sends typed arrays, maps, numeric text, and explicit skips without reconstructing answers', async () => {
    const answers = ['A', ['A', 'B'], { 左: '右' }, '原始填空', '4.5 kg', { first: '2', second: '3' }, null];
    rows = answers.map((answer, index) => queued('typed-node-attempt', answer, `question-${index}`));
    await syncPendingOfflineAttemptsToServer('student-a');
    const payload = vi.mocked(httpClient.syncOfflineAttempts).mock.calls[0]![0];
    expect(Object.values(payload.submissions).map((sub) => sub.answer)).toEqual(answers);
    expect(payload.coursePackVersion).toBe(ENGLISH_STARTER_PACK.manifest.coursePackVersion);
    expect(Object.values(payload.submissions).at(-1)?.status).toBe('skipped');
  });

  it('retries a network failure with the exact same key and payload and marks nothing early', async () => {
    rows = [queued('retry-node-attempt', { first: '2' })];
    vi.mocked(httpClient.syncOfflineAttempts).mockRejectedValueOnce(new Error('network failed'));
    await expect(syncPendingOfflineAttemptsToServer('student-a')).rejects.toThrow('network failed');
    expect(rows[0]!.synced).toBe(false);
    await syncPendingOfflineAttemptsToServer('student-a');
    const calls = vi.mocked(httpClient.syncOfflineAttempts).mock.calls;
    expect(calls[0]![0]).toEqual(calls[1]![0]);
    expect(rows[0]!.synced).toBe(true);
  });

  it('retries the full unit after local marking fails, including already confirmed siblings', async () => {
    rows = [queued('mark-node-attempt', 'A', 'ENG_Q01'), queued('mark-node-attempt', 'B')];
    failMark = true;
    await expect(syncPendingOfflineAttemptsToServer('student-a')).rejects.toThrow('local mark failed');
    rows[0]!.synced = true;
    await syncPendingOfflineAttemptsToServer('student-a');
    const calls = vi.mocked(httpClient.syncOfflineAttempts).mock.calls;
    expect(calls[0]![0]).toEqual(calls[1]![0]);
    expect(rows.every((row) => row.synced)).toBe(true);
  });

  it('marks only ids from the confirmed snapshot and rejects incomplete confirmation', async () => {
    rows = [queued('ack-node-attempt', 'A')];
    vi.mocked(httpClient.syncOfflineAttempts).mockResolvedValueOnce({ attemptIds: [], wrongQuestionIds: [], rewardPointsGranted: 0, isOfflineUnverified: true });
    await expect(syncPendingOfflineAttemptsToServer('student-a')).rejects.toThrow();
    expect(rows[0]!.synced).toBe(false);
    vi.mocked(httpClient.syncOfflineAttempts).mockImplementationOnce(async (input) => {
      rows.push(queued('later-node-attempt', 'B'));
      return confirm(input);
    });
    await syncPendingOfflineAttemptsToServer('student-a');
    expect(rows.map((row) => row.synced)).toEqual([true, false]);
  });

  it('preserves legacy records without guessing answers, including explicit private-cache clearing', async () => {
    rows = [legacy()]; const before = structuredClone(rows);
    await expect(syncPendingOfflineAttemptsToServer('student-a')).resolves.toEqual({ syncedCount: 0, legacyCount: 1 });
    expect(httpClient.syncOfflineAttempts).not.toHaveBeenCalled();
    expect(rows).toEqual(before);
    await clearAllPrivateSessionCache();
    expect(rows).toEqual(before);
  });

  it('does not import another account owned unit or mark a response after the session changed', async () => {
    rows = [queued('owned-node-attempt', 'A')];
    vi.mocked(httpClient.syncOfflineAttempts).mockRejectedValueOnce(new Error('network failed'));
    await expect(syncPendingOfflineAttemptsToServer('student-a')).rejects.toThrow();
    token = 'token-b';
    await syncPendingOfflineAttemptsToServer('student-b');
    expect(httpClient.syncOfflineAttempts).toHaveBeenCalledTimes(1);
    expect(rows[0]!.synced).toBe(false);
    token = 'token-a';
    vi.mocked(httpClient.syncOfflineAttempts).mockImplementationOnce(async (input) => {
      token = 'token-b'; return confirm(input);
    });
    await expect(syncPendingOfflineAttemptsToServer('student-a')).rejects.toThrow();
    expect(rows[0]!.synced).toBe(false);
  });

  it('shows owned attempts only to their account and keeps them hidden after logout or in offline mode', async () => {
    const a = { ...legacy(), questionId: 'private-a', syncUserId: 'student-a' };
    const b = { ...legacy(), questionId: 'private-b', syncUserId: 'student-b' };
    const anonymous = { ...legacy(), questionId: 'anonymous-local' };
    rows = [a, b, anonymous];
    const before = structuredClone(rows);
    expect(await getUnsyncedOfflineAttemptCount('student-a')).toBe(2);
    expect(await getUnsyncedOfflineAttemptCount('student-b')).toBe(2);
    expect(await getUnsyncedOfflineAttemptCount('')).toBe(1);
    const aDashboard = await buildOfflineLearningDashboard('student-a');
    expect(aDashboard.recentAttempts.map((row) => row.question_id).sort()).toEqual(['anonymous-local', 'private-a']);
    await clearAllPrivateSessionCache();
    const offline = await buildOfflineLearningDashboard();
    expect(offline.recentAttempts.map((row) => row.question_id)).toEqual(['anonymous-local']);
    expect(offline.wrongQuestions.map((row) => row.question_id)).toEqual(['anonymous-local']);
    expect(await getUnsyncedOfflineAttemptCount('')).toBe(1);
    token = 'token-b';
    const bDashboard = await buildOfflineLearningDashboard('student-b');
    expect(bDashboard.recentAttempts.map((row) => row.question_id).sort()).toEqual(['anonymous-local', 'private-b']);
    expect(bDashboard.wrongQuestions.map((row) => row.question_id)).not.toContain('private-a');
    await expect(syncPendingOfflineAttemptsToServer('student-b')).resolves.toEqual({ syncedCount: 0, legacyCount: 2 });
    expect(httpClient.syncOfflineAttempts).not.toHaveBeenCalled();
    expect(rows).toEqual(before);
  });
});
