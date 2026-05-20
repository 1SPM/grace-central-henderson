-- GRACE CRM - Anchor Marketplace: Row Level Security
-- Migration: 008_anchor_marketplace_rls.sql
--
-- Closes the security gap left open by 006, which deferred RLS. The 6 anchor_*
-- tables shipped with RLS DISABLED, leaving them readable/writable by anyone
-- holding the anon key — including private pastoral chats and member PII.
--
-- Threat model note: this app uses the anon key client-side and has NO Clerk->
-- Supabase JWT integration (see 005: get_church_id() exists but auth.jwt() is
-- never populated with church_id). So genuine church-scoped RLS is not possible
-- yet. The honest, defensible posture — matching 007 — is service-role-only for
-- everything sensitive, with one deliberate exception: the public marketplace
-- listing (anchor_leaders) exposes only published+verified rows.
--
-- When the browse/intake/chat features get built, they must go through /api/*
-- endpoints using SUPABASE_SERVICE_ROLE_KEY (like /api/leader-apply already does).
--
-- All statements idempotent (IF EXISTS / IF NOT EXISTS via DROP-then-CREATE).

-- ============================================
-- ENABLE RLS ON ALL ANCHOR TABLES
-- ============================================

ALTER TABLE anchor_leaders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE anchor_ai_personas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE anchor_leader_visibility  ENABLE ROW LEVEL SECURITY;
ALTER TABLE anchor_intake_responses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE anchor_conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE anchor_messages           ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP EXISTING POLICIES (clean slate / idempotent re-run)
-- ============================================

DROP POLICY IF EXISTS "Published leaders are publicly readable" ON anchor_leaders;
DROP POLICY IF EXISTS "Anchor personas service role only"       ON anchor_ai_personas;
DROP POLICY IF EXISTS "Anchor visibility service role only"     ON anchor_leader_visibility;
DROP POLICY IF EXISTS "Anchor intake service role only"         ON anchor_intake_responses;
DROP POLICY IF EXISTS "Anchor conversations service role only"  ON anchor_conversations;
DROP POLICY IF EXISTS "Anchor messages service role only"       ON anchor_messages;

-- ============================================
-- anchor_leaders — PUBLIC READ of published+verified listings only
-- ============================================
-- This is the marketplace storefront: display_name / title / bio / photo /
-- pricing / aggregate ratings are all intended to be public. Unpublished or
-- unverified drafts stay hidden from anon/authenticated. Writes (create / verify
-- / publish) are admin actions that run through the service role, which bypasses
-- RLS — so no INSERT/UPDATE/DELETE policy is granted here.

CREATE POLICY "Published leaders are publicly readable"
  ON anchor_leaders
  FOR SELECT
  USING (is_published = true AND is_verified = true);

-- ============================================
-- anchor_ai_personas — SERVICE ROLE ONLY
-- ============================================
-- Holds the generated system_prompt, theology positions, boundaries, and
-- refusal lists. Exposing these would let anyone scrape or reverse-engineer a
-- leader's clone. The AI clone runs server-side, so RLS-enabled + no policy
-- (service role bypasses) is correct.
-- (no policy)

-- ============================================
-- anchor_leader_visibility — SERVICE ROLE ONLY
-- ============================================
-- Per-church curation + price overrides. Managed by church admins through the
-- API; not needed client-side. No policy => service role only.
-- (no policy)

-- ============================================
-- anchor_intake_responses — SERVICE ROLE ONLY
-- ============================================
-- Member quiz answers including free_text and tone/gender preferences — PII tied
-- to a person_id. No policy => service role only.
-- (no policy)

-- ============================================
-- anchor_conversations — SERVICE ROLE ONLY
-- ============================================
-- Private pastoral AI-clone chat threads, including crisis flags. Highly
-- sensitive. No policy => service role only.
-- (no policy)

-- ============================================
-- anchor_messages — SERVICE ROLE ONLY
-- ============================================
-- The actual private message content of those conversations. No policy =>
-- service role only.
-- (no policy)

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY "Published leaders are publicly readable" ON anchor_leaders IS
  'Anon/authenticated may read only published+verified marketplace listings. Writes via service role.';
