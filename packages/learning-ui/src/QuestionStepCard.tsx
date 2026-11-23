import React, { useEffect, useMemo, useState } from 'react';
import type {
  ArcStageKind,
  AudioEventBus,
  ClientQuestionView,
  ClientStepPrompt,
  LearningArcMeta,
  LessonStepKind,
  QuestionFeedbackReveal,
  QuestionItem,
} from '@pkg/contracts';
import { MarkdownKatexBlock } from './MarkdownKatexBlock.js';
import { ensureLearningUiStyles } from './learningUiStyles.js';

export type LearningReadingTheme = 'cosmos' | 'parchment';

export const LEARNING_READING_THEME_STORAGE_KEY = 'sparkfield.learning.reading_theme';

export function readStoredReadingTheme(): LearningReadingTheme {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return 'cosmos';
  }
  try {
    const raw = window.localStorage.getItem(LEARNING_READING_THEME_STORAGE_KEY);
    return raw === 'parchment' ? 'parchment' : 'cosmos';
  } catch {
    return 'cosmos';
  }
}

export function writeStoredReadingTheme(theme: LearningReadingTheme): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(LEARNING_READING_THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}

export type QuestionAnswerValue =
  | string
  | readonly string[]
  | Readonly<Record<string, string>>;

export interface QuestionAnswerSubmission {
  readonly questionId: string;
  readonly status: 'submitted' | 'skipped';
  readonly answer: QuestionAnswerValue | null;
  readonly serializedAnswer: string;
  readonly hintUsed: boolean;
}

export interface StepResultBadge {
  readonly stepId: string;
  readonly isCorrect: boolean;
}

export interface QuestionFeedbackView extends Partial<QuestionFeedbackReveal> {
  readonly isCorrect: boolean;
  readonly isSkipped?: boolean;
  readonly explanationMd?: string;
  readonly stepResults?: readonly StepResultBadge[];
  readonly correctAnswerDisplay?: string;
}

export interface LessonStepProgressItem {
  readonly kind: LessonStepKind;
  readonly label?: string;
  readonly status: 'done' | 'active' | 'upcoming';
}

export interface RemediationItemSummary {
  readonly questionId: string;
  readonly stemMd: string;
  readonly submittedSummary?: string;
  readonly explanationMd: string;
}

export interface QuestionStepCardProps {
  readonly arcMeta?: LearningArcMeta | null;
  readonly stepKind?: LessonStepKind;
  readonly stepsProgress?: readonly LessonStepProgressItem[];
  readonly question?: ClientQuestionView | QuestionItem | null;
  readonly lessonMaterialMd?: string;
  readonly lessonTitle?: string;
  readonly remediationItems?: readonly RemediationItemSummary[];
  readonly feedback?: QuestionFeedbackView | null;
  readonly explanationMd?: string;
  readonly sharedRemainingSeconds?: number | null;
  readonly sharedTotalSeconds?: number | null;
  readonly isWaitingForRoomDeadline?: boolean;
  readonly waitingMessage?: string;
  readonly canProceedEarly?: boolean;
  readonly variant?: 'overlay' | 'standalone' | 'sandbox' | 'compact';
  readonly audioBus?: AudioEventBus | null;
  readonly readOnly?: boolean;
  readonly busy?: boolean;
  readonly submitLabel?: string;
  readonly nextStepLabel?: string;
  readonly onSubmitAnswer?: (submission: QuestionAnswerSubmission) => void;
  readonly onSkipQuestion?: (submission: QuestionAnswerSubmission) => void;
  readonly onAdvanceStep?: () => void;
  readonly onHintUsed?: (questionId: string) => void;
}

const SHORT_STEP_LABELS: Readonly<Record<LessonStepKind, string>> = {
  material: '导学',
  practice: '练习',
  resource_check: '测验',
  remediation: '订正',
  verification: '巩固',
};

const CANONICAL_FIVE_STEPS: readonly { kind: LessonStepKind; label: string }[] = [
  { kind: 'material', label: SHORT_STEP_LABELS.material },
  { kind: 'practice', label: SHORT_STEP_LABELS.practice },
  { kind: 'resource_check', label: SHORT_STEP_LABELS.resource_check },
  { kind: 'remediation', label: SHORT_STEP_LABELS.remediation },
  { kind: 'verification', label: SHORT_STEP_LABELS.verification },
];

const VERBOSE_STEP_LABELS = new Set([
  '材料/例题',
  '带反馈练习',
  '资源结算题',
  '错因纠错',
  '新变式验证',
  '新变式掌握验证',
]);

function resolveArcStageRibbonLabel(
  kind: ArcStageKind,
  adaptiveBranch: LearningArcMeta['adaptiveBranch'],
): string {
  switch (kind) {
    case 'intro':
      return '熟悉';
    case 'deepen':
      return '深入';
    case 'diagnose':
      return '诊断';
    case 'remediate':
      return adaptiveBranch === 'remediation_inserted' ? '动态订正' : '巩固';
    case 'stretch':
      return '进阶';
    case 'mastery':
      return '终测';
  }
}

function ArcBranchGlyphSvg({ kind }: { readonly kind: 'remediate' | 'stretch' }): React.JSX.Element {
  if (kind === 'remediate') {
    return (
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="5.4" stroke="currentColor" strokeWidth="1.35" />
        <path d="M7 4.2V7.4M7 9.6V10.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1.5L8.65 5.1L12.5 5.65L9.75 8.3L10.4 12.1L7 10.3L3.6 12.1L4.25 8.3L1.5 5.65L5.35 5.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

const CLOCK_RING_RADIUS = 7.5;
const CLOCK_RING_CIRCUMFERENCE = 2 * Math.PI * CLOCK_RING_RADIUS;

function resolveStepLabel(kind: LessonStepKind, customLabel?: string): string {
  if (!customLabel || VERBOSE_STEP_LABELS.has(customLabel)) {
    return SHORT_STEP_LABELS[kind];
  }
  return customLabel;
}

function cleanRemediationStem(stemMd: string): string {
  const trimmed = stemMd.trim();
  if (/^(结算题|题目编号)\s*`[A-Za-z0-9_-]+`\s*(错因诊断|结算复盘)$/.test(trimmed)) {
    return '错题复盘';
  }
  return stemMd;
}

function formatClockMMSS(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(clamped / 60)).padStart(2, '0');
  const ss = String(clamped % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function deterministicShuffle(items: readonly string[], seedStr: string): string[] {
  const copy = [...items];
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i += 1) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let i = copy.length - 1; i > 0; i -= 1) {
    hash ^= i + 0x9e3779b9;
    hash = Math.imul(hash, 16777619);
    const j = (hash >>> 0) % (i + 1);
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  if (copy.length >= 2 && copy.every((v, idx) => v === items[idx])) {
    const first = copy.shift()!;
    copy.push(first);
  }
  return copy;
}

function CornerOrnamentSvg({ pos }: { readonly pos: 'tl' | 'tr' | 'bl' | 'br' }): React.JSX.Element {
  return (
    <svg
      className={`lui-corner-ornament lui-corner-ornament--${pos}`}
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M1.2 12.8V4.2L4.2 1.2H12.8"
        fill="none"
        stroke="#f2c97d"
        strokeWidth="1.25"
      />
      <polygon points="1.2,1.2 4.6,1.2 1.2,4.6" fill="#f2c97d" />
      <circle cx="5.4" cy="5.4" r="1.05" fill="#4fd1ff" />
    </svg>
  );
}

function ThemeToggleIcon({ theme }: { readonly theme: LearningReadingTheme }): React.JSX.Element {
  if (theme === 'parchment') {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M11.8 9.8A4.8 4.8 0 0 1 6.2 4.2a4.8 4.8 0 1 0 5.6 5.6Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M11.6 2.6V4.8M10.5 3.7H12.7"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.8V3.3M8 12.7V14.2M1.8 8H3.3M12.7 8H14.2M3.6 3.6L4.7 4.7M11.3 11.3L12.4 12.4M12.4 3.6L11.3 4.7M4.7 11.3L3.6 12.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function QuestionStepCard({
  arcMeta = null,
  stepKind,
  stepsProgress,
  question: suppliedQuestion = null,
  lessonMaterialMd = '',
  lessonTitle = '',
  remediationItems = [],
  feedback = null,
  explanationMd,
  sharedRemainingSeconds,
  sharedTotalSeconds,
  isWaitingForRoomDeadline = false,
  waitingMessage,
  canProceedEarly = false,
  variant = 'standalone',
  audioBus = null,
  readOnly = false,
  busy = false,
  submitLabel = '提交',
  nextStepLabel = '下一步',
  onSubmitAnswer,
  onSkipQuestion,
  onAdvanceStep,
  onHintUsed,
}: QuestionStepCardProps): React.JSX.Element {
  useEffect(() => {
    ensureLearningUiStyles();
  }, []);

  const [readingTheme, setReadingTheme] = useState<LearningReadingTheme>(() =>
    readStoredReadingTheme(),
  );

  const handleToggleReadingTheme = () => {
    const nextTheme: LearningReadingTheme = readingTheme === 'cosmos' ? 'parchment' : 'cosmos';
    setReadingTheme(nextTheme);
    writeStoredReadingTheme(nextTheme);
  };

  const effectiveStepKind: LessonStepKind =
    stepKind ?? (suppliedQuestion ? suppliedQuestion.stepRole : 'material');
  const question = effectiveStepKind === 'remediation' ? null : suppliedQuestion;

  const computedProgress: readonly LessonStepProgressItem[] = useMemo(() => {
    if (stepsProgress && stepsProgress.length > 0) return stepsProgress;
    const activeIdx = CANONICAL_FIVE_STEPS.findIndex((s) => s.kind === effectiveStepKind);
    return CANONICAL_FIVE_STEPS.map((s, idx) => ({
      kind: s.kind,
      label: s.label,
      status:
        isWaitingForRoomDeadline || (activeIdx !== -1 && idx < activeIdx)
          ? 'done'
          : idx === activeIdx
            ? 'active'
            : 'upcoming',
    }));
  }, [stepsProgress, effectiveStepKind, isWaitingForRoomDeadline]);

  const { matchingLeft, matchingRight, rubricSteps } = useMemo(() => {
    if (!question) {
      return {
        matchingLeft: [] as string[],
        matchingRight: [] as string[],
        rubricSteps: [] as ClientStepPrompt[],
      };
    }
    let left: string[] = [];
    let right: string[] = [];
    if ('matchingLeft' in question && Array.isArray(question.matchingLeft)) {
      left = [...question.matchingLeft];
      right = deterministicShuffle(question.matchingRight, question.questionId);
    } else if ('matchingPairs' in question && Array.isArray(question.matchingPairs)) {
      left = question.matchingPairs.map((p) => p.left);
      const uniqueRight = [...new Set(question.matchingPairs.map((p) => p.right))];
      right = deterministicShuffle(uniqueRight, question.questionId);
    }
    const steps: ClientStepPrompt[] = question.stepsRubric.map((s) => ({
      stepId: s.stepId,
      prompt: s.prompt,
      weightShare: s.weightShare,
    }));
    return { matchingLeft: left, matchingRight: right, rubricSteps: steps };
  }, [question]);

  const activeQuestionId = question?.questionId ?? '';
  const [singleChoiceVal, setSingleChoiceVal] = useState<string>('');
  const [multiChoiceVals, setMultiChoiceVals] = useState<string[]>([]);
  const [matchingMap, setMatchingMap] = useState<Record<string, string>>({});
  const [pendingLeft, setPendingLeft] = useState<string | null>(null);
  const [pendingRight, setPendingRight] = useState<string | null>(null);
  const [textInputVal, setTextInputVal] = useState<string>('');
  const [multiStepVals, setMultiStepVals] = useState<Record<string, string>>({});
  const [hintExpanded, setHintExpanded] = useState<boolean>(false);
  const [hintUsedFlag, setHintUsedFlag] = useState<boolean>(false);
  const [materialExpanded, setMaterialExpanded] = useState<boolean>(false);

  useEffect(() => {
    setSingleChoiceVal('');
    setMultiChoiceVals([]);
    setMatchingMap({});
    setPendingLeft(null);
    setPendingRight(null);
    setTextInputVal('');
    setMultiStepVals({});
    setHintExpanded(false);
    setHintUsedFlag(false);
    setMaterialExpanded(false);
  }, [activeQuestionId]);

  const isLocked = readOnly || busy || Boolean(feedback) || isWaitingForRoomDeadline;

  const canShowHintButton =
    Boolean(question) &&
    question!.stepRole === 'practice' &&
    question!.hintMd.trim().length > 0;

  const canShowSkipButton =
    Boolean(question) &&
    (question!.stepRole === 'resource_check' || question!.stepRole === 'verification') &&
    !isLocked;

  const canReviewMaterialCard =
    Boolean(question) &&
    question!.allowMaterialReview === true &&
    question!.assessmentKind !== 'retrieval';

  const hasMaterialContent = Boolean(question && question.materialMd.trim().length > 0);
  const trimmedAudioRef = question?.audioRefOptional?.trim() ?? '';
  const hasValidAudioRef = trimmedAudioRef.length > 0;

  const resolvedExplanationMd =
    feedback?.explanationMd?.trim() ||
    explanationMd?.trim() ||
    (feedback && question && 'explanationMd' in question ? question.explanationMd : '') ||
    '';

  const resolvedSubmitLabel =
    submitLabel === '确认提交' ? '提交' : submitLabel;
  const resolvedNextLabel =
    nextStepLabel === '继续下一步' || nextStepLabel === '继续下一步 →'
      ? '下一步'
      : nextStepLabel;

  const draftSubmission = useMemo((): {
    ready: boolean;
    answer: QuestionAnswerValue | null;
    serialized: string;
  } => {
    if (!question) return { ready: false, answer: null, serialized: '' };
    switch (question.questionType) {
      case 'single_choice': {
        const v = singleChoiceVal.trim();
        return { ready: v.length > 0, answer: v, serialized: v };
      }
      case 'multi_choice': {
        const sorted = [...multiChoiceVals].sort();
        return {
          ready: sorted.length > 0,
          answer: sorted,
          serialized: sorted.join('|'),
        };
      }
      case 'matching': {
        const ready =
          matchingLeft.length > 0 &&
          matchingLeft.every((l) => Boolean(matchingMap[l]?.trim()));
        const serialized = matchingLeft
          .filter((l) => Boolean(matchingMap[l]))
          .map((l) => `${l}=${matchingMap[l]}`)
          .join(';');
        return { ready, answer: { ...matchingMap }, serialized };
      }
      case 'short_fill': {
        const v = textInputVal.trim();
        return { ready: v.length > 0, answer: v, serialized: v };
      }
      case 'numeric': {
        const v = textInputVal.trim();
        const looksNumeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?(?:\s*\S+)?$/.test(v);
        return { ready: looksNumeric, answer: v, serialized: v };
      }
      case 'multi_step_numeric': {
        const ready =
          rubricSteps.length > 0 &&
          rubricSteps.every((s) => {
            const raw = (multiStepVals[s.stepId] ?? '').trim();
            return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw);
          });
        const cleanMap: Record<string, string> = {};
        for (const s of rubricSteps) {
          const raw = (multiStepVals[s.stepId] ?? '').trim();
          if (raw) cleanMap[s.stepId] = raw;
        }
        const serialized = rubricSteps
          .filter((s) => Boolean(cleanMap[s.stepId]))
          .map((s) => `${s.stepId}=${cleanMap[s.stepId]}`)
          .join(';');
        return { ready, answer: cleanMap, serialized };
      }
    }
  }, [
    question,
    singleChoiceVal,
    multiChoiceVals,
    matchingLeft,
    matchingMap,
    textInputVal,
    rubricSteps,
    multiStepVals,
  ]);

  const handleToggleHint = () => {
    if (!canShowHintButton || !question || busy) return;
    if (!hintUsedFlag) {
      setHintUsedFlag(true);
      onHintUsed?.(question.questionId);
    }
    setHintExpanded((prev) => !prev);
  };

  const handlePlayAudio = () => {
    if (!hasValidAudioRef) return;
    audioBus?.emit('onLessonAudioPlay', { audioRef: trimmedAudioRef });
  };

  const handleMatchingLeftClick = (leftItem: string) => {
    if (isLocked) return;
    if (pendingRight !== null) {
      setMatchingMap((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(next)) {
          if (v === pendingRight) delete next[k];
        }
        next[leftItem] = pendingRight;
        return next;
      });
      setPendingRight(null);
      setPendingLeft(null);
      return;
    }
    if (pendingLeft === leftItem) {
      setPendingLeft(null);
      return;
    }
    setPendingLeft(leftItem);
  };

  const handleMatchingRightClick = (rightItem: string) => {
    if (isLocked) return;
    if (pendingLeft !== null) {
      setMatchingMap((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(next)) {
          if (v === rightItem) delete next[k];
        }
        next[pendingLeft] = rightItem;
        return next;
      });
      setPendingLeft(null);
      setPendingRight(null);
      return;
    }
    if (pendingRight === rightItem) {
      setPendingRight(null);
      return;
    }
    setPendingRight(rightItem);
  };

  const handleSubmit = () => {
    if (!question || !draftSubmission.ready || isLocked) return;
    onSubmitAnswer?.({
      questionId: question.questionId,
      status: 'submitted',
      answer: draftSubmission.answer,
      serializedAnswer: draftSubmission.serialized,
      hintUsed: hintUsedFlag,
    });
  };

  const handleSkip = () => {
    if (!question || !canShowSkipButton) return;
    onSkipQuestion?.({
      questionId: question.questionId,
      status: 'skipped',
      answer: null,
      serializedAnswer: '',
      hintUsed: false,
    });
  };

  const showUtilityRow =
    Boolean(question) &&
    (question!.questionType === 'multi_choice' ||
      hasValidAudioRef ||
      (canReviewMaterialCard && hasMaterialContent) ||
      !canReviewMaterialCard);

  const hasClock =
    typeof sharedRemainingSeconds === 'number' && Number.isFinite(sharedRemainingSeconds);
  const clockUrgent = hasClock && sharedRemainingSeconds <= 15;
  const clockRatio =
    hasClock &&
    typeof sharedTotalSeconds === 'number' &&
    Number.isFinite(sharedTotalSeconds) &&
    sharedTotalSeconds > 0
      ? Math.max(0, Math.min(1, sharedRemainingSeconds / sharedTotalSeconds))
      : 1;
  const clockDashOffset = CLOCK_RING_CIRCUMFERENCE * (1 - clockRatio);

  return (
    <section
      className={`lui-paper-shell lui-paper-shell--${variant} ${
        readingTheme === 'parchment' ? 'lui-paper-shell--parchment' : 'lui-paper-shell--cosmos'
      }`}
      data-testid="question-step-card"
      data-question-id={question?.questionId ?? ''}
      data-step-kind={effectiveStepKind}
      data-reading-theme={readingTheme}
    >
      <CornerOrnamentSvg pos="tl" />
      <CornerOrnamentSvg pos="tr" />
      <CornerOrnamentSvg pos="bl" />
      <CornerOrnamentSvg pos="br" />

      {arcMeta ? (
        <div
          className="lui-arc-ribbon"
          data-testid="learning-arc-ribbon"
          data-adaptive-branch={arcMeta.adaptiveBranch}
        >
          <div className="lui-arc-ribbon__left">
            <span className="lui-arc-counter">
              大轮次 {arcMeta.arcIndex + 1}/{arcMeta.arcCount}
            </span>
            <span className="lui-arc-topic" title={arcMeta.topicTitle}>
              {arcMeta.topicTitle}
            </span>
            {arcMeta.strategy === 'modular_pack' && arcMeta.blueprintTags.length > 0 ? (
              <span className="lui-arc-tags">
                {arcMeta.blueprintTags.map((tag) => (
                  <span key={tag} className="lui-arc-tag">
                    {tag}
                  </span>
                ))}
              </span>
            ) : null}
          </div>

          <div className="lui-arc-ribbon__right">
            {arcMeta.adaptiveBranch === 'remediation_inserted' ? (
              <span
                className="lui-arc-branch lui-arc-branch--remediate"
                data-testid="learning-arc-branch-badge"
              >
                <ArcBranchGlyphSvg kind="remediate" />
                <span>动态插入 · 错题靶向订正</span>
              </span>
            ) : arcMeta.adaptiveBranch === 'stretch_promoted' ? (
              <span
                className="lui-arc-branch lui-arc-branch--stretch"
                data-testid="learning-arc-branch-badge"
              >
                <ArcBranchGlyphSvg kind="stretch" />
                <span>高正确率 · 进阶挑战</span>
              </span>
            ) : null}

            <ol className="lui-arc-outline" aria-label="大轮次进度弧线">
              {arcMeta.stageOutline.map((stage, idx) => (
                <li key={`${stage.slot}-${stage.kind}`} className="lui-arc-outline-item">
                  {idx > 0 ? (
                    <span
                      className={`lui-arc-connector ${
                        arcMeta.stageOutline[idx - 1]?.status === 'done'
                          ? 'lui-arc-connector--done'
                          : ''
                      }`.trim()}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className={`lui-arc-node lui-arc-node--${stage.status}`}
                    title={stage.label}
                    aria-current={stage.status === 'active' ? 'step' : undefined}
                  >
                    <span className="lui-arc-node-dot" aria-hidden="true" />
                    <span>{resolveArcStageRibbonLabel(stage.kind, arcMeta.adaptiveBranch)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}

      <header className="lui-header">
        <ol className="lui-step-rail" aria-label="学习进度">
          {computedProgress.map((item, idx) => {
            const label = resolveStepLabel(item.kind, item.label);
            const prevStatus = idx > 0 ? computedProgress[idx - 1]?.status : undefined;
            const lineStateClass =
              prevStatus === 'done' && item.status === 'active'
                ? 'lui-step-line--active'
                : prevStatus === 'done'
                  ? 'lui-step-line--done'
                  : '';
            return (
              <li key={item.kind} className="lui-step-item">
                {idx > 0 ? (
                  <span
                    className={`lui-step-line ${lineStateClass}`.trim()}
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className={`lui-step-pill ${
                    item.status === 'active'
                      ? 'lui-step-pill--active'
                      : item.status === 'done'
                        ? 'lui-step-pill--done'
                        : ''
                  }`.trim()}
                  aria-current={item.status === 'active' ? 'step' : undefined}
                >
                  <span className="lui-step-dot" aria-hidden="true" />
                  <span>{label}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className="lui-header-actions">
          {hasClock ? (
            <div
              className={`lui-clock-box ${clockUrgent ? 'lui-clock-box--urgent' : ''}`.trim()}
              data-testid="shared-node-countdown"
            >
              <svg className="lui-clock-ring" viewBox="0 0 20 20" aria-hidden="true">
                <circle
                  cx="10"
                  cy="10"
                  r={CLOCK_RING_RADIUS}
                  fill="none"
                  stroke="rgba(141, 162, 192, 0.28)"
                  strokeWidth="2"
                />
                <circle
                  cx="10"
                  cy="10"
                  r={CLOCK_RING_RADIUS}
                  fill="none"
                  stroke={clockUrgent ? '#fbbf24' : '#4fd1ff'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={CLOCK_RING_CIRCUMFERENCE}
                  strokeDashoffset={clockDashOffset}
                  transform="rotate(-90 10 10)"
                />
              </svg>
              <span className="lui-clock-time">{formatClockMMSS(sharedRemainingSeconds)}</span>
            </div>
          ) : null}

          <button
            type="button"
            className={`lui-theme-toggle ${
              readingTheme === 'parchment' ? 'lui-theme-toggle--parchment' : ''
            }`.trim()}
            aria-pressed={readingTheme === 'parchment'}
            aria-label={
              readingTheme === 'parchment'
                ? '切换至深空星图护眼态'
                : '切换至暖羊皮纸护眼态'
            }
            title={
              readingTheme === 'parchment'
                ? '切换至深空星图护眼态'
                : '切换至暖羊皮纸护眼态'
            }
            onClick={handleToggleReadingTheme}
            data-testid="learning-theme-toggle"
          >
            <ThemeToggleIcon theme={readingTheme} />
          </button>
        </div>
      </header>

      <div className="lui-body">
        {isWaitingForRoomDeadline ? (
          <div className="lui-wait-banner" data-testid="early-finish-wait-banner">
            <span>已完成</span>
            <span>{waitingMessage ?? '全房统一截止后进入下一策略期'}</span>
          </div>
        ) : null}

        <div key={`${effectiveStepKind}-${activeQuestionId}`} className="lui-stage-anim">
          {effectiveStepKind === 'material' && !question ? (
            <>
              {lessonTitle.trim() ? (
                <>
                  <h3 className="lui-briefing-title">
                    <span className="lui-briefing-diamond" aria-hidden="true" />
                    <span>{lessonTitle}</span>
                  </h3>
                  <hr className="lui-metal-divider" />
                </>
              ) : null}
              <div className="lui-stem-card lui-stem-card--briefing">
                <MarkdownKatexBlock content={lessonMaterialMd || '阅读本节要点后继续。'} />
              </div>
            </>
          ) : null}

          {effectiveStepKind === 'remediation' && !question ? (
            <div className="lui-remediation-list">
              {remediationItems.length === 0 ? (
                <div className="lui-feedback-box">作答全部正确，可直接继续。</div>
              ) : (
                remediationItems.map((rem) => (
                  <div key={rem.questionId} className="lui-stem-card">
                    <MarkdownKatexBlock content={cleanRemediationStem(rem.stemMd)} />
                    {rem.submittedSummary ? (
                      <div className="lui-remediation-submitted">
                        你的作答：{rem.submittedSummary}
                      </div>
                    ) : null}
                    <div className="lui-feedback-box" style={{ marginTop: 10 }}>
                      <MarkdownKatexBlock content={rem.explanationMd} />
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {question ? (
            <>
              {showUtilityRow ? (
                <div className="lui-utility-row">
                  <div className="lui-utility-left">
                    {question.questionType === 'multi_choice' ? (
                      <span className="lui-subtle-pill">多选</span>
                    ) : null}
                    {hasValidAudioRef ? (
                      <button
                        type="button"
                        className="lui-ref-btn"
                        onClick={handlePlayAudio}
                        data-testid="lesson-audio-btn"
                      >
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <path
                            d="M2.5 5.3H5L8.2 2.6V11.4L5 8.7H2.5V5.3Z"
                            stroke="currentColor"
                            strokeWidth="1.25"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M10.2 4.8C11.1 5.8 11.1 8.2 10.2 9.2"
                            stroke="currentColor"
                            strokeWidth="1.25"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span>语音</span>
                      </button>
                    ) : null}
                  </div>

                  <div className="lui-utility-right">
                    {canReviewMaterialCard && hasMaterialContent ? (
                      <button
                        type="button"
                        className="lui-ref-btn"
                        aria-expanded={materialExpanded}
                        onClick={() => setMaterialExpanded((prev) => !prev)}
                      >
                        <span>参考资料</span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden="true"
                          className={`lui-ref-chevron ${
                            materialExpanded ? 'lui-ref-chevron--open' : ''
                          }`.trim()}
                        >
                          <path
                            d="M2.5 4.5L6 8L9.5 4.5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    ) : !canReviewMaterialCard ? (
                      <span
                        className="lui-lock-icon"
                        data-testid="material-locked-badge"
                        title="定义卡已收起"
                        aria-label="定义卡已收起"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden="true"
                        >
                          <rect
                            x="3"
                            y="6.2"
                            width="8"
                            height="5.8"
                            rx="1.4"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <path
                            d="M4.8 6.2V4.6a2.2 2.2 0 0 1 4.4 0v1.6"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {canReviewMaterialCard && hasMaterialContent ? (
                <div className="lui-material-drawer" data-testid="material-review-drawer">
                  {materialExpanded ? (
                    <div className="lui-material-content">
                      <MarkdownKatexBlock content={question.materialMd} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="lui-stem-card" data-testid="question-stem">
                <MarkdownKatexBlock content={question.stemMd} />
              </div>

              {question.questionType === 'single_choice' ? (
                <div className="lui-options-grid" role="radiogroup" aria-label="单选题选项">
                  {question.options.map((opt) => {
                    const selected = singleChoiceVal === opt.key;
                    const stateClass =
                      selected && feedback?.isCorrect
                        ? 'lui-option-btn--correct'
                        : selected && feedback && !feedback.isCorrect && !feedback.isSkipped
                          ? 'lui-option-btn--incorrect'
                          : selected
                            ? 'lui-option-btn--selected'
                            : '';
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={isLocked}
                        className={`lui-option-btn ${stateClass}`.trim()}
                        onClick={() => setSingleChoiceVal(opt.key)}
                        data-testid={`option-${opt.key}`}
                      >
                        <span className="lui-option-diamond" aria-hidden="true">
                          <span className="lui-option-diamond-frame" />
                          <span className="lui-option-key">{opt.key}</span>
                        </span>
                        <MarkdownKatexBlock content={opt.text} inline />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {question.questionType === 'multi_choice' ? (
                <div className="lui-options-grid" role="group" aria-label="多选题选项">
                  {question.options.map((opt) => {
                    const selected = multiChoiceVals.includes(opt.key);
                    const stateClass =
                      selected && feedback?.isCorrect
                        ? 'lui-option-btn--correct'
                        : selected && feedback && !feedback.isCorrect && !feedback.isSkipped
                          ? 'lui-option-btn--incorrect'
                          : selected
                            ? 'lui-option-btn--selected'
                            : '';
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        aria-pressed={selected}
                        disabled={isLocked}
                        className={`lui-option-btn ${stateClass}`.trim()}
                        onClick={() =>
                          setMultiChoiceVals((prev) =>
                            prev.includes(opt.key)
                              ? prev.filter((k) => k !== opt.key)
                              : [...prev, opt.key],
                          )
                        }
                        data-testid={`option-${opt.key}`}
                      >
                        <span className="lui-option-diamond" aria-hidden="true">
                          <span className="lui-option-diamond-frame" />
                          <span className="lui-option-key">{selected ? '✓' : opt.key}</span>
                        </span>
                        <MarkdownKatexBlock content={opt.text} inline />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {question.questionType === 'matching' ? (
                <div>
                  <div className="lui-matching-board" data-testid="matching-board">
                    <div className="lui-matching-col">
                      {matchingLeft.map((leftItem, lIdx) => {
                        const pairedRight = matchingMap[leftItem];
                        const isPending = pendingLeft === leftItem;
                        return (
                          <button
                            key={leftItem}
                            type="button"
                            disabled={isLocked}
                            className={`lui-matching-item ${
                              isPending
                                ? 'lui-matching-item--active'
                                : pairedRight
                                  ? 'lui-matching-item--paired'
                                  : ''
                            }`.trim()}
                            onClick={() => handleMatchingLeftClick(leftItem)}
                            data-testid={`match-left-${lIdx}`}
                          >
                            <MarkdownKatexBlock content={leftItem} inline />
                            {pairedRight ? <span className="lui-pair-tag">#{lIdx + 1}</span> : null}
                          </button>
                        );
                      })}
                    </div>

                    <svg
                      className="lui-matching-svg"
                      viewBox={`0 0 100 ${Math.max(1, matchingLeft.length) * 54}`}
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      {matchingLeft.map((leftItem, lIdx) => {
                        const pairedRight = matchingMap[leftItem];
                        if (!pairedRight) return null;
                        const rIdx = matchingRight.indexOf(pairedRight);
                        if (rIdx === -1) return null;
                        const y1 = lIdx * 54 + 27;
                        const y2 = rIdx * 54 + 27;
                        return (
                          <g key={leftItem}>
                            <path
                              className="lui-matching-curve"
                              d={`M 2 ${y1} C 42 ${y1}, 58 ${y2}, 98 ${y2}`}
                            />
                            <circle className="lui-matching-node" cx="4" cy={y1} r="3.2" />
                            <circle className="lui-matching-node" cx="96" cy={y2} r="3.2" />
                          </g>
                        );
                      })}
                    </svg>

                    <div className="lui-matching-col">
                      {matchingRight.map((rightItem, rIdx) => {
                        const pairedLeftIdx = matchingLeft.findIndex(
                          (l) => matchingMap[l] === rightItem,
                        );
                        const isPending = pendingRight === rightItem;
                        return (
                          <button
                            key={rightItem}
                            type="button"
                            disabled={isLocked}
                            className={`lui-matching-item ${
                              isPending
                                ? 'lui-matching-item--active'
                                : pairedLeftIdx !== -1
                                  ? 'lui-matching-item--paired'
                                  : ''
                            }`.trim()}
                            onClick={() => handleMatchingRightClick(rightItem)}
                            data-testid={`match-right-${rIdx}`}
                          >
                            <MarkdownKatexBlock content={rightItem} inline />
                            {pairedLeftIdx !== -1 ? (
                              <span className="lui-pair-tag">#{pairedLeftIdx + 1}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {!isLocked && Object.keys(matchingMap).length > 0 ? (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="lui-ref-btn"
                        onClick={() => {
                          setMatchingMap({});
                          setPendingLeft(null);
                          setPendingRight(null);
                        }}
                      >
                        重置连线
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {question.questionType === 'short_fill' ? (
                <div>
                  <input
                    type="text"
                    className="lui-input-field"
                    placeholder="输入答案"
                    value={textInputVal}
                    disabled={isLocked}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => setTextInputVal(e.target.value)}
                    data-testid="short-fill-input"
                  />
                </div>
              ) : null}

              {question.questionType === 'numeric' ? (
                <div>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="lui-input-field"
                    placeholder="输入数值"
                    value={textInputVal}
                    disabled={isLocked}
                    autoComplete="off"
                    onChange={(e) => setTextInputVal(e.target.value)}
                    data-testid="numeric-input"
                  />
                </div>
              ) : null}

              {question.questionType === 'multi_step_numeric' ? (
                <div className="lui-multistep-list" data-testid="multi-step-numeric-group">
                  {rubricSteps.map((step) => {
                    const stepFeedback = feedback?.stepResults?.find(
                      (r) => r.stepId === step.stepId,
                    );
                    return (
                      <div key={step.stepId} className="lui-multistep-row">
                        <div className="lui-multistep-header">
                          <MarkdownKatexBlock content={step.prompt} inline />
                          <span className="lui-subtle-pill">
                            {Math.round(step.weightShare * 100)}%
                            {stepFeedback ? (stepFeedback.isCorrect ? ' ✓' : ' ✕') : ''}
                          </span>
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="lui-input-field"
                          placeholder="输入数值"
                          value={multiStepVals[step.stepId] ?? ''}
                          disabled={isLocked}
                          autoComplete="off"
                          onChange={(e) =>
                            setMultiStepVals((prev) => ({
                              ...prev,
                              [step.stepId]: e.target.value,
                            }))
                          }
                          data-testid={`multistep-input-${step.stepId}`}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {canShowHintButton && hintExpanded ? (
                <div className="lui-hint-box" data-testid="practice-hint-content">
                  <MarkdownKatexBlock content={question.hintMd} />
                </div>
              ) : null}

              {feedback ? (
                <div
                  className={`lui-feedback-box ${
                    feedback.isCorrect ? '' : 'lui-feedback-box--incorrect'
                  }`.trim()}
                  data-testid="question-feedback-box"
                >
                  <div
                    className="lui-feedback-head"
                    style={{ marginBottom: resolvedExplanationMd ? 6 : 0 }}
                  >
                    {feedback.isCorrect ? (
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path
                          d="M8 1.4L9.7 6.3L14.6 8L9.7 9.7L8 14.6L6.3 9.7L1.4 8L6.3 6.3L8 1.4Z"
                          fill="currentColor"
                        />
                      </svg>
                    ) : null}
                    <span>
                      {feedback.isSkipped
                        ? '已跳过'
                        : feedback.isCorrect
                          ? '回答正确'
                          : '参考解析'}
                      {feedback.correctAnswerDisplay ? ` · ${feedback.correctAnswerDisplay}` : ''}
                    </span>
                  </div>
                  {resolvedExplanationMd ? (
                    <MarkdownKatexBlock content={resolvedExplanationMd} />
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <footer className="lui-footer">
        <div className="lui-btn-row">
          {canShowHintButton ? (
            <button
              type="button"
              className={`lui-btn lui-btn--ghost ${hintExpanded ? 'lui-btn--active-soft' : ''}`.trim()}
              aria-expanded={hintExpanded}
              onClick={handleToggleHint}
              disabled={busy}
              data-testid="toggle-hint-btn"
            >
              提示
            </button>
          ) : null}

          {canShowSkipButton ? (
            <button
              type="button"
              className="lui-btn lui-btn--ghost"
              onClick={handleSkip}
              data-testid="skip-question-btn"
            >
              跳过
            </button>
          ) : null}
        </div>

        <div className="lui-btn-row">
          {question && !feedback && !isWaitingForRoomDeadline ? (
            <button
              type="button"
              className="lui-btn lui-btn--primary"
              disabled={!draftSubmission.ready || isLocked}
              onClick={handleSubmit}
              data-testid="submit-answer-btn"
            >
              {resolvedSubmitLabel}
            </button>
          ) : null}

          {(((!question || Boolean(feedback)) && !isWaitingForRoomDeadline) || canProceedEarly) && onAdvanceStep ? (
            <button
              type="button"
              className="lui-btn lui-btn--primary"
              onClick={onAdvanceStep}
              disabled={busy}
              data-testid="advance-step-btn"
            >
              {resolvedNextLabel}
            </button>
          ) : null}
        </div>
      </footer>
    </section>
  );
}
