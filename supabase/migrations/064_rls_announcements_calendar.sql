-- 064_rls_announcements_calendar.sql
--
-- The two tables deferred in 063. Both are broadcast content that members must
-- be able to READ, so church-scoped SELECT is preserved; WRITE now requires the
-- domain view permission (communications.view for announcements, events.view
-- for calendar_events). member_services holds both (no lockout); plain members
-- hold neither, so their previous direct church-wide write is removed.
-- demo_anon_read preserved. Tighten to .manage later for stricter separation.
--
-- Applied to prod + verified: after this, ZERO church_id tables remain on a
-- church-only permissive ALL policy — the independent-review tenant_isolation
-- finding is fully closed.

drop policy if exists "announcements church scoped" on public.announcements;
create policy "announcements read" on public.announcements for select
  using (church_id = get_church_id());
create policy "announcements write" on public.announcements for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'communications.view'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'communications.view'));

drop policy if exists "tenant_isolation" on public.calendar_events;
create policy "calendar_events read" on public.calendar_events for select
  using (church_id = get_church_id());
create policy "calendar_events write" on public.calendar_events for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'events.view'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'events.view'));

-- Rollback:
--   drop policy "announcements read"/"announcements write" → recreate "announcements church scoped" (ALL, church-only)
--   drop policy "calendar_events read"/"calendar_events write" → recreate "tenant_isolation" (ALL, church-only)
