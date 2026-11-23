import React from 'react';
import type {
  ArcStageKind,
  DurationMode,
  MatchStudyBlueprint,
  StudyArcSlots,
  StudyDifficultyTier,
  SubjectId,
} from '@pkg/contracts';
import { buildMatchStudyBlueprint } from '@pkg/learning-core';
import { STARTER_COURSE_PACKS } from '../content/starterPacks.js';
import { GameUiIcon } from './GameUiIcons.js';

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

const DIFFICULTY_TIER_TOOLTIP = '匹配时按个人水平平衡抽题，全员共享同等金币上限';

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

function resolveStageLabel(stage: ArcStageKind, slotsInArc: StudyArcSlots): string {
  switch (stage) {
    case 'intro':
      return '熟悉';
    case 'deepen':
      return '深入';
    case 'diagnose':
      return '诊断';
    case 'remediate':
      return slotsInArc === 4 ? '诊断/动态分支' : '动态分支';
    case 'stretch':
      return '进阶挑战';
    case 'mastery':
      return '终测';
  }
}

function BlueprintCompassSvg({ size = 16 }: { readonly size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <polygon
        points="9,1.5 15.5,5.25 15.5,12.75 9,16.5 2.5,12.75 2.5,5.25"
        fill="rgba(242, 201, 125, 0.16)"
        stroke="#f2c97d"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M9 4.2L10.6 7.4L13.8 9L10.6 10.6L9 13.8L7.4 10.6L4.2 9L7.4 7.4Z"
        fill="#4fd1ff"
        fillOpacity="0.85"
      />
    </svg>
  );
}

function RerollArrowsSvg({ size = 13 }: { readonly size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13 5.5A5.5 5.5 0 0 0 3.7 4.2M3 10.5A5.5 5.5 0 0 0 12.3 11.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10.5 5.5H13.3V2.7M5.5 10.5H2.7V13.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StageArrowSvg(): React.JSX.Element {
  return (
    <svg className="sf-blueprint-stage-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M3 2L6.5 5L3 8"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MatchStudyBlueprintCard({
  blueprint,
  locked,
  emphasizing = false,
  onRerollPack,
  onOpenChapterSelect,
  compact = false,
}: MatchStudyBlueprintCardProps): React.JSX.Element {
  const totalSlots = blueprint.arcs.reduce((sum, arc) => sum + arc.slotsInArc, 0);
  const tierLabel = DIFFICULTY_TIER_LABELS[blueprint.difficultyTier];
  const canReroll = !locked && !compact && blueprint.subject === 'english' && Boolean(onRerollPack);
  const canSwitchTopic = !locked && !compact && blueprint.subject === 'math' && Boolean(onOpenChapterSelect);

  return (
    <section
      className={`sf-blueprint-card ui-corner-ornaments ${
        compact ? 'sf-blueprint-card--compact' : ''
      } ${locked ? 'sf-blueprint-card--locked' : ''} ${
        emphasizing ? 'sf-blueprint-card--emphasizing' : ''
      }`.trim()}
      aria-label="本局学习大轮次蓝图"
      data-testid={compact ? 'accept-study-blueprint-card' : 'prep-study-blueprint-card'}
      data-locked={String(locked)}
      data-emphasizing={String(emphasizing)}
      data-subject={blueprint.subject}
      data-seed={String(blueprint.seed)}
    >
      <div className="sf-blueprint-card__head">
        <div className="sf-blueprint-card__heading">
          <span className="sf-blueprint-card__title-badge">
            <BlueprintCompassSvg size={compact ? 14 : 16} />
            <span>本局学习大轮次蓝图</span>
          </span>
          <div className="sf-blueprint-card__metrics">
            <strong className="sf-blueprint-metric-main">
              {blueprint.arcCount} 个学习大轮次
            </strong>
            <span className="sf-blueprint-metric-dot" aria-hidden="true" />
            <span className="sf-blueprint-metric-sub">共 {totalSlots} 轮递进学习</span>
          </div>
        </div>

        <div className="sf-blueprint-card__controls">
          {emphasizing ? (
            <span className="sf-blueprint-lock-pill" data-testid="blueprint-locked-badge">
              <GameUiIcon name="lock" size={12} />
              <span>本局学习蓝图已锁定 · 匹配平衡就绪</span>
            </span>
          ) : locked ? (
            <span className="sf-blueprint-lock-pill sf-blueprint-lock-pill--muted" data-testid="blueprint-locked-badge">
              <GameUiIcon name="lock" size={12} />
              <span>蓝图已锁定</span>
            </span>
          ) : null}

          <span
            className={`sf-blueprint-tier-pill sf-blueprint-tier-pill--${blueprint.difficultyTier}`}
            title={DIFFICULTY_TIER_TOOLTIP}
            data-testid="blueprint-difficulty-tier"
          >
            <GameUiIcon name="spark" size={11} />
            <span>{tierLabel}</span>
          </span>

          {canReroll ? (
            <button
              type="button"
              className="sf-blueprint-action-btn sf-blueprint-action-btn--gold"
              onClick={onRerollPack}
              data-testid="prep-reroll-blueprint-btn"
            >
              <RerollArrowsSvg size={13} />
              <span>换一组拼包</span>
            </button>
          ) : null}

          {canSwitchTopic ? (
            <button
              type="button"
              className="sf-blueprint-action-btn"
              onClick={onOpenChapterSelect}
              data-testid="prep-switch-topic-btn"
            >
              <GameUiIcon name="edit" size={12} />
              <span>切换专题</span>
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={`sf-blueprint-arcs-grid sf-blueprint-arcs-grid--count-${Math.min(3, blueprint.arcs.length)}`}
      >
        {blueprint.arcs.map((arc) => {
          const isEnglishPack = arc.strategy === 'modular_pack';
          const strategyText = isEnglishPack
            ? `拿分智能拼包 · ${arc.slotsInArc} 轮`
            : `完整专题 · ${arc.slotsInArc} 轮`;

          return (
            <article
              key={arc.arcIndex}
              className="sf-blueprint-arc-item"
              data-testid={`blueprint-arc-${arc.arcIndex}`}
            >
              <div className="sf-blueprint-arc-item__top">
                <div className="sf-blueprint-arc-item__badges">
                  <span className="sf-blueprint-arc-index">大轮次 {arc.arcIndex + 1}</span>
                  <span
                    className={`sf-blueprint-arc-strategy ${
                      isEnglishPack
                        ? 'sf-blueprint-arc-strategy--pack'
                        : 'sf-blueprint-arc-strategy--topic'
                    }`}
                  >
                    {strategyText}
                  </span>
                </div>

                {isEnglishPack && arc.tags.length > 0 ? (
                  <div className="sf-blueprint-tags-row">
                    {arc.tags.map((tag) => (
                      <span key={tag} className="sf-blueprint-tag-chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="sf-blueprint-arc-title" title={arc.title}>
                {arc.title}
              </div>

              <ol className="sf-blueprint-stages-rail" aria-label={`大轮次 ${arc.arcIndex + 1} 认知递进`}>
                {arc.slotStages.map((stage, stageIdx) => (
                  <li key={`${arc.arcIndex}-${stageIdx}-${stage}`} className="sf-blueprint-stage-step">
                    {stageIdx > 0 ? <StageArrowSvg /> : null}
                    <span
                      className={`sf-blueprint-stage-pill sf-blueprint-stage-pill--${stage}`}
                    >
                      {resolveStageLabel(stage, arc.slotsInArc)}
                    </span>
                  </li>
                ))}
              </ol>
            </article>
          );
        })}
      </div>
    </section>
  );
}
