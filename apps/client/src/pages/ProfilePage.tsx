import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  SEASON1_AUGMENTS,
  SEASON1_UNITS_BY_ID,
  lookupItemById,
} from '@pkg/contracts';
import { httpClient, type MatchHistoryItem } from '../api/httpClient.js';
import { StatusValueText } from '../components/StatusValueText.js';
import { GameUiIcon } from '../components/GameUiIcons.js';
import { SubpageShell } from '../components/SubpageShell.js';
import { TacticianPortrait, UnitPortrait } from '../components/UnitPortrait.js';
import { TACTICIAN_CATALOG } from '../stage/index.js';
import { useAppStore } from '../store/appStore.js';
import {
  DURATION_MODE_SHORT_LABELS,
  QUEUE_TYPE_LABELS,
  formatPointsBalanceDisplay,
  formatQuarterPoints,
  formatStandingBadgeText,
} from '../utils/antiFakeZero.js';
import './subpages.css';

const AdminPackDrawer = lazy(() =>
  import('./AdminPackDrawer.js').then((m) => ({ default: m.AdminPackDrawer })),
);

export function ProfilePage(): React.JSX.Element {
  const {
    authMode,
    profile,
    rewardPointsBalance,
    standings,
    dataLoading,
    preferredTacticianId,
    audioBus,
    openRedemption,
    openSettings,
    setActiveTab,
    patchUserProfile,
    logout,
    pushToast,
  } = useAppStore();

  const isOffline = authMode === 'offline_practice';
  const isStaff = profile?.role === 'admin' || profile?.role === 'editor';

  const [nicknameDraft, setNicknameDraft] = useState<string>(profile?.nickname ?? '');
  const [editingNickname, setEditingNickname] = useState<boolean>(false);
  const [savingNickname, setSavingNickname] = useState<boolean>(false);

  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(!isOffline);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const [pwdModalOpen, setPwdModalOpen] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [changingPwd, setChangingPwd] = useState<boolean>(false);

  const [adminWorkbenchOpen, setAdminWorkbenchOpen] = useState<boolean>(false);

  useEffect(() => {
    setNicknameDraft(profile?.nickname ?? '');
  }, [profile?.nickname]);

  useEffect(() => {
    if (isOffline) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    void httpClient
      .getMatchHistory()
      .then((rows) => setHistory(rows))
      .catch(() => undefined)
      .finally(() => setHistoryLoading(false));
  }, [isOffline]);

  const handleSaveNickname = async () => {
    const trimmed = nicknameDraft.trim();
    if (!trimmed || savingNickname) return;
    audioBus.emit('onUiFeedback', { kind: 'click' });
    setSavingNickname(true);
    try {
      await patchUserProfile({ nickname: trimmed });
      setEditingNickname(false);
      pushToast('昵称已更新', 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '更新昵称失败', 'error');
    } finally {
      setSavingNickname(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    audioBus.emit('onUiFeedback', { kind: 'click' });
    setChangingPwd(true);
    try {
      const res = await httpClient.changePassword({ currentPassword, newPassword });
      setPwdModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      pushToast('密码已更新，请重新登录', 'success');
      if (res.loginRequired) {
        await logout();
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '修改密码未通过', 'error');
    } finally {
      setChangingPwd(false);
    }
  };

  const handleOpenCollection = () => {
    try {
      window.sessionStorage.setItem('sf_enc_open_tab', 'tacticians');
    } catch {
    }
    setActiveTab('encyclopedia');
  };

  const pointsDisplay = formatPointsBalanceDisplay(rewardPointsBalance, {
    loading: dataLoading,
    offline: isOffline,
  });

  const equippedTactician =
    TACTICIAN_CATALOG.find((t) => t.id === preferredTacticianId) ?? TACTICIAN_CATALOG[0]!;

  return (
    <SubpageShell
      title="个人档案"
      testId="profile-page"
    >
      <div className="sf-profile-grid">
        <section className="sf-card sf-profile-banner-card" aria-label="个人名片">
          <div className="sf-profile-tactician-stage">
            <TacticianPortrait
              tacticianId={preferredTacticianId}
              size="lg"
              alt={equippedTactician.name}
            />
            <div>
              <span className="blc-chip blc-chip--gold" style={{ fontSize: 11 }}>
                {equippedTactician.name}
              </span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {editingNickname ? (
                <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    className="blc-input"
                    style={{ minHeight: 34, width: 150 }}
                    maxLength={24}
                    disabled={savingNickname}
                    value={nicknameDraft}
                    onChange={(e) => setNicknameDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    className="blc-btn blc-btn--primary blc-btn--xs"
                    onClick={() => void handleSaveNickname()}
                    disabled={savingNickname}
                  >
                    {savingNickname ? '保存中…' : '保存'}
                  </button>
                  <button
                    type="button"
                    className="blc-btn blc-btn--ghost blc-btn--xs"
                    onClick={() => {
                      audioBus.emit('onUiFeedback', { kind: 'close' });
                      setEditingNickname(false);
                    }}
                  >
                    取消
                  </button>
                </span>
              ) : (
                <>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                    {profile?.nickname ?? '领航员'}
                  </h2>
                  <button
                    type="button"
                    className="blc-btn blc-btn--ghost blc-btn--xs"
                    onClick={() => {
                      audioBus.emit('onUiFeedback', { kind: 'click' });
                      setEditingNickname(true);
                    }}
                  >
                    改名
                  </button>
                </>
              )}
              {profile?.role === 'admin' ? (
                <span className="blc-chip blc-chip--gold">管理员</span>
              ) : profile?.role === 'editor' ? (
                <span className="blc-chip blc-chip--gold">编辑</span>
              ) : null}
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
              {profile?.username ?? '—'}
              {profile?.emailMasked ? ` · ${profile.emailMasked}` : ''}
            </div>
          </div>

          <div className="sf-profile-rank-row">
            {(['quick', 'standard', 'deep'] as const).map((m) => {
              const st = standings.find((s) => s.durationMode === m) ?? null;
              return (
                <div key={m} className="sf-stat-pill" style={{ minWidth: 0, padding: '8px 10px' }}>
                  <span>{DURATION_MODE_SHORT_LABELS[m]}</span>
                  <strong style={{ fontSize: 13 }}>
                    {isOffline ? (
                      <span style={{ color: 'var(--text-secondary)' }}>离线</span>
                    ) : (
                      <StatusValueText value={formatStandingBadgeText(st, dataLoading)} />
                    )}
                  </strong>
                </div>
              );
            })}
          </div>

          <div
            className="ui-frosted-panel"
            style={{
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>学习积分</div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--gold-light)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <StatusValueText value={pointsDisplay} />
              </div>
            </div>
            <button
              type="button"
              className="sf-gold-cta"
              style={{ minHeight: 34, padding: '0 16px', fontSize: 13 }}
              onClick={() => openRedemption('profile')}
              data-testid="profile-open-redemption-btn"
            >
              积分兑换
            </button>
          </div>

          <div className="sf-profile-quick-actions">
            <button
              type="button"
              className="sf-secondary-cta"
              style={{ minHeight: 38, fontSize: 13 }}
              onClick={handleOpenCollection}
              data-testid="profile-open-collection-btn"
            >
              <GameUiIcon name="wardrobe" size={14} />
              <span>前往藏品换装</span>
            </button>
            <button
              type="button"
              className="sf-secondary-cta"
              style={{ minHeight: 38, fontSize: 13 }}
              onClick={() => openSettings('display')}
              data-testid="profile-open-settings-btn"
            >
              <GameUiIcon name="gear" size={14} />
              <span>打开全部设置</span>
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              paddingTop: 12,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              className={`blc-btn ${isStaff ? 'blc-btn--primary' : 'blc-btn--metal'} blc-btn--xs`}
              onClick={() => {
                audioBus.emit('onUiFeedback', { kind: 'open' });
                setAdminWorkbenchOpen(true);
              }}
              data-testid="open-admin-workbench-btn"
            >
              题库工作台
            </button>

            {!isOffline ? (
              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--xs"
                onClick={() => {
                  audioBus.emit('onUiFeedback', { kind: 'open' });
                  setPwdModalOpen(true);
                }}
                data-testid="open-change-password-btn"
              >
                修改密码
              </button>
            ) : null}

            <button
              type="button"
              className="blc-btn blc-btn--ghost blc-btn--xs"
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                audioBus.emit('onUiFeedback', { kind: 'click' });
                void logout();
              }}
              data-testid="explicit-logout-btn"
            >
              {isOffline ? '退出试玩' : '退出登录'}
            </button>
          </div>
        </section>

        <section
          className="sf-card sf-section-panel"
          data-testid="profile-account-section"
        >
          <div className="blc-col-head">
            <h3 style={{ margin: 0, fontWeight: 600 }}>近期战绩</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {isOffline ? '离线模式' : `共 ${history.length} 场`}
            </span>
          </div>

          {isOffline ? (
            <div className="sf-star-empty">
              <strong>离线模式不记录战绩</strong>
              <span style={{ fontSize: 12.5 }}>登录后参与对局即可保存完整阵容与学习战绩。</span>
            </div>
          ) : historyLoading ? (
            <span className="stat-skeleton" style={{ width: '100%', height: 72 }} />
          ) : history.length === 0 ? (
            <div className="sf-star-empty">
              <strong>暂无战绩记录</strong>
              <span style={{ fontSize: 12.5 }}>前往大厅开启一场对局，战绩将自动记录在此处。</span>
            </div>
          ) : (
            <div className="blc-attempt-list">
              {history.map((item) => {
                const expanded = expandedMatchId === item.matchId;
                const snap = item.finalBoardSnapshot;
                return (
                  <div key={item.matchId} className="ui-frosted-panel blc-history-card">
                    <button
                      type="button"
                      className="blc-history-card__summary"
                      onClick={() => {
                        audioBus.emit('onUiFeedback', {
                          kind: expandedMatchId === item.matchId ? 'close' : 'open',
                        });
                        setExpandedMatchId((prev) =>
                          prev === item.matchId ? null : item.matchId,
                        );
                      }}
                      data-testid={`history-row-${item.matchId}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="blc-chip blc-chip--gold">#{item.finalRank}</span>
                        <strong>
                          {DURATION_MODE_SHORT_LABELS[item.durationMode]} ·{' '}
                          {QUEUE_TYPE_LABELS[item.queueType]}
                        </strong>
                        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                          {formatQuarterPoints(item.quarterPoints)} 分 · Lv.{snap.level}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {item.completedAt
                          ? new Date(item.completedAt).toLocaleDateString('zh-CN')
                          : ''}{' '}
                        {expanded ? '▲' : '▼'}
                      </span>
                    </button>

                    {expanded ? (
                      <div className="blc-history-card__detail">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {snap.activeTraits
                            .filter((t) => t.activeTier > 0)
                            .map((t) => (
                              <span key={t.traitName} className="blc-chip blc-chip--gold">
                                {t.traitName} ({t.count})
                              </span>
                            ))}
                          {snap.chosenAugments.map((aid) => {
                            const aug = SEASON1_AUGMENTS.find((a) => a.id === aid);
                            return (
                              <span key={aid} className="blc-chip">
                                {aug?.name ?? aid}
                              </span>
                            );
                          })}
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {snap.units.map((u, idx) => {
                            const def = SEASON1_UNITS_BY_ID.get(u.unitId);
                            return (
                              <div
                                key={`${u.unitId}-${idx}`}
                                className="blc-history-unit-chip"
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                              >
                                <UnitPortrait
                                  unitId={u.unitId}
                                  size="sm"
                                  star={u.star as 1 | 2 | 3}
                                />
                                <div>
                                  <strong>{def?.name ?? u.unitId}</strong>
                                  {u.items.length > 0 ? (
                                    <div style={{ fontSize: 11, color: 'var(--gold-light)' }}>
                                      {u.items
                                        .map((iid) => lookupItemById(iid)?.item.name ?? iid)
                                        .join(' / ')}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {pwdModalOpen ? (
        <div
          className="blc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="修改密码"
        >
          <div
            className="ui-frosted-panel blc-dialog-sm"
            style={{
              width: 'min(360px, 92vw)',
              borderRadius: 10,
              border: '1px solid rgba(240, 220, 170, 0.28)',
              background: 'rgba(14, 18, 28, 0.94)',
            }}
          >
            <div className="blc-dialog-sm__head">
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>修改密码</h3>
              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--xs"
                onClick={() => {
                  audioBus.emit('onUiFeedback', { kind: 'close' });
                  setPwdModalOpen(false);
                }}
              >
                ✕
              </button>
            </div>
            <form className="blc-form-stack" onSubmit={(e) => void handlePasswordChange(e)}>
              <label className="blc-field">
                <span className="blc-field__label">当前密码</span>
                <input
                  type="password"
                  className="blc-input"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label className="blc-field">
                <span className="blc-field__label">新密码</span>
                <input
                  type="password"
                  className="blc-input"
                  minLength={6}
                  placeholder="至少 6 位"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="blc-btn blc-btn--primary"
                disabled={changingPwd}
              >
                {changingPwd ? '保存中…' : '确认修改'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {adminWorkbenchOpen ? (
        <Suspense fallback={null}>
          <AdminPackDrawer
            onClose={() => {
              audioBus.emit('onUiFeedback', { kind: 'close' });
              setAdminWorkbenchOpen(false);
            }}
          />
        </Suspense>
      ) : null}
    </SubpageShell>
  );
}
