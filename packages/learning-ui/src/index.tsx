export {
  LEARNING_UI_CSS,
  LEARNING_UI_STYLE_ID,
  ensureLearningUiStyles,
} from './learningUiStyles.js';

export {
  MarkdownKatexBlock,
  renderMarkdownWithKatexToHtml,
  type MarkdownKatexBlockProps,
} from './MarkdownKatexBlock.js';

export {
  LEARNING_READING_THEME_STORAGE_KEY,
  QuestionStepCard,
  readStoredReadingTheme,
  writeStoredReadingTheme,
  type LearningReadingTheme,
  type LessonStepProgressItem,
  type QuestionAnswerSubmission,
  type QuestionAnswerValue,
  type QuestionFeedbackView,
  type QuestionStepCardProps,
  type RemediationItemSummary,
  type StepResultBadge,
} from './QuestionStepCard.js';

export {
  LoreArchiveReader,
  RecommendedItemsTree,
  UnitLoreDrawer,
  type LoreArchiveReaderProps,
  type RecommendedItemsTreeProps,
  type Season1LoreData,
  type Season1UnitLoreEntry,
  type UnitDrawerTab,
  type UnitLoreDrawerProps,
} from './LoreArchiveReader.js';

export {
  GAME_ITEM_ICON_URLS,
  GameItemIcon,
  RichGameText,
  StatInlineIcon,
  getGameItemIconAccent,
  getGameItemIconUrl,
  tokenizeRichGameText,
  type GameItemIconProps,
  type GameItemIconSize,
  type RichGameTextProps,
  type RichGameTextSegment,
  type StatTokenKind,
} from './GameRichIcons.js';

export {
  COMPACT_AUGMENT_DESCRIPTIONS,
  COMPACT_ITEM_DESCRIPTIONS,
  COMPACT_TRAIT_DESCRIPTIONS,
  DESCRIPTION_DETAIL_MODE_STORAGE_KEY,
  DescriptionModeProvider,
  DescriptionModeToggle,
  GameEffectText,
  getGlobalDescriptionMode,
  readStoredDescriptionMode,
  resetDescriptionModeForTests,
  resolveGameEffectText,
  setGlobalDescriptionMode,
  summarizeCompactGameText,
  useDescriptionMode,
  writeStoredDescriptionMode,
  type DescriptionDetailMode,
  type DescriptionModeContextValue,
  type DescriptionModeProviderProps,
  type DescriptionModeToggleProps,
  type GameEffectTextProps,
  type ResolveGameEffectTextInput,
} from './GameDescriptionMode.js';
