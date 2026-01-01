import type { ColumnType, Generated } from 'kysely';
import type { ArenaThemeId, DisplaySettings, DurationMode, FinalBoardSnapshot, FsrsCardRecord, SubjectId } from '@pkg/contracts';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonColumn<T> = ColumnType<T, string, string>;
export type Defaulted<T> = T extends ColumnType<infer S, infer I, infer U> ? ColumnType<S, I | undefined, U> : Generated<T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;
export interface UsersTable {
  id: string; username: string; nickname: string; email: string | null; password_hash: string;
  role: Generated<'player' | 'editor' | 'admin'>; session_epoch: Generated<number>;
  onboarding_choice: Generated<'unset' | 'cards' | 'micro_match' | 'skipped'>;
  learning_start_json: Defaulted<JsonColumn<Partial<Record<SubjectId, string>>>>;
  preferred_arena: Generated<ArenaThemeId>; display_settings_json: Defaulted<JsonColumn<DisplaySettings>>;
  avatar_frame_id: string | null; board_plaque_id: string | null;
  highest_unit_stars_json: Defaulted<JsonColumn<Record<string, number>>>;
  cohort_group: string | null; created_at: Defaulted<Timestamp>;
}
export interface UserSessionsTable {
  token_hash: string; user_id: string; session_epoch: number; expires_at: Timestamp; created_at: Defaulted<Timestamp>;
}
export interface SeasonTermsTable {
  id: string; label: string; starts_at: Timestamp; ends_at: Timestamp;
  is_active: Generated<boolean>; rewards_settled: Generated<boolean>;
}
export interface ModeStandingsTable {
  season_term_id: string; duration_mode: DurationMode; user_id: string;
  mu: number; sigma: number; ordinal: number; tier_label: string; rank_score: number;
  matches_played: Generated<number>; updated_at: Defaulted<Timestamp>;
}
export interface CoursePacksTable {
  pack_id: string; course_pack_version: string; pack_json: JsonColumn<JsonValue>;
  content_sha256: string; subject: SubjectId; is_active: Generated<boolean>; created_at: Defaulted<Timestamp>;
}
export interface LearningFsrsCardsTable {
  user_id: string; family_id: string; subject: SubjectId; knowledge_node: string;
  state_json: JsonColumn<FsrsCardRecord>; due_at: Timestamp; updated_at: Defaulted<Timestamp>;
}
export interface LearningAttemptsTable {
  id: string; user_id: string; question_id: string; family_id: string; subject: SubjectId;
  course_pack_version: string; knowledge_node: string; is_correct: boolean;
  answer_json: JsonColumn<JsonValue>; is_offline_unverified: Generated<boolean>; created_at: Defaulted<Timestamp>;
}
export interface QuestionIssueReportsTable {
  id: string; user_id: string; question_id: string; pack_version: string; attempt_ref: string;
  reason_code: 'typo_or_formula' | 'ambiguous_stem' | 'wrong_answer_key' | 'media_broken' | 'other';
  detail_optional: string | null; created_at: Defaulted<Timestamp>;
}
export interface MatchesTable {
  id: string; season_term_id: string; game_set_version: string; course_pack_version: string;
  course_pack_id: string | null; duration_mode: DurationMode; queue_type: 'ranked' | 'casual' | 'solo';
  status: Generated<'active' | 'completed'>; created_at: Defaulted<Timestamp>; completed_at: Timestamp | null;
}
export interface MatchParticipantsTable {
  match_id: string; seat_id: string; user_id: string | null; is_bot: boolean; final_rank: number;
  quarter_points: number; final_board_snapshot: JsonColumn<FinalBoardSnapshot>;
  wrong_question_ids: JsonColumn<string[]>;
}
export interface RewardPointsLedgerTable {
  id: string; user_id: string; points_delta: number; reason: string; idempotency_key: string;
  related_order_id: string | null; related_attempt_id: string | null; compensates_ledger_id: string | null;
  created_at: Defaulted<Timestamp>;
}
export interface RewardTaskQuotasTable {
  user_id: string; task_key: string; quota_window: string; idempotency_key: string;
  ledger_id: string; created_at: Defaulted<Timestamp>;
}
export interface GiftCatalogTable {
  id: string; title: string; description: string; points_cost: number; stock_remaining: number;
  is_sample_reward: Generated<boolean>;
}
export interface RedemptionOrdersTable {
  id: string; user_id: string; gift_id: string; gift_title: string; points_cost: number;
  status: Generated<'confirmed' | 'cancelled_compensated'>; idempotency_key: string;
  debit_ledger_id: string; compensation_ledger_id: string | null; created_at: Defaulted<Timestamp>;
}
export interface Database {
  users: UsersTable; user_sessions: UserSessionsTable; season_terms: SeasonTermsTable;
  mode_standings: ModeStandingsTable; course_packs: CoursePacksTable;
  learning_fsrs_cards: LearningFsrsCardsTable; learning_attempts: LearningAttemptsTable;
  question_issue_reports: QuestionIssueReportsTable; matches: MatchesTable;
  match_participants: MatchParticipantsTable; reward_points_ledger: RewardPointsLedgerTable;
  reward_task_quotas: RewardTaskQuotasTable; gift_catalog: GiftCatalogTable; redemption_orders: RedemptionOrdersTable;
}
