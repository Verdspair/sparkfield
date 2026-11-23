import React from 'react';
import type {
  DurationMode,
  MatchStudyBlueprint,
  StudyDifficultyTier,
  SubjectId,
} from '@pkg/contracts';
import { buildMatchStudyBlueprint } from '@pkg/learning-core';
import { STARTER_COURSE_PACKS } from '../content/starterPacks.js';

export interface MatchStudyBlueprintCardProps {
  readonly blueprint: MatchStudyBlueprint;
  readonly locked: boolean;
  readonly emphasizing?: boolean;
  readonly onRerollPack?: () => void;
  readonly onOpenChapterSelect?: () => void;
  readonly compact?: boolean;
}

const DIFFICULTY_TIER_LABELS: Readonly<Record<StudyDifficultyTier, string>> = {
  foundational: '基础巩固档',
  standard: '标准进阶档',
  advanced: '高阶突破档',
};

const SEED_STORAGE_PREFIX = 'sparkfield.prep.blueprint_seed.';

export function readPrepBlueprintSeed(roomCode: string): number {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return 0;
  }
  try {
    const raw = window.sessionStorage.getItem(`${SEED_STORAGE_PREFIX}${roomCode}`);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function writePrepBlueprintSeed(roomCode: string, seed: number): void {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(`${SEED_STORAGE_PREFIX}${roomCode}`, String(seed));
  } catch {
    return;
  }
}

export function buildClientStudyBlueprint(options: {
  readonly mode: DurationMode;
  readonly subject: SubjectId;
  readonly startNodeId?: string;
  readonly seed?: number;
  readonly now?: Date | string;
}): MatchStudyBlueprint {
  const pack =
    STARTER_COURSE_PACKS.find((p) => p.manifest.subject === options.subject) ??
    STARTER_COURSE_PACKS[0]!;
  const hasStart =
    options.startNodeId &&
    pack.manifest.knowledgeGraph.some((node) => node.nodeId === options.startNodeId);
  const knowledgeNode = hasStart
    ? options.startNodeId!
    : pack.manifest.knowledgeGraph[0]!.nodeId;
  const safeSeed =
    typeof options.seed === 'number' && Number.isSafeInteger(options.seed)
      ? options.seed
      : 0;

  return buildMatchStudyBlueprint({
    packs: STARTER_COURSE_PACKS,
    mode: options.mode,
    subject: options.subject,
    now: options.now ?? new Date(),
    progress: [{ subject: options.subject, knowledgeNode }],
    seed: safeSeed,
  });
}

export function MatchStudyBlueprintCard({
  blueprint,
  locked,
  emphasizing = false,
  onRerollPack,
  onOpenChapterSelect,
  compact = false,
}: MatchStudyBlueprintCardProps): React.JSX.Element {
  const tierLabel = DIFFICULTY_TIER_LABELS[blueprint.difficultyTier];
  const canReroll = !locked && !compact && blueprint.subject === 'english' && Boolean(onRerollPack);
  const canSwitchTopic = !locked && !compact && blueprint.subject === 'math' && Boolean(onOpenChapterSelect);

  return (
    <section
      className={`sf-blueprint-card ${
        compact ? 'sf-blueprint-card--compact' : ''
      } ${locked ? 'sf-blueprint-card--locked' : ''} ${
        emphasizing ? 'sf-blueprint-card--emphasizing' : ''
      }`.trim()}
      aria-label="本局学习内容"
      data-testid={compact ? 'accept-study-blueprint-card' : 'prep-study-blueprint-card'}
      data-locked={String(locked)}
      data-emphasizing={String(emphasizing)}
      data-subject={blueprint.subject}
      data-seed={String(blueprint.seed)}
      data-difficulty-label={tierLabel}
    >
      <div className="sf-blueprint-card__head">
        <span className="sf-blueprint-card__title">本局学习内容</span>

        <div className="sf-blueprint-card__controls">
          {locked ? (
            <span className="sf-blueprint-lock-text" data-testid="blueprint-locked-badge">
              已锁定
            </span>
          ) : canReroll ? (
            <button
              type="button"
              className="sf-blueprint-action-btn"
              onClick={onRerollPack}
              data-testid="prep-reroll-blueprint-btn"
            >
              换一组
            </button>
          ) : canSwitchTopic ? (
            <button
              type="button"
              className="sf-blueprint-action-btn"
              onClick={onOpenChapterSelect}
              data-testid="prep-switch-topic-btn"
            >
              切换章节
            </button>
          ) : null}
        </div>
      </div>

      <ul
        className={`sf-blueprint-list ${
          blueprint.arcs.length >= 4 ? 'sf-blueprint-list--two-col' : ''
        }`.trim()}
      >
        {blueprint.arcs.map((arc) => {
          const ordinal = String(arc.arcIndex + 1).padStart(2, '0');
          return (
            <li
              key={arc.arcIndex}
              className="sf-blueprint-row"
              data-testid={`blueprint-arc-${arc.arcIndex}`}
            >
              <span className="sf-blueprint-row__index">{ordinal}</span>
              <span className="sf-blueprint-row__title" title={arc.title}>
                {arc.title}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
