import type {
  DurationMode,
  ModeStandingSummary,
  QueueType,
  RedeemOrder,
  SubjectId,
} from '@pkg/contracts';

export type DisplayStatusValue =
  | { readonly kind: 'skeleton' }
  | { readonly kind: 'text'; readonly text: string; readonly muted?: boolean };

export function formatPointsBalanceDisplay(
  balance: number | null | undefined,
  options?: { loading?: boolean; offline?: boolean },
): DisplayStatusValue {
  if (options?.loading) return { kind: 'skeleton' };
  if (options?.offline) return { kind: 'text', text: '离线不计奖', muted: true };
  if (typeof balance !== 'number' || !Number.isFinite(balance)) {
    return { kind: 'text', text: '待核验', muted: true };
  }
  return { kind: 'text', text: `${balance}` };
}

export function formatStandingBadgeText(
  standing: ModeStandingSummary | null | undefined,
  loading = false,
): DisplayStatusValue {
  if (loading) return { kind: 'skeleton' };
  if (!standing || standing.status === 'unranked' || standing.rankScore === null) {
    return { kind: 'text', text: '未定级', muted: true };
  }
  return {
    kind: 'text',
    text: `${standing.tierLabel} · ${standing.rankScore} LP`,
  };
}

export function formatStandingTierOnly(
  standing: ModeStandingSummary | null | undefined,
  loading = false,
): DisplayStatusValue {
  if (loading) return { kind: 'skeleton' };
  if (!standing || standing.status === 'unranked') {
    return { kind: 'text', text: '未定级', muted: true };
  }
  return { kind: 'text', text: standing.tierLabel };
}

export function formatStandingScoreOnly(
  standing: ModeStandingSummary | null | undefined,
  loading = false,
): DisplayStatusValue {
  if (loading) return { kind: 'skeleton' };
  if (!standing || standing.status === 'unranked' || standing.rankScore === null) {
    return { kind: 'text', text: '未定级', muted: true };
  }
  return { kind: 'text', text: `${standing.rankScore} LP` };
}

export function formatLeaderboardPlaceText(
  standing: ModeStandingSummary | null | undefined,
  selfInTopN?: boolean,
  loading = false,
): DisplayStatusValue {
  if (loading) return { kind: 'skeleton' };
  if (!standing || standing.status === 'unranked' || standing.matchesPlayed === 0) {
    return { kind: 'text', text: '未定级', muted: true };
  }
  if (standing.leaderboardRank === null) {
    return { kind: 'text', text: '未上榜', muted: true };
  }
  if (selfInTopN === false) {
    return { kind: 'text', text: `#${standing.leaderboardRank}（榜外）` };
  }
  return { kind: 'text', text: `#${standing.leaderboardRank}` };
}

export function formatRedeemOrderStatus(status: RedeemOrder['status']): string {
  switch (status) {
    case 'confirmed':
      return '已核验确认';
    case 'pending_verify':
      return '结果待核验';
    case 'cancelled_compensated':
      return '已取消并退回积分';
  }
}

export function formatQuarterPoints(quarterPoints: number | null | undefined): string {
  if (typeof quarterPoints !== 'number' || !Number.isFinite(quarterPoints)) return '—';
  const whole = Math.floor(quarterPoints / 4);
  const rem = Math.abs(quarterPoints % 4);
  if (rem === 0) return `${whole}`;
  const decimal = (quarterPoints / 4).toFixed(rem === 2 ? 1 : 2);
  return decimal;
}

export const DURATION_MODE_LABELS: Readonly<Record<DurationMode, string>> = {
  quick: '超快 · 15分钟',
  standard: '标准 · 30分钟',
  deep: '深度 · 60分钟',
};

export const DURATION_MODE_SHORT_LABELS: Readonly<Record<DurationMode, string>> = {
  quick: '超快',
  standard: '标准',
  deep: '深度',
};

export const QUEUE_TYPE_LABELS: Readonly<Record<QueueType, string>> = {
  ranked: '排位赛',
  casual: '普通匹配',
  solo: '单人模式',
};

export const SUBJECT_LABELS: Readonly<Record<SubjectId, string>> = {
  english: '通用英语',
  math: '应用数学',
};
