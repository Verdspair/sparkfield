import React, { useEffect, useState } from 'react';
import type { DurationMode } from '@pkg/contracts';
import { httpClient, type LeaderboardResponse } from '../api/httpClient.js';
import { StatusValueText } from '../components/StatusValueText.js';
import { useAppStore } from '../store/appStore.js';
import {
  DURATION_MODE_SHORT_LABELS,
  formatLeaderboardPlaceText,
  formatStandingScoreOnly,
  formatStandingTierOnly,
} from '../utils/antiFakeZero.js';

export function RankingPage(): React.JSX.Element {
  const { authMode, profile, currentSeasonTerm, pushToast } = useAppStore();
  const isOffline = authMode === 'offline_practice';

  const [queryMode, setQueryMode] = useState<DurationMode>('standard');
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(!isOffline);

  useEffect(() => {
    let active = true;
    setBoard(null);
    if (isOffline) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    const fetchBoard = async () => {
      try {
        const res = await httpClient.getLeaderboard(queryMode, { limit: 100 });
        if (active) setBoard(res);
      } catch (err) {
        if (active) pushToast(err instanceof Error ? err.message : '读取排行失败', 'warning');
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchBoard();
    return () => { active = false; };
  }, [isOffline, pushToast, queryMode]);

  const selfStanding = board?.self ?? null;
  const seasonLabel = board?.currentSeasonTerm.label ?? currentSeasonTerm?.label ?? 'S1';

  return (
    <div className="blc-page-shell blc-ranking-shell" data-testid="ranking-page">
      <header
        className="ui-frosted-panel blc-ranking-header"
        style={{
          borderRadius: 8,
          border: '1px solid rgba(240, 220, 170, 0.22)',
          background: 'rgba(13, 17, 26, 0.78)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 600 }}>排行榜</h2>
          <span className="blc-chip blc-chip--gold">{seasonLabel}</span>
        </div>

        <div className="blc-seg-tabs" role="tablist" aria-label="模式切换">
          {(['quick', 'standard', 'deep'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={queryMode === m}
              className={`blc-seg-tab ${queryMode === m ? 'blc-seg-tab--active' : ''}`}
              onClick={() => {
                if (m !== queryMode) {
                  setBoard(null);
                  setLoading(!isOffline);
                  setQueryMode(m);
                }
              }}
              data-testid={`ranking-tab-${m}`}
            >
              {DURATION_MODE_SHORT_LABELS[m]}
            </button>
          ))}
        </div>
      </header>

      <section
        className="ui-frosted-panel blc-self-standing-bar"
        style={{
          borderRadius: 8,
          border: '1px solid rgba(240, 220, 170, 0.2)',
          background: 'rgba(13, 17, 26, 0.76)',
        }}
        aria-label="个人段位"
        data-testid="ranking-self-summary"
      >
        <div className="blc-self-standing-bar__who">
          <div className="blc-member-avatar">★</div>
          <strong>{profile?.nickname ?? '领航员'}</strong>
        </div>

        <div className="blc-self-standing-bar__metrics">
          <div className="blc-stat-cell">
            <span>段位</span>
            <strong data-testid="self-ranking-tier">
              {isOffline ? (
                <span style={{ color: 'var(--text-secondary)' }}>离线</span>
              ) : (
                <StatusValueText value={formatStandingTierOnly(selfStanding, loading)} />
              )}
            </strong>
          </div>

          <div className="blc-stat-cell">
            <span>胜点</span>
            <strong data-testid="self-ranking-score">
              {isOffline ? (
                <span style={{ color: 'var(--text-secondary)' }}>—</span>
              ) : (
                <StatusValueText value={formatStandingScoreOnly(selfStanding, loading)} />
              )}
            </strong>
          </div>

          <div className="blc-stat-cell">
            <span>名次</span>
            <strong data-testid="self-ranking-place">
              {isOffline ? (
                <span style={{ color: 'var(--text-secondary)' }}>—</span>
              ) : (
                <StatusValueText
                  value={formatLeaderboardPlaceText(selfStanding, board?.selfInTopN, loading)}
                />
              )}
            </strong>
          </div>

          <div className="blc-stat-cell">
            <span>场次</span>
            <strong>
              {isOffline ? (
                '—'
              ) : loading ? (
                <span className="stat-skeleton" />
              ) : selfStanding ? (
                `${selfStanding.matchesPlayed}`
              ) : (
                '—'
              )}
            </strong>
          </div>
        </div>
      </section>

      <section
        className="ui-frosted-panel blc-ranking-table-wrap"
        style={{
          borderRadius: 8,
          border: '1px solid rgba(240, 220, 170, 0.2)',
          background: 'rgba(13, 17, 26, 0.76)',
        }}
        data-testid="ranking-board-section"
      >
        {isOffline ? (
          <div className="blc-empty-box">离线模式不计入排行</div>
        ) : loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="stat-skeleton" style={{ width: '100%', height: 38 }} />
            <span className="stat-skeleton" style={{ width: '100%', height: 38 }} />
            <span className="stat-skeleton" style={{ width: '100%', height: 38 }} />
          </div>
        ) : !board || board.isEmpty ? (
          <div className="blc-empty-box" data-testid="ranking-empty-state">
            暂无上榜记录
          </div>
        ) : (
          <div className="blc-table-scroll">
            <table className="blc-table">
              <thead>
                <tr>
                  <th>名次</th>
                  <th>昵称</th>
                  <th>段位</th>
                  <th style={{ textAlign: 'right' }}>胜点</th>
                </tr>
              </thead>
              <tbody>
                {board.entries.map((entry) => {
                  const isMe = entry.userId === profile?.userId;
                  return (
                    <tr
                      key={entry.userId}
                      className={isMe ? 'blc-table-row--self' : undefined}
                      data-testid={`leaderboard-row-${entry.leaderboardRank}`}
                    >
                      <td>
                        <span
                          className={`blc-rank-num ${
                            entry.leaderboardRank <= 3
                              ? `blc-rank-num--top${entry.leaderboardRank}`
                              : ''
                          }`.trim()}
                        >
                          #{entry.leaderboardRank}
                        </span>
                      </td>
                      <td>
                        <strong>{entry.nickname}</strong>
                        {isMe ? <span className="blc-tag-mini" style={{ marginLeft: 6 }}>我</span> : null}
                      </td>
                      <td>
                        <span className="blc-chip blc-chip--gold">{entry.tierLabel}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <strong>{entry.rankScore} LP</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
