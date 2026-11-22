import React, { useEffect, useState } from 'react';
import type { DurationMode } from '@pkg/contracts';
import { httpClient, type LeaderboardResponse } from '../api/httpClient.js';
import { StatusValueText } from '../components/StatusValueText.js';
import { SubpageShell } from '../components/SubpageShell.js';
import { TacticianPortrait } from '../components/UnitPortrait.js';
import { useAppStore } from '../store/appStore.js';
import {
  DURATION_MODE_SHORT_LABELS,
  formatLeaderboardPlaceText,
  formatStandingScoreOnly,
  formatStandingTierOnly,
} from '../utils/antiFakeZero.js';
import './subpages.css';

function PodiumCrest({ rank }: { readonly rank: number }): React.JSX.Element {
  const palette =
    rank === 1
      ? { stroke: '#f5d076', fill: 'rgba(245, 208, 118, 0.24)', label: '冠军' }
      : rank === 2
        ? { stroke: '#cbd5e1', fill: 'rgba(203, 213, 225, 0.2)', label: '亚军' }
        : { stroke: '#d19162', fill: 'rgba(209, 145, 98, 0.2)', label: '季军' };

  return (
    <svg width="40" height="40" viewBox="0 0 44 44" aria-label={palette.label}>
      <polygon
        points="22,3 38,12 38,32 22,41 6,32 6,12"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="2"
      />
      <text
        x="22"
        y="27"
        textAnchor="middle"
        fill={palette.stroke}
        fontSize="15"
        fontWeight="800"
      >
        {rank}
      </text>
    </svg>
  );
}

export function RankingPage(): React.JSX.Element {
  const {
    authMode,
    profile,
    currentSeasonTerm,
    preferredTacticianId,
    pushToast,
  } = useAppStore();
  const isOffline = authMode === 'offline_practice';

  const [queryMode, setQueryMode] = useState<DurationMode>('standard');
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(!isOffline);

  useEffect(() => {
    let active = true;
    setBoard(null);
    if (isOffline) {
      setLoading(false);
      return () => {
        active = false;
      };
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
    return () => {
      active = false;
    };
  }, [isOffline, pushToast, queryMode]);

  const selfStanding = board?.self ?? null;
  const seasonLabel = board?.currentSeasonTerm.label ?? currentSeasonTerm?.label ?? 'S1 · 光锥之外';
  const podiumEntries = board && !board.isEmpty ? board.entries.slice(0, 3) : [];

  const modeSelector = (
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
  );

  const selfFooter = (
    <section
      className="sf-self-rank-footer"
      aria-label="我的赛季排位"
      data-testid="ranking-self-summary"
    >
      <div className="blc-self-standing-bar__who">
        <TacticianPortrait
          tacticianId={preferredTacticianId}
          size="sm"
          alt={profile?.nickname ?? '领航员'}
        />
        <div>
          <div style={{ fontSize: 11, color: 'var(--gold-light)' }}>我的赛季排位</div>
          <strong>{profile?.nickname ?? '领航员'}</strong>
        </div>
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
  );

  return (
    <SubpageShell
      title="荣耀排行榜"
      subtitle={seasonLabel}
      testId="ranking-page"
      headerActions={modeSelector}
      footer={selfFooter}
    >
      <section
        className="sf-card sf-section-panel"
        style={{ flex: 1, minHeight: 0 }}
        data-testid="ranking-board-section"
      >
        {isOffline ? (
          <div className="sf-star-empty">
            <strong>离线模式</strong>
            <span style={{ fontSize: 13 }}>登录后计入段位排行。</span>
          </div>
        ) : loading ? (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="stat-skeleton" style={{ width: '100%', height: 42 }} />
            <span className="stat-skeleton" style={{ width: '100%', height: 42 }} />
            <span className="stat-skeleton" style={{ width: '100%', height: 42 }} />
          </div>
        ) : !board || board.isEmpty ? (
          <div className="sf-star-empty" data-testid="ranking-empty-state">
            <strong>暂无上榜记录</strong>
            <span style={{ fontSize: 13 }}>完成定级对局后显示排名。</span>
          </div>
        ) : (
          <>
            {podiumEntries.length > 0 ? (
              <div className="sf-podium-grid" aria-label="前三名领奖台">
                {podiumEntries.map((entry) => (
                  <div
                    key={entry.userId}
                    className={`sf-podium-card sf-podium-card--${entry.leaderboardRank}`}
                  >
                    <PodiumCrest rank={entry.leaderboardRank} />
                    <strong style={{ fontSize: 15 }}>{entry.nickname}</strong>
                    <span className="blc-chip blc-chip--gold">{entry.tierLabel}</span>
                    <strong
                      style={{
                        fontSize: 16,
                        color: 'var(--gold-light)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {entry.rankScore} LP
                    </strong>
                  </div>
                ))}
              </div>
            ) : null}

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
                          {isMe ? (
                            <span className="blc-tag-mini" style={{ marginLeft: 6 }}>
                              我
                            </span>
                          ) : null}
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
          </>
        )}
      </section>
    </SubpageShell>
  );
}
