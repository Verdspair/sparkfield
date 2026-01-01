import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  SEASON1_AUGMENTS,
  SEASON1_UNITS_BY_ID,
  lookupItemById,
} from '@pkg/contracts';
import { httpClient, type MatchHistoryItem } from '../api/httpClient.js';
import { ArenaThemeSwitcher } from '../components/PersistentStageCanvas.js';
import { StatusValueText } from '../components/StatusValueText.js';
import { useAppStore } from '../store/appStore.js';
import {
  DURATION_MODE_SHORT_LABELS,
  QUEUE_TYPE_LABELS,
  formatPointsBalanceDisplay,
  formatQuarterPoints,
  formatStandingBadgeText,
} from '../utils/antiFakeZero.js';

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
    openRedemption,
    openOnboarding,
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

  const handleDisplayToggle = async (fullscreen: boolean) => {
    try {
      await patchUserProfile({
        displaySettings: { fullscreen, orientation: 'landscape' },
      });
      pushToast(fullscreen ? '已切换至全屏显示' : '已切换至窗口显示', 'info');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '更新显示设置失败', 'error');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const pointsDisplay = formatPointsBalanceDisplay(rewardPointsBalance, {
    loading: dataLoading,
    offline: isOffline,
  });

  return (
    <div className="blc-page-shell blc-scroll-page" data-testid="profile-page">
      <section
        className="ui-frosted-panel blc-profile-hero"
        style={{
          borderRadius: 10,
          border: '1px solid rgba(240, 220, 170, 0.24)',
          background: 'rgba(13, 17, 26, 0.8)',
        }}
        aria-label="个人资料"
      >
        <div className="blc-profile-hero__identity">
          <div className="blc-profile-avatar">
            <span>{(profile?.nickname ?? '星').slice(0, 1)}</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {editingNickname ? (
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  <input
                    className="blc-input"
                    style={{ minHeight: 34, width: 160 }}
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
                    onClick={() => setEditingNickname(false)}
                  >
                    取消
                  </button>
                </span>
              ) : (
                <>
                  <h2 style={{ margin: 0, fontWeight: 600 }}>{profile?.nickname ?? '领航员'}</h2>
                  <button
                    type="button"
                    className="blc-btn blc-btn--ghost blc-btn--xs"
                    onClick={() => setEditingNickname(true)}
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
        </div>

        <div className="blc-profile-hero__ranks">
          {(['quick', 'standard', 'deep'] as const).map((m) => {
            const st = standings.find((s) => s.durationMode === m) ?? null;
            return (
              <div
                key={m}
                className="ui-frosted-panel blc-mini-stat"
                style={{ minWidth: 112, padding: '8px 12px' }}
              >
                <span>{DURATION_MODE_SHORT_LABELS[m]}</span>
                <strong>
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

        <div className="blc-profile-hero__vault">
          <div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>积分</span>
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
            className="blc-btn blc-btn--primary blc-btn--sm"
            onClick={() => openRedemption('profile')}
            data-testid="profile-open-redemption-btn"
          >
            兑换
          </button>
        </div>
      </section>

      <div className="blc-two-col-grid">
        <section
          className="ui-frosted-panel blc-section-card"
          style={{
            borderRadius: 8,
            border: '1px solid rgba(240, 220, 170, 0.2)',
            background: 'rgba(13, 17, 26, 0.76)',
          }}
          data-testid="profile-account-section"
        >
          <div className="blc-col-head">
            <h3 style={{ fontWeight: 600 }}>近期战绩</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isOffline ? (
                <button
                  type="button"
                  className="blc-btn blc-btn--ghost blc-btn--xs"
                  onClick={() => setPwdModalOpen(true)}
                  data-testid="open-change-password-btn"
                >
                  修改密码
                </button>
              ) : null}
              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--xs"
                onClick={() => void logout()}
                data-testid="explicit-logout-btn"
              >
                {isOffline ? '退出试玩' : '退出登录'}
              </button>
            </div>
          </div>

          {isOffline ? (
            <div className="blc-empty-box">离线模式不记录战绩</div>
          ) : historyLoading ? (
            <span className="stat-skeleton" style={{ width: '100%', height: 64 }} />
          ) : history.length === 0 ? (
            <div className="blc-empty-box">暂无战绩记录</div>
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
                      onClick={() =>
                        setExpandedMatchId((prev) =>
                          prev === item.matchId ? null : item.matchId,
                        )
                      }
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
                              >
                                <strong>
                                  {'★'.repeat(u.star)} {def?.name ?? u.unitId}
                                </strong>
                                {u.items.length > 0 ? (
                                  <div style={{ fontSize: 11, color: 'var(--gold-light)' }}>
                                    {u.items
                                      .map((iid) => lookupItemById(iid)?.item.name ?? iid)
                                      .join(' / ')}
                                  </div>
                                ) : null}
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

        <section
          className="ui-frosted-panel blc-section-card"
          style={{
            borderRadius: 8,
            border: '1px solid rgba(240, 220, 170, 0.2)',
            background: 'rgba(13, 17, 26, 0.76)',
          }}
          data-testid="profile-prefs-section"
        >
          <div className="blc-col-head">
            <h3 style={{ fontWeight: 600 }}>偏好与工具</h3>
          </div>

          <div className="blc-form-group">
            <div className="blc-field__label">棋盘舞台</div>
            <ArenaThemeSwitcher compact />
          </div>

          <div className="blc-form-group">
            <div className="blc-field__label">显示模式</div>
            <div className="blc-display-grid">
              <button
                type="button"
                className={`blc-btn blc-btn--sm ${
                  profile?.displaySettings.fullscreen ? 'blc-btn--primary' : 'blc-btn--metal'
                }`}
                onClick={() => void handleDisplayToggle(true)}
                data-testid="display-landscape-fullscreen-btn"
              >
                全屏
              </button>
              <button
                type="button"
                className={`blc-btn blc-btn--sm ${
                  profile?.displaySettings.fullscreen === false
                    ? 'blc-btn--primary'
                    : 'blc-btn--metal'
                }`}
                onClick={() => void handleDisplayToggle(false)}
                data-testid="display-landscape-window-btn"
              >
                窗口
              </button>
            </div>
          </div>

          <div className="blc-form-group">
            <div className="blc-field__label">引导与起点</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                className="blc-btn blc-btn--metal blc-btn--xs"
                onClick={() => openOnboarding('choice')}
                data-testid="replay-onboarding-choice-btn"
              >
                新手引导
              </button>
              <button
                type="button"
                className="blc-btn blc-btn--metal blc-btn--xs"
                onClick={() => openOnboarding('micro_match')}
                data-testid="replay-micro-scenario-btn"
              >
                90 秒演练
              </button>
              <button
                type="button"
                className="blc-btn blc-btn--metal blc-btn--xs"
                onClick={() => openOnboarding('learning_start')}
                data-testid="edit-learning-start-btn"
              >
                起始章节
              </button>
            </div>
          </div>

          <div
            className="ui-frosted-panel"
            style={{
              padding: '12px 14px',
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span className="blc-field__label">题库工作台</span>
            <button
              type="button"
              className={`blc-btn ${isStaff ? 'blc-btn--primary' : 'blc-btn--metal'} blc-btn--xs`}
              onClick={() => setAdminWorkbenchOpen(true)}
              data-testid="open-admin-workbench-btn"
            >
              打开工作台
            </button>
          </div>
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
              background: 'rgba(14, 18, 28, 0.9)',
            }}
          >
            <div className="blc-dialog-sm__head">
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>修改密码</h3>
              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--xs"
                onClick={() => setPwdModalOpen(false)}
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
          <AdminPackDrawer onClose={() => setAdminWorkbenchOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}
