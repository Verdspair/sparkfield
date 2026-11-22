import React, { useEffect, useState } from 'react';
import { SEASON1_UNITS_BY_ID } from '@pkg/contracts';
import {
  getTacticianPortraitUrl,
  getUnitPortraitUrl,
  type TacticianId,
} from '../stage/index.js';

export interface UnitPortraitProps {
  readonly unitId: string;
  readonly size?: 'sm' | 'md' | 'lg' | 'card';
  readonly star?: 1 | 2 | 3;
  readonly className?: string;
}

export function UnitPortrait({
  unitId,
  size = 'md',
  star,
  className = '',
}: UnitPortraitProps): React.JSX.Element {
  const unit = SEASON1_UNITS_BY_ID.get(unitId);
  const cost = unit?.cost ?? 1;
  const [src, setSrc] = useState<string>(() => getUnitPortraitUrl(unitId));

  useEffect(() => {
    setSrc(getUnitPortraitUrl(unitId));
    const timer = window.setTimeout(() => {
      const next = getUnitPortraitUrl(unitId);
      setSrc((prev) => (prev === next ? prev : next));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [unitId]);

  return (
    <div
      className={`sf-unit-portrait sf-unit-portrait--${size} sf-cost-border--${cost} ${className}`.trim()}
      data-unit-id={unitId}
      data-cost={cost}
    >
      <img src={src} alt={unit?.name ?? unitId} draggable={false} />
      {star && star > 1 ? (
        <span className={`sf-portrait-stars sf-portrait-stars--${star}`}>
          {'★'.repeat(star)}
        </span>
      ) : null}
    </div>
  );
}

export interface TacticianPortraitProps {
  readonly tacticianId: TacticianId;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly alt?: string;
  readonly className?: string;
}

export function TacticianPortrait({
  tacticianId,
  size = 'md',
  alt = '小小领航员',
  className = '',
}: TacticianPortraitProps): React.JSX.Element {
  const [src, setSrc] = useState<string>(() => getTacticianPortraitUrl(tacticianId));

  useEffect(() => {
    setSrc(getTacticianPortraitUrl(tacticianId));
    const timer = window.setTimeout(() => {
      const next = getTacticianPortraitUrl(tacticianId);
      setSrc((prev) => (prev === next ? prev : next));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [tacticianId]);

  return (
    <div className={`sf-tactician-portrait sf-tactician-portrait--${size} ${className}`.trim()}>
      <img src={src} alt={alt} draggable={false} />
    </div>
  );
}
