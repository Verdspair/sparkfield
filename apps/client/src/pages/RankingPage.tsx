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

export function RankingPage(): React.JSX.Element {
  const {
    authMode,
    profile,
    currentSeasonTerm,
    preferredTacticianId,
    audioBus,
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
              audioBus.emit('onUiFeedback', { kind: 'toggle' });
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
        className="sf-ranking-board"
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
          <div className="blc-table-scroll">
            <table className="blc-table sf-ranking-table" aria-label="赛季名次">
              <thead>
                <tr>
                  <th>名次</th>
                  <th>昵称</th>
                  <th>段位</th>
                  <th>胜点</th>
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
                        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{entry.tierLabel}</span>
                      </td>
                      <td>
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
    </SubpageShell>
  );
}
