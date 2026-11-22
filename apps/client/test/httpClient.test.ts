import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GiftCatalogItem } from '@pkg/contracts';
import { ApiClientError, httpClient, registerSessionInvalidHandler } from '../src/api/httpClient.js';

const gift: GiftCatalogItem = {
  giftId: 'gift-network-check',
  title: '练习本',
  description: '测试礼品',
  pointsCost: 20,
  stockRemaining: 5,
  isSampleReward: true,
};

describe('HTTP transport failures', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    registerSessionInvalidHandler(null);
  });

  it.each([
    ['GET', () => httpClient.getMe()],
    ['PATCH', () => httpClient.updateProfile({ learningStartSelections: { english: 'chapter-2' } })],
    ['login', () => httpClient.login({ username: 'network-check', password: 'test-password' })],
    ['compile preview', () => httpClient.compileCoursePackPreview({ meta: {} })],
  ] as const)('rejects %s network failures with a safe, readable error and no automatic retry', async (_name, request) => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Load failed token=test-token password=test-password'));
    const authInvalid = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    registerSessionInvalidHandler(authInvalid);

    const result = request();
    await expect(result).rejects.toBeInstanceOf(ApiClientError);
    await expect(result).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: '无法完成网络请求，请检查网络或服务器连接后重试。',
    });
    await expect(result).rejects.not.toThrow(/Load failed|test-token|test-password/);
    expect(authInvalid).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a response-body network failure instead of returning a successful PATCH', async () => {
    const response = new Response('{}', { status: 200 });
    vi.spyOn(response, 'text').mockRejectedValue(new TypeError('Load failed'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(httpClient.updateProfile({ onboardingChoice: 'skipped' })).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: expect.stringContaining('网络请求'),
    });
  });

  it.each(['headers', 'body'] as const)('keeps the timeout active until %s finish and rejects without success', async (phase) => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal!;
      const waitForAbort = () => new Promise<never>((_resolve, reject) => {
        signal!.addEventListener('abort', () => reject(signal!.reason), { once: true });
      });
      if (phase === 'headers') return waitForAbort();
      const response = new Response('{}', { status: 200 });
      vi.spyOn(response, 'text').mockImplementation(waitForAbort);
      return Promise.resolve(response);
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = httpClient.updateProfile({ onboardingChoice: 'cards' });
    const rejected = expect(request).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 0,
      code: 'REQUEST_TIMEOUT',
      message: '请求超时，尚未确认操作结果，请稍后重试。',
    });
    await vi.advanceTimersByTimeAsync(11_999);
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(signal!.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    [401, 'SESSION_INVALID', '登录凭证无效'],
    [403, 'FORBIDDEN', '无此操作权限'],
    [422, 'VALIDATION_ERROR', '输入格式不符合要求'],
    [500, 'SERVER_ERROR', 'SERVER_ERROR'],
  ] as const)('keeps HTTP %i as an authoritative error rather than a network failure', async (status, code, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: code }), { status })));

    await expect(httpClient.updateProfile({ onboardingChoice: 'skipped' })).rejects.toMatchObject({
      name: 'ApiClientError',
      status,
      code,
      message: expect.stringContaining(message),
    });
  });

  it('still returns compiler diagnostics for an authoritative 422 response', async () => {
    const payload = { ok: false, diagnostics: [{ file: 'pack-meta.json', line: 1, field: 'title', message: '标题必填' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 422 })));

    await expect(httpClient.compileCoursePackPreview({ meta: {} })).resolves.toEqual(payload);
  });

  it.each(['NETWORK_ERROR', 'REQUEST_TIMEOUT'] as const)('keeps redemption results unconfirmed after %s', async (code) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
      code === 'REQUEST_TIMEOUT' ? new DOMException('Request timeout', 'TimeoutError') : new TypeError('Load failed'),
    ));

    const result = await httpClient.redeemGift({ gift, idempotencyKey: 'network-check' });
    expect(result.outcome).toBe('pending_verify');
    expect(result.order.status).toBe('pending_verify');
  });

  it('does not turn an authoritative redemption denial into pending verification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'INSUFFICIENT_POINTS' }), { status: 409 })));

    await expect(httpClient.redeemGift({ gift, idempotencyKey: 'denied-check' })).rejects.toMatchObject({
      status: 409,
      code: 'INSUFFICIENT_POINTS',
    });
  });

  it('invalidates the current session consistently for compiler-preview 401 responses', async () => {
    const storage = new Map([['blc_auth_token_v1', 'active-token']]);
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    } });
    const invalid = vi.fn();
    registerSessionInvalidHandler(invalid);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'SESSION_SUPERSEDED' }), { status: 401 })));
    await expect(httpClient.compileCoursePackPreview({ meta: {} })).rejects.toMatchObject({ status: 401, code: 'SESSION_SUPERSEDED' });
    expect(invalid).toHaveBeenCalledTimes(1);
    expect(storage.has('blc_auth_token_v1')).toBe(false);
  });

  it('does not let a delayed old-session rejection clear a newer login', async () => {
    const storage = new Map([['blc_auth_token_v1', 'old-token']]);
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    } });
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; })));
    const invalid = vi.fn();
    registerSessionInvalidHandler(invalid);
    const pending = httpClient.getMe();
    storage.set('blc_auth_token_v1', 'new-token');
    finish(new Response(JSON.stringify({ error: 'SESSION_SUPERSEDED' }), { status: 401 }));
    await expect(pending).rejects.toMatchObject({ status: 401, code: 'SESSION_SUPERSEDED' });
    expect(storage.get('blc_auth_token_v1')).toBe('new-token');
    expect(invalid).not.toHaveBeenCalled();
  });

  it('round-trips a confirmed tactician through the profile and member preferences PATCH transport', async () => {
    const preferredTacticianId = 'tactician_europa_fin';
    const profile = { preferredTacticianId, avatarFrameId: 'owned-frame' };
    const lobby = { profile, selfPrefs: { preferredTacticianId }, prepRoom: { members: [{ tacticianId: preferredTacticianId }] } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(profile))
      .mockResolvedValueOnce(Response.json(lobby));
    vi.stubGlobal('fetch', fetchMock);
    await expect(httpClient.updateProfile({ preferredTacticianId })).resolves.toEqual(profile);
    await expect(httpClient.updateMemberPrefs({ preferredTacticianId })).resolves.toEqual(lobby);
    for (const [url, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
      expect(url).toMatch(/\/api\/(auth\/profile|lobby\/member-prefs)$/);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual({ preferredTacticianId });
    }
  });

  it('returns authentication results without mutating the active identity', async () => {
    const storage = new Map([['blc_auth_token_v1', 'current-token']]);
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'login-token' }), { status: 200 })));
    await expect(httpClient.login({ username: 'pilot', password: 'runtime-credential' })).resolves.toMatchObject({ token: 'login-token' });
    expect(storage.get('blc_auth_token_v1')).toBe('current-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    await httpClient.logout();
    expect(storage.get('blc_auth_token_v1')).toBe('current-token');
  });
});
