import React from 'react';
import type { DisplayStatusValue } from '../utils/antiFakeZero.js';

export function StatusValueText({
  value,
  className = '',
}: {
  readonly value: DisplayStatusValue;
  readonly className?: string;
}): React.JSX.Element {
  if (value.kind === 'skeleton') {
    return <span className={`stat-skeleton ${className}`.trim()} aria-label="加载中" />;
  }
  return (
    <span
      className={className}
      style={value.muted ? { color: 'var(--text-secondary)', fontWeight: 600 } : undefined}
    >
      {value.text}
    </span>
  );
}
