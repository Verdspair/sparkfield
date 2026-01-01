import { sql } from 'kysely';
import type { AppDatabase } from './client.js';

export const DEFAULT_SEASON_TERM_ID = 'S1-TERM-01';

export async function migrateDatabase(db: AppDatabase): Promise<void> {
  await db.transaction().execute(async (tx) => {
    await sql`select pg_advisory_xact_lock(102026, 1)`.execute(tx);
    await sql.raw(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY, username text UNIQUE NOT NULL, nickname text NOT NULL, email text UNIQUE NULL,
        password_hash text NOT NULL, role text NOT NULL DEFAULT 'player' CHECK (role IN ('player','editor','admin')),
        session_epoch integer NOT NULL DEFAULT 1 CHECK(session_epoch > 0),
        onboarding_choice text NOT NULL DEFAULT 'unset' CHECK (onboarding_choice IN ('unset','cards','micro_match','skipped')),
        learning_start_json jsonb NOT NULL DEFAULT '{}', preferred_arena text NOT NULL DEFAULT 'orbital_elevator_port',
        display_settings_json jsonb NOT NULL DEFAULT '{"fullscreen":true,"orientation":"landscape"}',
        avatar_frame_id text NULL, board_plaque_id text NULL, highest_unit_stars_json jsonb NOT NULL DEFAULT '{}',
        cohort_group text NULL, created_at timestamptz NOT NULL DEFAULT now(),
        CHECK(email IS NULL OR length(trim(email)) > 0)
      );
      CREATE TABLE IF NOT EXISTS user_sessions (
        token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), session_epoch integer NOT NULL,
        expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS user_sessions_user ON user_sessions(user_id);
      CREATE TABLE IF NOT EXISTS season_terms (
        id text PRIMARY KEY, label text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
        is_active boolean NOT NULL DEFAULT false, rewards_settled boolean NOT NULL DEFAULT false,
        CHECK(ends_at > starts_at)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_season_term ON season_terms(is_active) WHERE is_active;
      CREATE TABLE IF NOT EXISTS mode_standings (
        season_term_id text NOT NULL REFERENCES season_terms(id),
        duration_mode text NOT NULL CHECK(duration_mode IN ('quick','standard','deep')),
        user_id text NOT NULL REFERENCES users(id), mu double precision NOT NULL, sigma double precision NOT NULL CHECK(sigma > 0),
        ordinal double precision NOT NULL, tier_label text NOT NULL, rank_score integer NOT NULL,
        matches_played integer NOT NULL DEFAULT 0 CHECK(matches_played >= 0), updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(season_term_id,duration_mode,user_id)
      );
      CREATE INDEX IF NOT EXISTS standings_leaderboard ON mode_standings(season_term_id,duration_mode,rank_score DESC);
      CREATE TABLE IF NOT EXISTS course_packs (
        pack_id text NOT NULL, course_pack_version text NOT NULL, pack_json jsonb NOT NULL,
        content_sha256 text NOT NULL CHECK(length(content_sha256)=64), subject text NOT NULL CHECK(subject IN ('english','math')),
        is_active boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(pack_id,course_pack_version)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_course_pack_version ON course_packs(pack_id) WHERE is_active;
      CREATE TABLE IF NOT EXISTS learning_fsrs_cards (
        user_id text NOT NULL REFERENCES users(id), family_id text NOT NULL, subject text NOT NULL CHECK(subject IN ('english','math')),
        knowledge_node text NOT NULL, state_json jsonb NOT NULL, due_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,family_id,subject)
      );
      CREATE INDEX IF NOT EXISTS fsrs_due_queue ON learning_fsrs_cards(user_id,due_at);
      CREATE TABLE IF NOT EXISTS learning_attempts (
        id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), question_id text NOT NULL, family_id text NOT NULL,
        subject text NOT NULL CHECK(subject IN ('english','math')), course_pack_version text NOT NULL, knowledge_node text NOT NULL,
        is_correct boolean NOT NULL, answer_json jsonb NOT NULL, is_offline_unverified boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS attempts_user_created ON learning_attempts(user_id,created_at DESC);
      CREATE TABLE IF NOT EXISTS question_issue_reports (
        id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), question_id text NOT NULL,
        pack_version text NOT NULL, attempt_ref text NOT NULL REFERENCES learning_attempts(id),
        reason_code text NOT NULL CHECK(reason_code IN ('typo_or_formula','ambiguous_stem','wrong_answer_key','media_broken','other')),
        detail_optional text NULL CHECK(length(detail_optional)<=300), created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS matches (
        id text PRIMARY KEY, season_term_id text NOT NULL REFERENCES season_terms(id), game_set_version text NOT NULL,
        course_pack_version text NOT NULL, course_pack_id text NULL,
        duration_mode text NOT NULL CHECK(duration_mode IN ('quick','standard','deep')),
        queue_type text NOT NULL CHECK(queue_type IN ('ranked','casual','solo')),
        status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed')),
        created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz NULL,
        FOREIGN KEY(course_pack_id,course_pack_version) REFERENCES course_packs(pack_id,course_pack_version)
      );
      CREATE TABLE IF NOT EXISTS match_participants (
        match_id text NOT NULL REFERENCES matches(id), seat_id text NOT NULL, user_id text NULL REFERENCES users(id),
        is_bot boolean NOT NULL, final_rank integer NOT NULL CHECK(final_rank BETWEEN 1 AND 8),
        quarter_points integer NOT NULL CHECK(quarter_points>=0), final_board_snapshot jsonb NOT NULL, wrong_question_ids jsonb NOT NULL,
        PRIMARY KEY(match_id,seat_id), UNIQUE(match_id,user_id), CHECK((is_bot AND user_id IS NULL) OR (NOT is_bot AND user_id IS NOT NULL)),
        CHECK(jsonb_typeof(final_board_snapshot)='object'), CHECK(jsonb_typeof(wrong_question_ids)='array')
      );
      CREATE TABLE IF NOT EXISTS gift_catalog (
        id text PRIMARY KEY, title text NOT NULL, description text NOT NULL, points_cost integer NOT NULL CHECK(points_cost>0),
        stock_remaining integer NOT NULL CHECK(stock_remaining>=0), is_sample_reward boolean NOT NULL DEFAULT true
      );
      CREATE TABLE IF NOT EXISTS reward_points_ledger (
        id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), points_delta integer NOT NULL CHECK(points_delta<>0),
        reason text NOT NULL, idempotency_key text UNIQUE NOT NULL, related_order_id text NULL,
        related_attempt_id text NULL REFERENCES learning_attempts(id),
        compensates_ledger_id text UNIQUE NULL REFERENCES reward_points_ledger(id), created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS ledger_user ON reward_points_ledger(user_id);
      CREATE TABLE IF NOT EXISTS reward_task_quotas (
        user_id text NOT NULL REFERENCES users(id), task_key text NOT NULL, quota_window text NOT NULL,
        idempotency_key text UNIQUE NOT NULL, ledger_id text UNIQUE NOT NULL REFERENCES reward_points_ledger(id),
        created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,task_key,quota_window)
      );
      CREATE TABLE IF NOT EXISTS redemption_orders (
        id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), gift_id text NOT NULL REFERENCES gift_catalog(id),
        gift_title text NOT NULL, points_cost integer NOT NULL CHECK(points_cost>0),
        status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled_compensated')),
        idempotency_key text UNIQUE NOT NULL, debit_ledger_id text UNIQUE NOT NULL REFERENCES reward_points_ledger(id),
        compensation_ledger_id text UNIQUE NULL REFERENCES reward_points_ledger(id), created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE OR REPLACE FUNCTION protect_ledger_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE original reward_points_ledger%ROWTYPE;
      BEGIN
        IF NEW.points_delta > 0 AND NEW.related_attempt_id IS NOT NULL AND EXISTS
          (SELECT 1 FROM learning_attempts WHERE id=NEW.related_attempt_id AND is_offline_unverified)
          THEN RAISE EXCEPTION 'offline unverified attempts cannot mint reward points' USING ERRCODE='23514'; END IF;
        IF NEW.compensates_ledger_id IS NOT NULL THEN
          SELECT * INTO original FROM reward_points_ledger WHERE id=NEW.compensates_ledger_id;
          IF NOT FOUND OR original.user_id<>NEW.user_id OR original.points_delta>=0
            OR NEW.points_delta<>-original.points_delta OR original.related_order_id IS DISTINCT FROM NEW.related_order_id
            THEN RAISE EXCEPTION 'invalid ledger compensation' USING ERRCODE='23514'; END IF;
        END IF;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS ledger_insert_guard ON reward_points_ledger;
      CREATE TRIGGER ledger_insert_guard BEFORE INSERT ON reward_points_ledger FOR EACH ROW EXECUTE FUNCTION protect_ledger_insert();
      CREATE OR REPLACE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'append-only history: %', TG_TABLE_NAME USING ERRCODE='23514'; END $$;
      DROP TRIGGER IF EXISTS ledger_append_only ON reward_points_ledger;
      CREATE TRIGGER ledger_append_only BEFORE UPDATE OR DELETE ON reward_points_ledger FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
      DROP TRIGGER IF EXISTS quotas_append_only ON reward_task_quotas;
      CREATE TRIGGER quotas_append_only BEFORE UPDATE OR DELETE ON reward_task_quotas FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
      DROP TRIGGER IF EXISTS attempts_append_only ON learning_attempts;
      CREATE TRIGGER attempts_append_only BEFORE UPDATE OR DELETE ON learning_attempts FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
      CREATE OR REPLACE FUNCTION protect_course_pack() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'immutable course pack'; END IF;
        IF (to_jsonb(OLD)-'is_active') IS DISTINCT FROM (to_jsonb(NEW)-'is_active') THEN
          RAISE EXCEPTION 'immutable course pack content';
        END IF;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS immutable_pack ON course_packs;
      CREATE TRIGGER immutable_pack BEFORE UPDATE OR DELETE ON course_packs FOR EACH ROW EXECUTE FUNCTION protect_course_pack();
      CREATE OR REPLACE FUNCTION protect_match_version_lock() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF (OLD.season_term_id,OLD.game_set_version,OLD.course_pack_version,OLD.course_pack_id,OLD.duration_mode,OLD.queue_type)
          IS DISTINCT FROM (NEW.season_term_id,NEW.game_set_version,NEW.course_pack_version,NEW.course_pack_id,NEW.duration_mode,NEW.queue_type)
          THEN RAISE EXCEPTION 'immutable match version lock'; END IF;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS immutable_match_versions ON matches;
      CREATE TRIGGER immutable_match_versions BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION protect_match_version_lock();
      CREATE OR REPLACE FUNCTION protect_redemption_history() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP='DELETE' THEN RAISE EXCEPTION 'redemption history cannot be deleted'; END IF;
        IF (to_jsonb(OLD)-'status'-'compensation_ledger_id') IS DISTINCT FROM (to_jsonb(NEW)-'status'-'compensation_ledger_id')
          OR OLD.status<>'confirmed' OR NEW.status<>'cancelled_compensated' OR NEW.compensation_ledger_id IS NULL
          THEN RAISE EXCEPTION 'only compensated cancellation is allowed'; END IF;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS immutable_redemption_history ON redemption_orders;
      CREATE TRIGGER immutable_redemption_history BEFORE UPDATE OR DELETE ON redemption_orders FOR EACH ROW EXECUTE FUNCTION protect_redemption_history();
    `).execute(tx);
    await tx.insertInto('season_terms').values({ id: DEFAULT_SEASON_TERM_ID, label: 'S1 第一赛季',
      starts_at: '2026-09-01T00:00:00Z', ends_at: '2027-02-01T00:00:00Z',
      is_active: sql<boolean>`NOT EXISTS (SELECT 1 FROM season_terms WHERE is_active)` }).onConflict((oc) => oc.column('id').doNothing()).execute();
    await tx.insertInto('gift_catalog').values([
      { id: 'local-notebook', title: '星港精装笔记本', description: '示例兑换物品', points_cost: 100, stock_remaining: 20, is_sample_reward: true },
      { id: 'local-bookmark', title: '定制金属书签', description: '示例兑换物品', points_cost: 60, stock_remaining: 20, is_sample_reward: true },
      { id: 'local-folder', title: '星轨归纳活页夹', description: '示例兑换物品', points_cost: 150, stock_remaining: 20, is_sample_reward: true },
    ]).onConflict((oc) => oc.column('id').doNothing()).execute();
  });
}
