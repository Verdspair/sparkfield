import React, { useMemo, useState } from 'react';
import {
  SEASON1_AUGMENTS,
  SEASON1_UNITS_BY_ID,
  lookupItemById,
} from '@pkg/contracts';
import { MarkdownKatexBlock } from '@pkg/learning-ui';
import { STARTER_COURSE_PACKS } from '../content/starterPacks.js';
import { useAppStore } from '../store/appStore.js';
import {
  DURATION_MODE_LABELS,
  QUEUE_TYPE_LABELS,
  formatQuarterPoints,
} from '../utils/antiFakeZero.js';

export function MatchSummaryModal(): React.JSX.Element | null {
  const {
    matchSnapshot,
    matchSummary,
    isOfflineSandboxMatch,
    returnFromSummaryToPrep,
    exitMatchToLobby,
    pushToast,
  } = useAppStore();

  const [reviewDrawerOpen, setReviewDrawerOpen] = useState<boolean>(false);
  const [exiting, setExiting] = useState<boolean>(false);

  const summary = matchSummary ?? matchSnapshot?.summary ?? null;

  const wrongQuestionDetails = useMemo(() => {
    if (!summary) return [];
    const allStarterItems = STARTER_COURSE_PACKS.flatMap((p) => p.items);
    return summary.learning.wrongQuestionIds.map((qid) => {
      const found = allStarterItems.find((it) => it.questionId === qid);
      return {
        questionId: qid,
        knowledgeNode: found?.knowledgeNode ?? '章节复习',
        stemMd: found?.stemMd ?? '题目已收录至错题档案。',
        explanationMd:
          found?.explanationMd ??
          '在大厅「学习」中复练，可查看原题与解析。',
      };
    });
  }, [summary]);

  if (!summary || !matchSnapshot) return null;

  const { competitive, learning } = summary;
  const tiedCount = competitive.placements.filter(
    (p) => p.place === competitive.place,
  ).length;
  const isTied = tiedCount > 1;

  const seatNicknameMap = new Map(
    matchSnapshot.seats.map((s) => [s.seatId, s]),
  );

  const handleReturnPrep = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await returnFromSummaryToPrep();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '返回房间失败', 'error');
    } finally {
      setExiting(false);
    }
  };

  const handleReturnLobby = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await exitMatchToLobby();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : '返回大厅失败', 'error');
    } finally {
      setExiting(false);
    }
  };

  return (
    <div
      className="blc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="本局结算"
      data-testid="match-summary-modal"
    >
      <div className="ui-metal-frame ui-corner-ornaments blc-summary-shell">
        <header className="blc-summary-header">
          <div>
            <h2 style={{ margin: 0 }}>本局结果</h2>
            <p className="blc-summary-meta">
              {DURATION_MODE_LABELS[matchSnapshot.mode]} · {QUEUE_TYPE_LABELS[competitive.queueType]}
            </p>
          </div>
          <div className="blc-summary-place-badge" data-testid="summary-final-place">
            {isTied ? `并列第 ${competitive.place} 名` : `第 ${competitive.place} 名`}
          </div>
        </header>

        <div className="blc-summary-grid">
          <section
            className="ui-frosted-panel blc-summary-col"
            aria-label="竞技结果摘要"
            data-testid="summary-competitive-col"
          >
            <div className="blc-col-head">
              <h3>竞技</h3>
              <span className="blc-chip blc-chip--gold">
                胜点 {formatQuarterPoints(competitive.quarterPoints)}
              </span>
            </div>

            <div className="blc-rank-delta-box" data-testid="summary-rank-delta-box">
              {competitive.queueType !== 'ranked' ? (
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  {QUEUE_TYPE_LABELS[competitive.queueType]} · 不计段位
                </span>
              ) : competitive.standingStatus === 'pending_verification' ||
                !competitive.standing ? (
                <span style={{ color: 'var(--gold-light)', fontSize: 13 }}>
                  <strong>段位待核验</strong>
                </span>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {DURATION_MODE_LABELS[matchSnapshot.mode]}段位
                    </div>
                    <strong style={{ fontSize: 16 }}>
                      {competitive.standingBefore?.status === 'ranked'
                        ? `${competitive.standingBefore.tierLabel} (${competitive.standingBefore.rankScore} 分)`
                        : '未定级'}{' '}
                      → {competitive.standing.tierLabel} ({competitive.standing.rankScore} 分)
                    </strong>
                  </div>
                  {competitive.rankScoreDelta !== null ? (
                    <span
                      className="blc-chip blc-chip--gold"
                      style={{ fontSize: 14, fontWeight: 800 }}
                    >
                      {competitive.rankScoreDelta >= 0
                        ? `+${competitive.rankScoreDelta} 分`
                        : `${competitive.rankScoreDelta} 分`}
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            <div className="blc-summary-placements">
              {competitive.placements.map((p) => {
                const seatInfo = seatNicknameMap.get(p.seatId);
                const isMe = p.seatId === competitive.seatId;
                const sharedTie =
                  competitive.placements.filter((x) => x.place === p.place).length > 1;
                return (
                  <div
                    key={p.seatId}
                    className={`blc-placement-row ${isMe ? 'blc-placement-row--self' : ''}`}
                    data-seat-id={p.seatId}
                  >
                    <span>
                      <strong>
                        {sharedTie ? `=${p.place}` : `#${p.place}`}
                      </strong>{' '}
                      {seatInfo?.nickname ?? '玩家'}
                      {competitive.queueType === 'solo' && seatInfo?.isBot ? ' · 电脑' : ''}
                      {isMe ? ' · 你' : ''}
                    </span>
                    <strong>{formatQuarterPoints(p.victoryPoints)} 胜点</strong>
                  </div>
                );
              })}
            </div>

            <div>
              <div className="blc-field__label" style={{ marginBottom: 6 }}>
                最终阵容 · {competitive.finalBoardSnapshot.level} 级
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {competitive.finalBoardSnapshot.activeTraits
                  .filter((t) => t.activeTier > 0)
                  .map((t) => (
                    <span key={t.traitName} className="blc-chip blc-chip--gold">
                      {t.traitName} ({t.count})
                    </span>
                  ))}
                {competitive.finalBoardSnapshot.chosenAugments.map((aid) => (
                  <span key={aid} className="blc-chip" data-augment-id={aid}>
                    {SEASON1_AUGMENTS.find((a) => a.id === aid)?.name ?? '强化'}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {competitive.finalBoardSnapshot.units.map((u, idx) => (
                  <div key={`${u.unitId}-${idx}`} className="blc-history-unit-chip" data-unit-id={u.unitId}>
                    <strong>
                      {'★'.repeat(u.star)} {SEASON1_UNITS_BY_ID.get(u.unitId)?.name ?? '棋子'}
                    </strong>
                    {u.items.length > 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--gold-light)' }}>
                        {u.items.map((iid) => lookupItemById(iid)?.item.name ?? '装备').join(' / ')}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section
            className="ui-frosted-panel blc-summary-col"
            aria-label="学习收获摘要"
            data-testid="summary-learning-col"
          >
            <div className="blc-col-head">
              <h3>学习</h3>
              <span className="blc-chip blc-chip--gold" data-testid="summary-reward-points-granted">
                {isOfflineSandboxMatch
                  ? '离线演练 · 不计积分'
                  : `+${learning.rewardPointsGranted} 研学积分`}
              </span>
            </div>

            <div className="blc-field__label">学习资源</div>
            {learning.nodes.length === 0 ? (
              <div className="blc-muted-hint">暂无完成记录。</div>
            ) : (
              <div className="blc-node-ledger-list">
                {learning.nodes.map((nd) => (
                  <div key={nd.nodeIndex} className="blc-placement-row">
                    <span>
                      <strong>节点 {nd.nodeIndex + 1}</strong> · 充能 {nd.rawEarnedCents} + {nd.carryInCents}
                    </span>
                    <span style={{ color: 'var(--gold-light)', fontWeight: 700 }}>
                      +{nd.grantedIntegerGold}G · 余 {nd.carryOutCents}/100
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="blc-subtle-banner" data-testid="summary-cleared-carry-note">
              剩余充能 <strong>{learning.discardedCarryCents}/100</strong> 已清零，不跨局保留。
            </div>

            <div>
              <div className="blc-field__label" style={{ marginBottom: 6 }}>
                待复习 {learning.wrongQuestionIds.length} 题
              </div>
              {learning.wrongQuestionIds.length === 0 ? (
                <div className="blc-chip blc-chip--gold">
                  已答题目全部正确
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {wrongQuestionDetails.map((w) => (
                    <span key={w.questionId} className="blc-chip" data-question-id={w.questionId}>
                      {w.knowledgeNode}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {reviewDrawerOpen ? (
          <div className="ui-frosted-panel blc-voluntary-review" data-testid="voluntary-review-drawer">
            <div className="blc-col-head">
              <strong>错题复盘</strong>
              <button
                type="button"
                className="blc-btn blc-btn--ghost blc-btn--xs"
                onClick={() => setReviewDrawerOpen(false)}
              >
                收起
              </button>
            </div>
            {wrongQuestionDetails.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13 }}>本局没有错题。</p>
            ) : (
              <div className="blc-review-items">
                {wrongQuestionDetails.map((item) => (
                  <div key={item.questionId} className="blc-review-card" data-question-id={item.questionId}>
                    <div style={{ fontWeight: 700, color: 'var(--gold-light)', marginBottom: 4 }}>
                      {item.knowledgeNode}
                    </div>
                    <MarkdownKatexBlock content={item.stemMd} />
                    <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <MarkdownKatexBlock content={item.explanationMd} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <footer className="blc-summary-footer">
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="blc-btn blc-btn--metal"
              onClick={() => setReviewDrawerOpen((v) => !v)}
              data-testid="summary-learning-review-btn"
            >
              {reviewDrawerOpen ? '收起复盘' : '学习复盘'}
            </button>

            <button
              type="button"
              className="blc-btn blc-btn--ghost"
              disabled={exiting}
              onClick={() => void handleReturnLobby()}
              data-testid="summary-return-lobby-btn"
            >
              返回大厅
            </button>
          </div>

          <button
            type="button"
            className="blc-btn blc-btn--primary blc-btn--lg"
            disabled={exiting}
            onClick={() => void handleReturnPrep()}
            data-testid="summary-return-prep-btn"
          >
            {exiting ? '返回中…' : '返回房间'}
          </button>
        </footer>
      </div>
    </div>
  );
}
