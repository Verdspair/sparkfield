import React from 'react';

export type GameUiIconName =
  | 'lock'
  | 'unlock'
  | 'coin'
  | 'spark'
  | 'gear'
  | 'eye'
  | 'wardrobe'
  | 'edit'
  | 'chevronDown'
  | 'chevronUp'
  | 'star';

export interface GameUiIconProps {
  readonly name: GameUiIconName;
  readonly size?: number;
  readonly className?: string;
}

export function GameUiIcon({
  name,
  size = 15,
  className = '',
}: GameUiIconProps): React.JSX.Element {
  const cls = `sf-ui-svg-icon ${className}`.trim();

  switch (name) {
    case 'lock':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M5.25 8V5.75a3.75 3.75 0 0 1 7.5 0V8"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
          />
          <rect
            x="3.25"
            y="8"
            width="11.5"
            height="7.75"
            rx="2.1"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="9" cy="11.35" r="1.2" fill="currentColor" />
          <path d="M9 12.4v1.45" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      );

    case 'unlock':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M5.25 8V5.75a3.75 3.75 0 0 1 7.18-1.5"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
          />
          <rect
            x="3.25"
            y="8"
            width="11.5"
            height="7.75"
            rx="2.1"
            fill="currentColor"
            fillOpacity="0.12"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="9" cy="11.5" r="1.1" fill="currentColor" />
        </svg>
      );

    case 'coin':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <polygon
            points="9,1.6 15.2,5.15 15.2,12.85 9,16.4 2.8,12.85 2.8,5.15"
            fill="#e5c785"
            fillOpacity="0.22"
            stroke="#e5c785"
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
          <polygon
            points="9,4.35 12.85,6.6 12.85,11.4 9,13.65 5.15,11.4 5.15,6.6"
            fill="#f3dfad"
            fillOpacity="0.72"
          />
          <path d="M9 5.75L11.2 9L9 12.25L6.8 9Z" fill="#fff7db" />
        </svg>
      );

    case 'spark':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M9 1.75L11.45 6.55L16.25 9L11.45 11.45L9 16.25L6.55 11.45L1.75 9L6.55 6.55Z"
            fill="#7bb9e8"
            fillOpacity="0.24"
            stroke="#b4dcf7"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <path d="M9 5.1L10.35 7.65L12.9 9L10.35 10.35L9 12.9L7.65 10.35L5.1 9L7.65 7.65Z" fill="#cffafe" />
        </svg>
      );

    case 'gear':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M7.5 2.2h3l.45 1.85a5.5 5.5 0 0 1 1.45.84l1.82-.55 1.5 2.6-1.36 1.3c.06.25.09.5.09.76s-.03.51-.09.76l1.36 1.3-1.5 2.6-1.82-.55a5.5 5.5 0 0 1-1.45.84l-.45 1.85h-3l-.45-1.85a5.5 5.5 0 0 1-1.45-.84l-1.82.55-1.5-2.6 1.36-1.3a5.2 5.2 0 0 1 0-1.52L2.28 6.94l1.5-2.6 1.82.55c.44-.34.93-.63 1.45-.84L7.5 2.2Z"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="9" r="2.35" stroke="currentColor" strokeWidth="1.45" />
        </svg>
      );

    case 'eye':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M1.75 9C3.3 5.75 5.85 4.25 9 4.25S14.7 5.75 16.25 9C14.7 12.25 12.15 13.75 9 13.75S3.3 12.25 1.75 9Z"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="9" r="2.35" stroke="currentColor" strokeWidth="1.45" />
          <circle cx="9" cy="9" r="0.9" fill="currentColor" />
        </svg>
      );

    case 'wardrobe':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M9 2.1L14.5 5.25V12.75L9 15.9L3.5 12.75V5.25L9 2.1Z"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <path d="M9 5.2L10.35 7.75L12.9 9L10.35 10.25L9 12.8L7.65 10.25L5.1 9L7.65 7.75Z" fill="currentColor" />
        </svg>
      );

    case 'edit':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M12.2 2.95L15.05 5.8L6.5 14.35L3.1 14.9L3.65 11.5L12.2 2.95Z"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <path d="M10.55 4.6L13.4 7.45" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );

    case 'chevronDown':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.75 6L8 10.25L12.25 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'chevronUp':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.75 10L8 5.75L12.25 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'star':
      return (
        <svg className={cls} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 1.5L9.95 5.55L14.4 6.18L11.15 9.3L11.95 13.75L8 11.6L4.05 13.75L4.85 9.3L1.6 6.18L6.05 5.55Z"
            fill="currentColor"
          />
        </svg>
      );
  }
}
