import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { GiftCatalogItem, RedeemOrder } from '@pkg/contracts';
import {
  httpClient,
  type RewardsSummaryResponse,
} from '../api/httpClient.js';
import { StatusValueText } from '../components/StatusValueText.js';
import { useAppStore } from '../store/appStore.js';
import {
  formatPointsBalanceDisplay,
  formatRedeemOrderStatus,
} from '../utils/antiFakeZero.js';

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

  return (
    <div className="blc-page-shell blc-redemption-shell" data-testid="redemption-page">
      <header
        className="ui-frosted-panel blc-redemption-header"
        style={{
          borderRadius: 8,
          border: '1px solid rgba(240, 220, 170, 0.22)',
          background: 'rgba(13, 17, 26, 0.78)',
        }}
      >
        <div className="blc-prep-header__left">
          <button
            type="button"
            className="blc-btn blc-btn--ghost blc-btn--sm"
            onClick={closeRedemption}
            data-testid="redemption-back-btn"
          >
            ← {redemptionOriginTab === 'profile' ? '我的' : '大厅'}
          </button>
          <h2 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 600 }}>积分兑换</h2>
        </div>

        <div className="blc-redemption-header__right">
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
      </header>

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

      <div className="blc-enc-body">
        <div className="blc-enc-scroll">
          {isOffline ? (
            <div className="ui-frosted-panel blc-empty-box">离线模式不支持积分兑换</div>
          ) : loading ? (
            <div className="blc-card-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="ui-frosted-panel" style={{ padding: 20, minHeight: 150 }}>
                  <span className="stat-skeleton" style={{ width: '65%', height: 22 }} />
                  <div style={{ marginTop: 14 }}>
                    <span className="stat-skeleton" style={{ width: '100%', height: 48 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : !summary || summary.gifts.length === 0 ? (
            <div className="ui-frosted-panel blc-empty-box">暂无可兑换物品</div>
          ) : (
            <div className="blc-card-grid" data-testid="gift-catalog-grid">
              {summary.gifts.map((gift) => {
                const soldOut = gift.stockRemaining < 1;
                return (
                  <button
                    key={gift.giftId}
                    type="button"
                    className="ui-frosted-panel blc-gift-card"
                    style={{
                      borderRadius: 8,
                      border: '1px solid rgba(240, 220, 170, 0.22)',
                      background: 'rgba(13, 17, 26, 0.78)',
                    }}
                    onClick={() => setInspectGift(gift)}
                    data-testid={`gift-card-${gift.giftId}`}
                  >
                    <div className="blc-gift-card__top">
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
                    <h3 className="blc-gift-card__title" style={{ fontWeight: 600 }}>
                      {gift.title}
                    </h3>
                    <p className="blc-gift-card__desc">{gift.description}</p>
                    <div className="blc-gift-card__foot">
                      <span />
                      <span className="blc-gold-text">{soldOut ? '已兑完' : '兑换 ›'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {drawerMode !== 'none' ? (
          <aside className="blc-enc-drawer" data-testid={`redemption-drawer-${drawerMode}`}>
            <div
              className="ui-frosted-panel blc-drawer-dark"
              style={{ border: '1px solid rgba(240, 220, 170, 0.24)' }}
            >
              <div className="blc-col-head">
                <h3 style={{ fontWeight: 600 }}>
                  {drawerMode === 'ledger' ? '积分明细' : '兑换订单'}
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
            </div>
          </aside>
        ) : null}
      </div>

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
              background: 'rgba(14, 18, 28, 0.92)',
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
    </div>
  );
}
