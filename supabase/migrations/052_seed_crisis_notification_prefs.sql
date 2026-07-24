-- GRACE — seed crisis-email notification defaults for existing staff
-- Migration: 052_seed_crisis_notification_prefs.sql
--
-- One-time default: every active staff member whose role grants
-- care.view gets crisis/email/enabled=true, matching the Stage 5 build
-- plan's intent ("crisis email defaults ON for roles holding the care
-- key"). Before this, defaults were only lazily seeded when a staff
-- member first opened Settings → Notifications — which meant a church
-- whose staff had never visited that card (Central Henderson, at the
-- time of the 2026-07-18 review) had ZERO crisis alert coverage: a
-- crisis-flagged care request would create the Decision Queue finding
-- but email nobody.
--
-- ON CONFLICT DO NOTHING preserves any explicit opt-out that already
-- exists. This intentionally writes to ALL tenants including Central
-- Henderson — it is a notification-config default, not member data.
-- The lazy seeding in api/workos/_notification-prefs.ts still covers
-- staff created after this migration, and api/_lib/crisisNotify.ts's
-- fallback (same change set) covers churches with no rows at all.
--
-- Idempotent.

INSERT INTO staff_notification_prefs (church_id, user_id, category, channel, enabled)
SELECT u.church_id, u.id, 'crisis', 'email', true
FROM users u
WHERE u.account_status = 'active'
  AND u.church_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = u.id
      AND ur.revoked_at IS NULL
      AND p.key = 'care.view'
  )
ON CONFLICT (user_id, category, channel) DO NOTHING;
