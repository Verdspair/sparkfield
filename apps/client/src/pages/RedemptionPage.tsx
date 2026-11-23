import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { GiftCatalogItem, RedeemOrder } from '@pkg/contracts';
import {
  httpClient,
  type RewardsSummaryResponse,
} from '../api/httpClient.js';
import { StatusValueText } from '../components/StatusValueText.js';
import { SubpageShell } from '../components/SubpageShell.js';
import { useAppStore } from '../store/appStore.js';
import {
  formatPointsBalanceDisplay,
  formatRedeemOrderStatus,
} from '../utils/antiFakeZero.js';
import './subpages.css';

function GiftArtworkSvg({
  gift,
  size = 78,
}: {
  readonly gift: GiftCatalogItem;
  readonly size?: number;
}): React.JSX.Element {
  const title = gift.title;
  if (title.includes('书签')) {
    return (
      <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
        <path
          d="M32 14 H64 V82 L48 68 L32 82 Z"
          fill="var(--accent-gold)"
          fillOpacity="0.22"
          stroke="var(--accent-gold)"
          strokeWidth="3"
        />
        <circle cx="48" cy="36" r="10" fill="none" stroke="#89a3b8" strokeWidth="2.5" />
        <path d="M48 22 V50 M34 36 H62" stroke="#d3c2a0" strokeWidth="1.5" />
      </svg>
    );
  }
  if (title.includes('记录本') || title.includes('笔记') || title.includes('本')) {
    return (
      <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
        <rect
          x="22"
          y="16"
          width="52"
          height="64"
          rx="4"
          fill="rgba(92, 200, 214, 0.16)"
          stroke="#c8b590"
          strokeWidth="3"
        />
        <line x1="32" y1="16" x2="32" y2="80" stroke="#c8aa6e" strokeWidth="2.5" />
        <circle cx="54" cy="44" r="12" fill="none" stroke="#89a3b8" strokeWidth="2" />
        <ellipse
          cx="54"
          cy="44"
          rx="18"
          ry="6"
          transform="rotate(-24 54 44)"
          fill="none"
          stroke="#c8b590"
          strokeWidth="2"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <polygon
        points="48,14 78,30 78,66 48,82 18,66 18,30"
        fill="rgba(240, 220, 170, 0.16)"
        stroke="#c8b590"
        strokeWidth="3"
      />
      <polygon
        points="48,26 66,36 66,60 48,70 30,60 30,36"
        fill="rgba(92, 200, 214, 0.2)"
        stroke="#89a3b8"
        strokeWidth="2"
      />
      <circle cx="48" cy="48" r="6" fill="#d3c2a0" />
    </svg>
  );
}

export function RedemptionPage(): React.JSX.Element {
  const {
    authMode,
    rewardPointsBalance,
    redemptionOriginTab,
    closeRedemption,
    pendingVerifyOrders,
    recordPendingVerifyOrder,
    reconcileConfirmedOrders,
    refreshMeAndLobby,
    pushToast,
  } = useAppStore();

  const isOffline = authMode === 'offline_practice';

  const [summary, setSummary] = useState<RewardsSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(!isOffline);
  const [drawerMode, setDrawerMode] = useState<'none' | 'ledger' | 'orders'>('none');
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [inspectGift, setInspectGift] = useState<GiftCatalogItem | null>(null);
  const [redeeming, setRedeeming] = useState<boolean>(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (isOffline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await httpClient.getRewardsSummary();
      setSummary(res);
      reconcileConfirmedOrders(res.orders);
      setSelectedGiftId((prev) =>
        prev && res.gifts.some((g) => g.giftId === prev) ? prev : (res.gifts[0]?.giftId ?? null),
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '读取积分目录失败', 'warning');
    } finally {
      setLoading(false);
    }
  }, [isOffline, pushToast, reconcileConfirmedOrders]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const effectiveBalance = summary ? summary.balance : rewardPointsBalance;
  const balanceDisplay = formatPointsBalanceDisplay(effectiveBalance, {
    loading,
    offline: isOffline,
  });

  const mergedOrders: RedeemOrder[] = useMemo(() => {
    const serverOrders = summary?.orders ?? [];
    return [...pendingVerifyOrders, ...serverOrders];
  }, [pendingVerifyOrders, summary?.orders]);

  const featuredGift = useMemo(() => {
    if (!summary || summary.gifts.length === 0) return null;
    return summary.gifts.find((g) => g.giftId === selectedGiftId) ?? summary.gifts[0]!;
  }, [selectedGiftId, summary]);

  const handleConfirmRedeem = async () => {
    if (!inspectGift || redeeming || isOffline) return;
    setRedeeming(true);
    setPendingNotice(null);

    const idempotencyKey = `rdm-${inspectGift.giftId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    try {
      const result = await httpClient.redeemGift({
        gift: inspectGift,
        idempotencyKey,
        timeoutMs: 8_000,
      });

      if (result.outcome === 'pending_verify') {
        recordPendingVerifyOrder(result.order);
        setPendingNotice(result.message);
        setInspectGift(null);
        setDrawerMode('orders');
        pushToast(result.message, 'warning');
        return;
      }

      pushToast(`已兑换 ${result.order.giftTitle}`, 'success');
      setInspectGift(null);
      await Promise.all([loadSummary(), refreshMeAndLobby()]);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '兑换未通过', 'error');
    } finally {
      setRedeeming(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (cancellingOrderId || orderId.startsWith('pending:')) return;
    setCancellingOrderId(orderId);
    try {
      await httpClient.cancelRedemptionOrder(orderId);
      pushToast('订单已取消，积分已退回', 'success');
      await Promise.all([loadSummary(), refreshMeAndLobby()]);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '取消订单失败', 'error');
    } finally {
      setCancellingOrderId(null);
    }
  };

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div className="ui-frosted-panel blc-balance-box" data-testid="redemption-balance-box">
        <span>可用积分</span>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
          <StatusValueText value={balanceDisplay} />
        </strong>
      </div>

      <button
        type="button"
        className={`blc-btn blc-btn--sm ${
          drawerMode === 'ledger' ? 'blc-btn--primary' : 'blc-btn--metal'
        }`}
        onClick={() => setDrawerMode((m) => (m === 'ledger' ? 'none' : 'ledger'))}
        data-testid="open-points-ledger-btn"
      >
        明细 ({summary ? summary.ledger.length : '—'})
      </button>

      <button
        type="button"
        className={`blc-btn blc-btn--sm ${
          drawerMode === 'orders' ? 'blc-btn--primary' : 'blc-btn--metal'
        }`}
        onClick={() => setDrawerMode((m) => (m === 'orders' ? 'none' : 'orders'))}
        data-testid="open-redemption-orders-btn"
      >
        订单 ({summary || pendingVerifyOrders.length ? mergedOrders.length : '—'})
      </button>
    </div>
  );

  return (
    <SubpageShell
      title="积分商城"
      backLabel={redemptionOriginTab === 'profile' ? '返回档案' : '返回大厅'}
      onBack={closeRedemption}
      testId="redemption-page"
      headerActions={headerActions}
    >
      {pendingNotice ? (
        <div className="blc-alert blc-alert--warning" data-testid="pending-verify-banner">
          <span>{pendingNotice}</span>
          <button
            type="button"
            className="blc-btn blc-btn--ghost blc-btn--xs"
            onClick={() => void loadSummary()}
          >
            刷新
          </button>
        </div>
      ) : null}

      {isOffline ? (
        <div className="sf-star-empty">
          <strong>离线模式不支持兑换</strong>
          <span style={{ fontSize: 13 }}>登录后可使用积分兑换礼品。</span>
        </div>
      ) : loading ? (
        <div className="sf-mall-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="sf-card" style={{ padding: 20, minHeight: 190 }}>
              <span className="stat-skeleton" style={{ width: '65%', height: 22 }} />
              <div style={{ marginTop: 14 }}>
                <span className="stat-skeleton" style={{ width: '100%', height: 84 }} />
              </div>
            </div>
          ))}
        </div>
      ) : !summary || summary.gifts.length === 0 ? (
        <div className="sf-star-empty">暂无可兑换物品</div>
      ) : (
        <div className="sf-mall-split">
          <div className="sf-mall-grid" data-testid="gift-catalog-grid">
            {summary.gifts.map((gift) => {
              const soldOut = gift.stockRemaining < 1;
              const isSelected = featuredGift?.giftId === gift.giftId;
              return (
                <button
                  key={gift.giftId}
                  type="button"
                  className={`sf-mall-card ${isSelected ? 'sf-mall-card--selected' : ''}`.trim()}
                  onClick={() => {
                    setSelectedGiftId(gift.giftId);
                    setInspectGift(gift);
                  }}
                  data-testid={`gift-card-${gift.giftId}`}
                >
                  <div className="sf-mall-art-box">
                    <GiftArtworkSvg gift={gift} size={74} />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span className="blc-chip blc-chip--gold">{gift.pointsCost} 积分</span>
                    <span
                      style={{
                        fontSize: 12,
                        color: soldOut ? 'var(--enemy-crimson)' : 'var(--text-muted)',
                      }}
                    >
                      库存 {gift.stockRemaining}
                    </span>
                  </div>

                  <strong style={{ fontSize: 15 }}>{gift.title}</strong>
                  <p className="blc-gift-card__desc" style={{ margin: 0 }}>
                    {gift.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {featuredGift ? (
              <section className="sf-card sf-mall-preview" aria-label="礼品详情预览">
                <div className="sf-mall-preview-stage">
                  <GiftArtworkSvg gift={featuredGift} size={124} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="blc-chip blc-chip--gold">{featuredGift.pointsCost} 积分</span>
                    <span className="blc-chip">剩余库存 {featuredGift.stockRemaining}</span>
                  </div>
                  <h2 style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--gold-light)' }}>
                    {featuredGift.title}
                  </h2>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    {featuredGift.description}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    paddingTop: 12,
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    当前余额：
                    <strong style={{ color: 'var(--gold-light)', marginLeft: 4 }}>
                      <StatusValueText value={balanceDisplay} />
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="sf-gold-cta"
                    disabled={
                      featuredGift.stockRemaining < 1 ||
                      (typeof effectiveBalance === 'number' &&
                        effectiveBalance < featuredGift.pointsCost)
                    }
                    onClick={() => setInspectGift(featuredGift)}
                  >
                    {featuredGift.stockRemaining < 1
                      ? '已兑完'
                      : typeof effectiveBalance === 'number' &&
                          effectiveBalance < featuredGift.pointsCost
                        ? '积分不足'
                        : '确认兑换'}
                  </button>
                </div>
              </section>
            ) : null}

            {drawerMode !== 'none' ? (
              <aside
                className="sf-card sf-section-panel"
                data-testid={`redemption-drawer-${drawerMode}`}
              >
                <div className="blc-col-head">
                  <h3 style={{ margin: 0, fontWeight: 600 }}>
                    {drawerMode === 'ledger' ? '积分明细' : '我的兑换订单'}
                  </h3>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="blc-btn blc-btn--ghost blc-btn--xs"
                      onClick={() => void loadSummary()}
                    >
                      刷新
                    </button>
                    <button
                      type="button"
                      className="blc-btn blc-btn--ghost blc-btn--xs"
                      onClick={() => setDrawerMode('none')}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {drawerMode === 'ledger' ? (
                  !summary || summary.ledger.length === 0 ? (
                    <div className="blc-empty-box">暂无明细记录</div>
                  ) : (
                    <div className="blc-attempt-list">
                      {summary.ledger.map((row) => (
                        <div key={row.id} className="blc-attempt-row">
                          <div>
                            <strong>{row.reason}</strong>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              {new Date(row.created_at).toLocaleString('zh-CN')}
                              {row.compensates_ledger_id ? ' · 退回补偿' : ''}
                            </div>
                          </div>
                          <strong
                            style={{
                              fontVariantNumeric: 'tabular-nums',
                              color:
                                row.points_delta >= 0
                                  ? 'var(--hp-ally-fill)'
                                  : 'var(--gold-light)',
                            }}
                          >
                            {row.points_delta > 0 ? `+${row.points_delta}` : row.points_delta}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )
                ) : mergedOrders.length === 0 ? (
                  <div className="blc-empty-box">暂无订单记录</div>
                ) : (
                  <div className="blc-attempt-list">
                    {mergedOrders.map((ord) => (
                      <div key={ord.orderId} className="blc-attempt-row">
                        <div>
                          <strong>{ord.giftTitle}</strong>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {ord.pointsDelta} 积分 · {formatRedeemOrderStatus(ord.status)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {new Date(ord.createdAtIso).toLocaleString('zh-CN')}
                          </div>
                        </div>

                        {ord.status === 'confirmed' ? (
                          <button
                            type="button"
                            className="blc-btn blc-btn--ghost blc-btn--xs"
                            disabled={cancellingOrderId === ord.orderId}
                            onClick={() => void handleCancelOrder(ord.orderId)}
                            data-testid={`cancel-order-${ord.orderId}`}
                          >
                            {cancellingOrderId === ord.orderId ? '处理中…' : '取消订单'}
                          </button>
                        ) : ord.status === 'pending_verify' ? (
                          <span className="blc-chip blc-chip--gold">待核验</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </aside>
            ) : null}
          </div>
        </div>
      )}

      {inspectGift ? (
        <div
          className="blc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="确认兑换"
          data-testid="gift-confirm-modal"
        >
          <div
            className="ui-frosted-panel blc-dialog-sm"
            style={{
              width: 'min(380px, 92vw)',
              borderRadius: 10,
              border: '1px solid rgba(240, 220, 170, 0.28)',
              background: 'rgba(14, 18, 28, 0.94)',
            }}
          >
            <div className="blc-dialog-sm__head">
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>确认兑换</h3>
              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--xs"
                onClick={() => setInspectGift(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ margin: '8px 0 16px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <span className="blc-chip blc-chip--gold">{inspectGift.pointsCost} 积分</span>
                <span className="blc-chip">库存 {inspectGift.stockRemaining}</span>
              </div>
              <h4 style={{ margin: '6px 0', fontSize: 16 }}>{inspectGift.title}</h4>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                {inspectGift.description}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--sm"
                disabled={redeeming}
                onClick={() => setInspectGift(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="blc-btn blc-btn--primary blc-btn--sm"
                disabled={
                  redeeming ||
                  inspectGift.stockRemaining < 1 ||
                  (typeof effectiveBalance === 'number' &&
                    effectiveBalance < inspectGift.pointsCost)
                }
                onClick={() => void handleConfirmRedeem()}
                data-testid="confirm-redeem-tx-btn"
              >
                {redeeming
                  ? '处理中…'
                  : inspectGift.stockRemaining < 1
                    ? '库存不足'
                    : typeof effectiveBalance === 'number' &&
                        effectiveBalance < inspectGift.pointsCost
                      ? '积分不足'
                      : '确认兑换'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SubpageShell>
  );
}
