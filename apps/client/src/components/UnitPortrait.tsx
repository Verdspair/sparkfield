import React, { useCallback, useSyncExternalStore } from 'react';
import { SEASON1_UNITS_BY_ID } from '@pkg/contracts';
import {
  getTacticianPortraitUrl,
  getUnitPortraitUrl,
  subscribeTacticianPortrait,
  subscribeUnitPortrait,
  type TacticianId,
} from '../stage/index.js';
import './portraits.css';

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
  const subscribe = useCallback((onChange: () => void) => subscribeUnitPortrait(unitId, onChange), [unitId]);
  const getSnapshot = useCallback(() => getUnitPortraitUrl(unitId), [unitId]);
  const src = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

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
  const subscribe = useCallback((onChange: () => void) => subscribeTacticianPortrait(tacticianId, onChange), [tacticianId]);
  const getSnapshot = useCallback(() => getTacticianPortraitUrl(tacticianId), [tacticianId]);
  const src = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return (
    <div className={`sf-tactician-portrait sf-tactician-portrait--${size} ${className}`.trim()}>
      <img src={src} alt={alt} draggable={false} />
    </div>
  );
}
