-- GRACE — Admin Dashboard WorkOS: inline artifact content
-- Migration: 040_artifact_inline_content.sql
--
-- `artifacts` (migration 037) was designed as a pointer table
-- (storage_url) on the assumption of an external storage integration that
-- doesn't exist yet (no Supabase Storage wiring in this phase — see
-- TECH_DEBT.md). The Work Order completion-report feature needs
-- somewhere to persist a generated report today. Rather than block on
-- storage integration, add a small inline-content column for
-- server-generated text/JSON artifacts; `storage_url` remains the path
-- for file uploads once that integration lands.
--
-- Idempotent.

ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS content TEXT;

COMMENT ON COLUMN artifacts.content IS
  'Inline text/JSON content for server-generated artifacts (e.g. a Work Order completion report) when no external storage integration is wired. Mutually informative with storage_url, not exclusive — a future file-upload artifact would use storage_url instead.';
