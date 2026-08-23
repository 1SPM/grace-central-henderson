-- GRACE — allow FK-cascaded SET NULL through append-only tables
-- Migration: 054_append_only_fk_cascade_fix.sql
--
-- BUG: member_activity_events.person_id, ledger_entries.related_person_id,
-- platform_events.actor_person_id, and interchange_events.card_id are all
-- `REFERENCES ... ON DELETE SET NULL`. Postgres implements that FK action
-- as an internal UPDATE on the referencing row. Each of those four tables
-- also carries a BEFORE UPDATE OR DELETE trigger that unconditionally
-- RAISE EXCEPTIONs to enforce append-only-ness (010/012/013/015/017/036
-- pattern). The FK's own internal UPDATE fires that same trigger, so it
-- raises too — meaning:
--
--   DELETE FROM people WHERE id = ...
--
-- fails with "member_activity_events is append-only" (or the ledger/
-- platform_events equivalent) for ANY person with activity/ledger/event
-- history, with no workaround via plain SQL. Confirmed live against the
-- Faithful demo tenant (church_id 22222222-2222-2222-2222-222222222222).
-- Same shape for `cards`: it has no append-only trigger of its own, but
-- deleting a `cards` row SET NULLs interchange_events.card_id, which
-- hits interchange_events' block trigger the same way.
--
-- This blocks a legitimate, anticipated operation — `people` deletion is
-- how `deletePerson()` (src/hooks/useSupabaseData.ts) already works, and
-- `data_subject_requests` (migration 033) exists specifically to drive
-- GDPR/CCPA erasure, which assumes a person can actually be hard-deleted.
--
-- FIX: each trigger function now permits exactly one shape of UPDATE —
-- the identifying FK column flipping from NOT NULL to NULL with every
-- other column unchanged (row-for-row, via IS NOT DISTINCT FROM on the
-- nullable columns). That is precisely what an FK's own SET NULL action
-- produces; a hand-written UPDATE that also touches the FK column plus
-- anything else, or that nulls the column without changing nothing else,
-- still falls through to RAISE EXCEPTION. All DELETEs are still blocked
-- unconditionally — the append-only guarantee against direct mutation is
-- unchanged.
--
-- ledger_entries.ledger_entry_id-style self-reference note: interchange_
-- events.ledger_entry_id -> ledger_entries(id) ON DELETE SET NULL is not
-- handled here because ledger_entries rows can never be deleted in the
-- first place (its own trigger blocks DELETE unconditionally), so that
-- cascade path can never fire.
--
-- Idempotent: CREATE OR REPLACE FUNCTION.

-- ============================================
-- member_activity_events
-- ============================================
CREATE OR REPLACE FUNCTION public.member_activity_events_block_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.person_id IS NOT NULL AND NEW.person_id IS NULL
     AND NEW.id = OLD.id
     AND NEW.church_id = OLD.church_id
     AND NEW.event_type = OLD.event_type
     AND NEW.entity_type IS NOT DISTINCT FROM OLD.entity_type
     AND NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id
     AND NEW.metadata = OLD.metadata
     AND NEW.created_at = OLD.created_at
  THEN
    -- people.id ON DELETE SET NULL cascade, not a direct mutation.
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'member_activity_events is append-only';
END;
$$;

-- ============================================
-- ledger_entries
-- ============================================
CREATE OR REPLACE FUNCTION public.ledger_entries_block_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.related_person_id IS NOT NULL AND NEW.related_person_id IS NULL
     AND NEW.id = OLD.id
     AND NEW.church_id = OLD.church_id
     AND NEW.source = OLD.source
     AND NEW.source_event_id = OLD.source_event_id
     AND NEW.kind = OLD.kind
     AND NEW.direction = OLD.direction
     AND NEW.amount_micro_usd = OLD.amount_micro_usd
     AND NEW.currency = OLD.currency
     AND NEW.description IS NOT DISTINCT FROM OLD.description
     AND NEW.related_giving_id IS NOT DISTINCT FROM OLD.related_giving_id
     AND NEW.occurred_at = OLD.occurred_at
     AND NEW.metadata = OLD.metadata
     AND NEW.created_at = OLD.created_at
  THEN
    -- people.id ON DELETE SET NULL cascade, not a direct mutation.
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ledger_entries is append-only; UPDATE/DELETE are not permitted (op=%, id=%). Write a correction entry instead.', TG_OP, OLD.id;
END;
$$;

-- ============================================
-- platform_events
-- ============================================
CREATE OR REPLACE FUNCTION public.platform_events_block_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.actor_person_id IS NOT NULL AND NEW.actor_person_id IS NULL
     AND NEW.id = OLD.id
     AND NEW.church_id = OLD.church_id
     AND NEW.event_type = OLD.event_type
     AND NEW.source_app = OLD.source_app
     AND NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id
     AND NEW.subject_type IS NOT DISTINCT FROM OLD.subject_type
     AND NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id
     AND NEW.payload = OLD.payload
     AND NEW.correlation_id = OLD.correlation_id
     AND NEW.created_at = OLD.created_at
  THEN
    -- people.id ON DELETE SET NULL cascade, not a direct mutation.
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'platform_events is append-only; UPDATE/DELETE are not permitted (op=%)', TG_OP;
END;
$$;

-- ============================================
-- interchange_events
-- ============================================
CREATE OR REPLACE FUNCTION public.interchange_events_block_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.card_id IS NOT NULL AND NEW.card_id IS NULL
     AND NEW.id = OLD.id
     AND NEW.church_id = OLD.church_id
     AND NEW.i2c_event_id = OLD.i2c_event_id
     AND NEW.event_type = OLD.event_type
     AND NEW.direction = OLD.direction
     AND NEW.amount_micro_usd = OLD.amount_micro_usd
     AND NEW.currency = OLD.currency
     AND NEW.merchant_name IS NOT DISTINCT FROM OLD.merchant_name
     AND NEW.merchant_category IS NOT DISTINCT FROM OLD.merchant_category
     AND NEW.decline_reason IS NOT DISTINCT FROM OLD.decline_reason
     AND NEW.ledger_entry_id IS NOT DISTINCT FROM OLD.ledger_entry_id
     AND NEW.occurred_at = OLD.occurred_at
     AND NEW.metadata = OLD.metadata
     AND NEW.created_at = OLD.created_at
  THEN
    -- cards.id ON DELETE SET NULL cascade, not a direct mutation.
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'interchange_events is append-only; UPDATE/DELETE are not permitted (op=%, id=%). Write a kind=reversal event instead.', TG_OP, OLD.id;
END;
$$;
