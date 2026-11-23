import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GiftCatalogItem, ModeStandingSummary } from '@pkg/contracts';
import { App } from '../src/App.js';
import {
  httpClient,
  registerSessionInvalidHandler,
} from '../src/api/httpClient.js';
import { StatusValueText } from '../src/components/StatusValueText.js';
import {
  ENGLISH_STARTER_PACK,
  MATH_STARTER_PACK,
  getStarterAuthoringTemplate,
} from '../src/content/starterPacks.js';
import {
  OfflineDirectLearningSession,
  OfflinePracticeMatchController,
  OnboardingMicroController,
} from '../src/offline/offlinePracticeController.js';
import { AuthPage } from '../src/pages/AuthPage.js';
import { toStageSeatIndex } from '../src/hud/stageSync.js';
import { AppStoreProvider } from '../src/store/appStore.js';
import {
  formatLeaderboardPlaceText,
  formatPointsBalanceDisplay,
  formatQuarterPoints,
  formatRedeemOrderStatus,
  formatStandingBadgeText,
} from '../src/utils/antiFakeZero.js';

describe('@app/client core invariants & controllers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    registerSessionInvalidHandler(null);
  });

  it('enforces Anti-Fake-Zero iron rule across standings, leaderboards, and points', () => {
    const loadingPts = formatPointsBalanceDisplay(null, { loading: true });
    expect(loadingPts.kind).toBe('skeleton');
    expect(renderToStaticMarkup(<StatusValueText value={loadingPts} />)).toContain('stat-skeleton');

    expect(formatPointsBalanceDisplay(undefined)).toEqual({
      kind: 'text',
      text: '待核验',
      muted: true,
    });
    expect(formatPointsBalanceDisplay(null, { offline: true })).toEqual({
      kind: 'text',
      text: '离线不计奖',
      muted: true,
    });
    expect(formatPointsBalanceDisplay(0)).toEqual({
      kind: 'text',
      text: '0',
    });

    const unranked: ModeStandingSummary = {
      seasonTermId: 's1-term-01',
      durationMode: 'standard',
      status: 'unranked',
      tierLabel: '未定级',
      rankScore: null,
      leaderboardRank: null,
      matchesPlayed: 0,
    };
    expect(formatStandingBadgeText(unranked)).toEqual({
      kind: 'text',
      text: '未定级',
      muted: true,
    });
    expect(formatLeaderboardPlaceText(unranked)).toEqual({
      kind: 'text',
      text: '未定级',
      muted: true,
    });

    const rankedUnplaced: ModeStandingSummary = {
      seasonTermId: 's1-term-01',
      durationMode: 'quick',
      status: 'ranked',
      tierLabel: '黄金',
      rankScore: 1560,
      leaderboardRank: null,
      matchesPlayed: 3,
    };
    expect(formatLeaderboardPlaceText(rankedUnplaced)).toEqual({
      kind: 'text',
      text: '未上榜',
      muted: true,
    });
    expect(formatRedeemOrderStatus('pending_verify')).toBe('结果待核验');
    expect(formatQuarterPoints(49)).toBe('12.25');
  });

  it('converts network timeout during gift redemption into pending_verify without faking success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('Network timeout', 'TimeoutError')),
    );

    const testGift: GiftCatalogItem = {
      giftId: 'gift-notebook-01',
      title: '星港精装实验记录本',
      description: '示例兑换物品',
      pointsCost: 20,
      stockRemaining: 5,
      isSampleReward: true,
    };

    const res = await httpClient.redeemGift({
      gift: testGift,
      idempotencyKey: 'idem-timeout-check-001',
      timeoutMs: 50,
    });

    expect(res.outcome).toBe('pending_verify');
    if (res.outcome === 'pending_verify') {
      expect(res.order.status).toBe('pending_verify');
      expect(res.message).toBe('结果待核验，请在兑换订单查看');
    }
  });

  it('triggers global SESSION_SUPERSEDED takeover handler on 401 SESSION_SUPERSEDED', async () => {
    let capturedReason: string | null = null;
    let capturedMsg = '';
    registerSessionInvalidHandler((reason, message) => {
      capturedReason = reason;
      capturedMsg = message;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'SESSION_SUPERSEDED' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(httpClient.getMe()).rejects.toThrow();
    expect(capturedReason).toBe('SESSION_SUPERSEDED');
    expect(capturedMsg).toContain('另一设备登录接管');
  });

  it('maps authoritative 8-seat indices so local player seat is always stage seat 0', () => {
    const seats = ['seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5', 'seat-6', 'seat-7', 'seat-8'];
    expect(toStageSeatIndex('seat-4', 'seat-4', seats)).toBe(0);
    expect(toStageSeatIndex('seat-5', 'seat-4', seats)).toBe(1);
    expect(toStageSeatIndex('seat-3', 'seat-4', seats)).toBe(7);
  });

  it('drives 90s onboarding micro-scenario (merge 2-star + craft Lorentz Railgun) with zero persistence', () => {
    let latestChecklist = {
      mergedTwoStar: false,
      craftedRailgun: false,
      repositionedUnit: false,
    };

    const ctrl = new OnboardingMicroController({
      onUpdate: (_snap, prog) => {
        latestChecklist = prog.checklist;
      },
      onBattle: () => {},
      onFinished: () => {},
    });

    expect(ctrl.scenario.persistence).toBe('none');
    ctrl.start();
    ctrl.advanceStageNow();
    ctrl.submitSampleQuestion({ answer: 'A', status: 'submitted' });
    ctrl.advanceStageNow();

    const buyRes = ctrl.sendCommand({
      type: 'BUY_CARD',
      shopIndex: ctrl.scenario.hints.buyShopIndex,
    });
    expect(buyRes.ok).toBe(true);
    expect(latestChecklist.mergedTwoStar).toBe(true);

    expect(
      ctrl.sendCommand({
        type: 'EQUIP_ITEM',
        inventoryItemIndex: 0,
        targetInstanceId: ctrl.scenario.hints.carryInstanceId,
      }).ok,
    ).toBe(true);
    expect(
      ctrl.sendCommand({
        type: 'EQUIP_ITEM',
        inventoryItemIndex: 0,
        targetInstanceId: ctrl.scenario.hints.carryInstanceId,
      }).ok,
    ).toBe(true);
    expect(latestChecklist.craftedRailgun).toBe(true);

    ctrl.dispose();
  });

  it('runs pure offline standalone 5-step study and offline 8-seat sandbox controller cleanly', async () => {
    expect(ENGLISH_STARTER_PACK.items.length).toBeGreaterThan(0);
    expect(MATH_STARTER_PACK.items.length).toBeGreaterThan(0);
    const tpl = getStarterAuthoringTemplate('english');
    expect(tpl.csvText).toContain('question_id');

    const session = await OfflineDirectLearningSession.create({
      subject: 'english',
      mode: 'quick',
    });
    let view = session.toView();
    expect(view.pausedClockAllowed).toBe(true);

    let guard = 0;
    while (!view.completed && guard < 20) {
      guard += 1;
      if (view.currentStep.questions.length === 0) {
        view = await session.advance();
      } else {
        for (const q of view.currentStep.questions) {
          const res = await session.submit(q.questionId, { status: 'skipped', answer: null });
          view = res.session;
        }
        if (!view.completed) {
          view = await session.advance();
        }
      }
    }
    expect(view.completed).toBe(true);
    expect(view.result?.rewardPointsGranted).toBe(0);

    let snapCount = 0;
    const matchCtrl = new OfflinePracticeMatchController({
      mode: 'quick',
      subject: 'math',
      seed: 42,
      listeners: {
        onSnapshot: () => {
          snapCount += 1;
        },
      },
    });
    await matchCtrl.start();
    expect(snapCount).toBeGreaterThan(0);
    expect(matchCtrl.sendCommand({ type: 'SET_LINEUP_PLAN', unitIds: ['S01', 'S09'] }).ok).toBe(
      true,
    );
    expect(matchCtrl.getSnapshot().self.lineupPlan).toEqual(['S01', 'S09']);
    matchCtrl.dispose();
  });

  it('starts with one calm full-screen entry and defers account fields until intent selection', () => {
    const appHtml = renderToStaticMarkup(<App />);
    expect(appHtml).toContain('data-testid="boot-loading-screen"');

    const authHtml = renderToStaticMarkup(
      <AppStoreProvider>
        <AuthPage />
      </AppStoreProvider>,
    );
    expect(authHtml).toContain('data-testid="auth-tab-login"');
    expect(authHtml).toContain('data-testid="auth-tab-register"');
    expect(authHtml).not.toContain('data-testid="enter-offline-practice-btn"');
    expect(authHtml).toContain('SparkField');
    expect(authHtml).toContain('光锥之外');
    expect(authHtml).not.toContain('data-testid="auth-username-input"');
    expect(authHtml).not.toContain('data-testid="auth-password-input"');
    expect(authHtml).not.toContain('开放自助注册');
  });

  it('renders LobbyPage 3 duration mode cards, Encyclopedia 5 tabs, and RankingPage without private columns', async () => {
    const { LobbyPage } = await import('../src/pages/LobbyPage.js');
    const { EncyclopediaPage } = await import('../src/pages/EncyclopediaPage.js');
    const { RankingPage } = await import('../src/pages/RankingPage.js');

    const lobbyHtml = renderToStaticMarkup(
      <AppStoreProvider>
        <LobbyPage />
      </AppStoreProvider>,
    );
    expect(lobbyHtml).toContain('data-testid="mode-card-quick"');
    expect(lobbyHtml).toContain('data-testid="mode-card-standard"');
    expect(lobbyHtml).toContain('data-testid="mode-card-deep"');
    expect(lobbyHtml).toContain('data-testid="lobby-points-capsule"');
    expect(lobbyHtml).toContain('data-testid="open-join-code-btn"');
    expect(lobbyHtml).not.toContain('HIGH-TEMPO');

    const encHtml = renderToStaticMarkup(
      <AppStoreProvider>
        <EncyclopediaPage />
      </AppStoreProvider>,
    );
    expect(encHtml).toContain('棋子 (36)');
    expect(encHtml).toContain('羁绊 (18)');
    expect(encHtml).toContain('符文 (24)');
    expect(encHtml).toContain('data-testid="enc-tab-lore"');

    const rankHtml = renderToStaticMarkup(
      <AppStoreProvider>
        <RankingPage />
      </AppStoreProvider>,
    );
    expect(rankHtml).toContain('排行榜');
    expect(rankHtml).not.toContain('正确率');
  });

  it('renders MatchStudyBlueprintCard with English micro rounds, reroll button, and lock emphasis', async () => {
    const { MatchStudyBlueprintCard, buildClientStudyBlueprint } = await import(
      '../src/components/MatchStudyBlueprintCard.js'
    );

    const engDeep = buildClientStudyBlueprint({ mode: 'deep', subject: 'english', seed: 0 });
    expect(engDeep).toMatchObject({ arcCount: 5, slotsPerArc: 2 });
    expect(engDeep.arcs.map(arc => arc.slotsInArc)).toEqual([2, 2, 2, 2, 2]);
    expect(engDeep.arcs.every(arc => arc.topicNodeIds.length === 1)).toBe(true);
    const totalSlots = engDeep.arcs.reduce((sum, arc) => sum + arc.slotsInArc, 0);
    expect(totalSlots).toBe(10);

    const unlockedHtml = renderToStaticMarkup(
      <MatchStudyBlueprintCard
        blueprint={engDeep}
        locked={false}
        onRerollPack={() => undefined}
      />,
    );
    expect(unlockedHtml).toContain('data-testid="prep-study-blueprint-card"');
    expect(unlockedHtml).toContain('data-testid="prep-reroll-blueprint-btn"');
    expect(unlockedHtml).toContain('标准进阶档');

    const mathStd = buildClientStudyBlueprint({ mode: 'standard', subject: 'math', seed: 0 });
    expect(mathStd.arcs.map(arc => arc.slotsInArc)).toEqual([4, 4]);
    const lockedHtml = renderToStaticMarkup(
      <MatchStudyBlueprintCard blueprint={mathStd} locked emphasizing compact />,
    );
    expect(lockedHtml).toContain('data-testid="accept-study-blueprint-card"');
    expect(lockedHtml).not.toContain('prep-reroll-blueprint-btn');
  });
});
