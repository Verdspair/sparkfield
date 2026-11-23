import React from 'react';
import { lookupItemById } from '@pkg/contracts';
import { GAME_ITEM_ICON_URLS, getGameItemIconUrl } from './assets/items/itemIconUrls.js';

export { GAME_ITEM_ICON_URLS, getGameItemIconUrl };

export type GameItemIconSize = 'xs' | 'sm' | 'md' | 'lg';

export type StatTokenKind =
  | 'phys'
  | 'magic'
  | 'true'
  | 'shield'
  | 'hp'
  | 'as'
  | 'crit'
  | 'armor'
  | 'mr'
  | 'mana'
  | 'gold';

const COMPONENT_ACCENT: Readonly<Record<string, string>> = {
  C_SWORD: '#f59e0b',
  C_BOW: '#facc15',
  C_ROD: '#38bdf8',
  C_TEAR: '#60a5fa',
  C_VEST: '#fb923c',
  C_CLOAK: '#c084fc',
  C_BELT: '#34d399',
  C_GLOVE: '#fb7185',
  C_RUBBING: '#f5c451',
};

const EMBLEM_ACCENT: Readonly<Record<string, string>> = {
  E_DYSON: '#fb923c',
  E_CLOUD: '#60a5fa',
  E_DILATION: '#fde047',
  E_EUROPA: '#34d399',
  E_ARRAY: '#38bdf8',
  E_ANTIMATTER: '#f59e0b',
  E_STARGATE: '#c084fc',
  E_SWARM: '#fb7185',
};

const SPECIAL_TITLES: Readonly<Record<string, string>> = {
  TOOL_MAGNETIC_REMOVER: '磁约束拆卸器',
  TOOL_REFORGER: '散件重铸器',
  ANVIL_COMPONENT_3: '3选1工程散件铁砧',
  ANVIL_COMPLETED_4: '4选1成装铁砧',
};

const SIZE_PX: Readonly<Record<GameItemIconSize, number>> = {
  xs: 20,
  sm: 26,
  md: 38,
  lg: 44,
};

function normalizeItemId(itemId: string): string {
  return itemId === 'C_SPATULA' ? 'C_RUBBING' : itemId;
}

type ItemFrameTier =
  | 'component'
  | 'completed'
  | 'emblem'
  | 'flag'
  | 'tool-remover'
  | 'tool-reforger'
  | 'anvil-comp'
  | 'anvil-completed'
  | 'default';

interface ItemVisualMeta {
  readonly tier: ItemFrameTier;
  readonly accent: string;
  readonly compDots?: readonly [string, string];
  readonly defaultTitle: string;
}

function resolveItemVisualMeta(normalized: string): ItemVisualMeta {
  if (normalized === 'TOOL_MAGNETIC_REMOVER') {
    return {
      tier: 'tool-remover',
      accent: '#38bdf8',
      defaultTitle: SPECIAL_TITLES[normalized]!,
    };
  }
  if (normalized === 'TOOL_REFORGER') {
    return {
      tier: 'tool-reforger',
      accent: '#fb923c',
      defaultTitle: SPECIAL_TITLES[normalized]!,
    };
  }
  if (normalized === 'ANVIL_COMPONENT_3') {
    return {
      tier: 'anvil-comp',
      accent: '#7dd3fc',
      defaultTitle: SPECIAL_TITLES[normalized]!,
    };
  }
  if (normalized === 'ANVIL_COMPLETED_4') {
    return {
      tier: 'anvil-completed',
      accent: '#f5c451',
      defaultTitle: SPECIAL_TITLES[normalized]!,
    };
  }

  const entry = lookupItemById(normalized);
  if (entry?.kind === 'flag' || normalized === 'I_MOTHERSHIP_FLAG') {
    return {
      tier: 'flag',
      accent: '#fde047',
      defaultTitle: entry?.item.name ?? '深空远征母舰旗',
    };
  }
  if (entry?.kind === 'emblem') {
    return {
      tier: 'emblem',
      accent: EMBLEM_ACCENT[entry.item.id] ?? '#c084fc',
      defaultTitle: entry.item.name,
    };
  }
  if (entry?.kind === 'completed') {
    const [cid1 = 'C_SWORD', cid2 = cid1] = entry.item.components;
    const dot1 = COMPONENT_ACCENT[cid1] ?? '#f59e0b';
    const dot2 = COMPONENT_ACCENT[cid2] ?? dot1;
    return {
      tier: 'completed',
      accent: '#f2c97d',
      compDots: [dot1, dot2],
      defaultTitle: entry.item.name,
    };
  }
  if (entry?.kind === 'component' || entry?.kind === 'spatula') {
    return {
      tier: 'component',
      accent: COMPONENT_ACCENT[normalized] ?? '#f5c451',
      defaultTitle: entry.item.name,
    };
  }

  return {
    tier: 'default',
    accent: '#f2c97d',
    defaultTitle: normalized,
  };
}

export interface GameItemIconProps {
  readonly itemId: string;
  readonly size?: GameItemIconSize;
  readonly className?: string;
  readonly title?: string;
}

export function GameItemIcon({
  itemId,
  size = 'md',
  className = '',
  title,
}: GameItemIconProps): React.JSX.Element {
  const normalized = normalizeItemId(itemId);
  const px = SIZE_PX[size];
  const meta = resolveItemVisualMeta(normalized);
  const iconUrl = getGameItemIconUrl(normalized);
  const resolvedTitle = title ?? meta.defaultTitle;
  const showRecipeDots = meta.tier === 'completed' && meta.compDots && size !== 'xs';

  return (
    <span
      className={`lui-item-icon lui-item-icon--${size} lui-item-icon--${meta.tier} ${className}`.trim()}
      style={{ '--lui-item-accent': meta.accent } as React.CSSProperties}
      data-item-icon-id={itemId}
      data-item-tier={meta.tier}
      title={resolvedTitle}
      aria-hidden="true"
    >
      <img
        src={iconUrl}
        alt=""
        width={px}
        height={px}
        decoding="async"
        draggable={false}
        className="lui-item-icon__img"
      />
      {showRecipeDots && meta.compDots ? (
        <span className="lui-item-icon__dots">
          <span className="lui-item-icon__dot" style={{ backgroundColor: meta.compDots[0] }} />
          <span className="lui-item-icon__dot" style={{ backgroundColor: meta.compDots[1] }} />
        </span>
      ) : null}
    </span>
  );
}

export function StatInlineIcon({ kind }: { readonly kind: StatTokenKind }): React.JSX.Element {
  const renderPath = (): React.JSX.Element => {
    switch (kind) {
      case 'phys':
        return (
          <g>
            <path d="M13.5 2.5L7 9L5.5 7.5L11 2.5H13.5Z" fill="currentColor" />
            <path d="M13 3L6.2 9.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M4.5 8L8 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M5.5 10.5L3 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </g>
        );
      case 'magic':
        return (
          <path
            d="M8 1.6L9.7 6.3L14.4 8L9.7 9.7L8 14.4L6.3 9.7L1.6 8L6.3 6.3Z"
            fill="currentColor"
          />
        );
      case 'true':
        return (
          <g>
            <polygon
              points="8,1.8 14,8 8,14.2 2,8"
              fill="currentColor"
              fillOpacity="0.28"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path d="M8 4.2V11.8M4.2 8H11.8" stroke="currentColor" strokeWidth="1.3" />
          </g>
        );
      case 'shield':
        return (
          <path
            d="M8 1.8L13.4 4.1V8.4C13.4 11.5 11.1 13.5 8 14.6C4.9 13.5 2.6 11.5 2.6 8.4V4.1L8 1.8Z"
            fill="currentColor"
            fillOpacity="0.3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        );
      case 'hp':
        return (
          <g>
            <rect
              x="2"
              y="2"
              width="12"
              height="12"
              rx="3.2"
              fill="currentColor"
              fillOpacity="0.24"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M8 4.6V11.4M4.6 8H11.4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        );
      case 'as':
        return (
          <g>
            <path d="M2.5 11.5L12.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <polygon points="14,2.3 8.8,3.2 12.1,7" fill="currentColor" />
            <path d="M2.5 7L6.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
          </g>
        );
      case 'crit':
        return (
          <path
            d="M8 1.4L9.8 5.2L13.8 3.6L11.4 7.3L14.6 9.8L10.4 10.4L10.6 14.5L7.6 11.5L4.1 13.8L5.3 9.7L1.6 8.2L5.6 6.7L4.4 2.7L7.5 5.2Z"
            fill="currentColor"
          />
        );
      case 'armor':
        return (
          <g>
            <path
              d="M8 2L13 4.2V8.6C13 11.4 10.9 13.3 8 14.3C5.1 13.3 3 11.4 3 8.6V4.2L8 2Z"
              fill="currentColor"
              fillOpacity="0.28"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path d="M8 3.2V13.4M4 7.2H12" stroke="currentColor" strokeWidth="1.2" />
          </g>
        );
      case 'mr':
        return (
          <g>
            <circle cx="8" cy="8" r="2.2" fill="currentColor" />
            <path d="M4.2 5.2C5.2 4 6.5 3.3 8 3.3C9.5 3.3 10.8 4 11.8 5.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M2.6 9.5C3.9 11.6 5.8 12.7 8 12.7C10.2 12.7 12.1 11.6 13.4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        );
      case 'mana':
        return (
          <path
            d="M8 1.8C8 1.8 3.2 7.1 3.2 10.2C3.2 12.8 5.3 14.6 8 14.6C10.7 14.6 12.8 12.8 12.8 10.2C12.8 7.1 8 1.8 8 1.8Z"
            fill="currentColor"
          />
        );
      case 'gold':
        return (
          <g>
            <circle cx="8" cy="8" r="5.6" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="2.2" fill="currentColor" />
          </g>
        );
    }
  };

  return (
    <svg
      className="lui-stat-icon"
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      {renderPath()}
    </svg>
  );
}

const KEYWORD_RULES: ReadonlyArray<readonly [StatTokenKind, readonly string[]]> = [
  ['true', ['真实伤害']],
  ['as', ['攻击速度', '攻速']],
  ['phys', ['物理伤害', '物理技能', '物理破甲', '护甲穿透', '攻击力', '普通攻击', '普攻', '物穿', '基础攻击', '攻击']],
  ['magic', ['魔法伤害', '魔法技能', '魔抗穿透', '魔抗击碎', '法术强度', '技能效能', '法强', '法穿', '双穿']],
  ['crit', ['暴击伤害', '暴击率', '暴击']],
  ['shield', ['护盾强度', '护盾', '获盾', '等离子盾']],
  ['mana', ['初始法力', '最大法力', '法力', '回蓝']],
  ['armor', ['护甲', '双抗']],
  ['mr', ['魔抗']],
  ['hp', ['最大生命', '已损生命', '生命值', '生命', '全能吸血', '治疗', '回复', '恢复', '修复']],
  ['gold', ['金币']],
];

const KEYWORD_KIND_MAP = new Map<string, StatTokenKind>();
const ALL_KEYWORDS: string[] = [];
for (const [kind, words] of KEYWORD_RULES) {
  for (const w of words) {
    KEYWORD_KIND_MAP.set(w, kind);
    ALL_KEYWORDS.push(w);
  }
}
ALL_KEYWORDS.sort((a, b) => b.length - a.length);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KW_ALT = ALL_KEYWORDS.map(escapeRegex).join('|');
const NUM_SEQ = '[+-]?\\d+(?:\\.\\d+)?%?(?:/[+-]?\\d+(?:\\.\\d+)?%?)*';
const SIGNED_NUM_SEQ = '[+-]\\d+(?:\\.\\d+)?%?(?:/[+-]?\\d+(?:\\.\\d+)?%?)*';

const RICH_TOKEN_REGEX = new RegExp(
  `(?<goldG>[+-]?\\d+G(?![A-Za-z]))` +
    `|(?<goldJin>\\d+金(?![属色]))` +
    `|(?<apCoef>\\d+(?:\\.\\d+)?P(?![A-Za-z]))` +
    `|(?<preNum>(?<![\\d./P+-])${NUM_SEQ}\\s*点?\\s*)?(?<kw>${KW_ALT})(?<postNum>\\s*${SIGNED_NUM_SEQ})?`,
  'g',
);

const NUM_SPLIT_REGEX = /([+-]?\d+(?:\.\d+)?%?(?:\/[+-]?\d+(?:\.\d+)?%?)*P?G?)/g;

export interface RichGameTextSegment {
  readonly kind: 'text' | StatTokenKind;
  readonly raw: string;
}

export function tokenizeRichGameText(text: string): readonly RichGameTextSegment[] {
  if (!text) return [];
  const rawTokens: RichGameTextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(RICH_TOKEN_REGEX)) {
    const start = match.index ?? 0;
    const full = match[0];
    if (start > cursor) {
      rawTokens.push({ kind: 'text', raw: text.slice(cursor, start) });
    }
    const groups = match.groups ?? {};
    let kind: StatTokenKind = 'magic';
    if (groups.goldG || groups.goldJin) {
      kind = 'gold';
    } else if (groups.apCoef) {
      kind = 'magic';
    } else if (groups.kw) {
      kind = KEYWORD_KIND_MAP.get(groups.kw) ?? 'magic';
    }
    rawTokens.push({ kind, raw: full });
    cursor = start + full.length;
  }

  if (cursor < text.length) {
    rawTokens.push({ kind: 'text', raw: text.slice(cursor) });
  }

  const merged: RichGameTextSegment[] = [];
  for (const seg of rawTokens) {
    const prev = merged[merged.length - 1];
    if (prev && prev.kind !== 'text' && prev.kind === seg.kind) {
      merged[merged.length - 1] = { kind: prev.kind, raw: prev.raw + seg.raw };
    } else {
      merged.push(seg);
    }
  }
  return merged;
}

function renderTokenTextParts(raw: string): React.ReactNode {
  const pieces = raw.split(NUM_SPLIT_REGEX);
  return pieces.map((piece, idx) => {
    if (!piece) return null;
    if (idx % 2 === 1) {
      return (
        <strong key={idx} className="lui-stat-num">
          {piece}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{piece}</React.Fragment>;
  });
}

export interface RichGameTextProps {
  readonly text: string;
  readonly className?: string;
}

export function RichGameText({ text, className = '' }: RichGameTextProps): React.JSX.Element {
  const segments = tokenizeRichGameText(text);
  return (
    <span className={`lui-rich-game-text ${className}`.trim()}>
      {segments.map((seg, idx) =>
        seg.kind === 'text' ? (
          <React.Fragment key={idx}>{seg.raw}</React.Fragment>
        ) : (
          <span key={idx} className={`lui-stat-token lui-stat-token--${seg.kind}`}>
            <StatInlineIcon kind={seg.kind} />
            <span>{renderTokenTextParts(seg.raw)}</span>
          </span>
        ),
      )}
    </span>
  );
}
