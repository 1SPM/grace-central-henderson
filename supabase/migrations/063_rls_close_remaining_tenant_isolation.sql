-- 063_rls_close_remaining_tenant_isolation.sql
--
-- Closes the finding from the independent security review: ~30 church_id
-- tables still carried a church-only `tenant_isolation` FOR ALL policy on role
-- `public`. Because permissive RLS policies are OR'd, that policy overrode the
-- "member self access" policies on the private tables — so any authenticated
-- member could read/write EVERY other member's consents, notifications, comms
-- preferences, journey items, and volunteer interests in their church, and
-- write staff-operational tables directly (bypassing the permission-gated
-- routes). Verified live via pg_policies.
--
-- Lockout-safe (no staging DB): only 7 of these tables are read directly by
-- the browser; the rest go through service-role API routes (bypass RLS). The
-- gating perms used (work_orders.view / communications.view / people.view /
-- people.manage) are all held by member_services (the only non-admin staff
-- role with users) + system_administrator. demo_anon_read is never dropped.
--
-- Deferred (documented residual): `announcements`, `calendar_events` keep the
-- church-only policy for now — members must retain READ (broadcast content) and
-- write-gating them by communications.manage/events.manage could lock out
-- member_services, which lacks those. Decide who manages them, then gate write.

-- ── Group A — member-private (drop church-wide; member-self policy remains) ──
drop policy if exists "tenant_isolation" on public.communication_preferences;
drop policy if exists "tenant_isolation" on public.consents;
drop policy if exists "tenant_isolation" on public.data_subject_requests;
drop policy if exists "tenant_isolation" on public.member_journey_items;
drop policy if exists "tenant_isolation" on public.notifications;
drop policy if exists "tenant_isolation" on public.volunteer_interests;

-- ── Group B — service-role-only (drop church-wide; deny browser, app uses service role) ──
drop policy if exists "tenant_isolation" on public.agent_actions;
drop policy if exists "tenant_isolation" on public.agent_executions;
drop policy if exists "tenant_isolation" on public.agent_findings;
drop policy if exists "tenant_isolation" on public.agent_runs;
drop policy if exists "tenant_isolation" on public.agent_stats;
drop policy if exists "tenant_isolation" on public.artifacts;
drop policy if exists "tenant_isolation" on public.campaigns;
drop policy if exists "tenant_isolation" on public.daily_digests;
drop policy if exists "tenant_isolation" on public.drip_campaigns;
drop policy if exists "tenant_isolation" on public.health_snapshots;
drop policy if exists "tenant_isolation" on public.leader_applications;
drop policy if exists "tenant_isolation" on public.leader_availability;
drop policy if exists "tenant_isolation" on public.portal_preview_tokens;
drop policy if exists "tenant_isolation" on public.staff_notification_prefs;
drop policy if exists "tenant_isolation" on public.validations;
drop policy if exists "tenant_isolation" on public.work_order_evidence;
drop policy if exists "tenant_isolation" on public.work_order_tasks;

-- ── Group C — staff read-only in browser (gate SELECT; writes are service-role) ──
drop policy if exists "tenant_isolation" on public.agent_logs;
create policy "agent_logs read" on public.agent_logs for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'work_orders.view'));

drop policy if exists "tenant_isolation" on public.message_archive;
create policy "message_archive read" on public.message_archive for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'communications.view'));

drop policy if exists "tenant_isolation" on public.scheduled_messages;
create policy "scheduled_messages read" on public.scheduled_messages for select
  using (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'communications.view'));

-- ── Group D — mixed member/staff ──
-- discipleship_milestones: a member may read their OWN; staff read via people.view, write via people.manage.
drop policy if exists "discipleship_milestones church scoped" on public.discipleship_milestones;
create policy "discipleship_milestones read" on public.discipleship_milestones for select
  using (church_id = get_church_id()
         and (person_id = get_person_id()
              or user_has_permission(get_app_user_id(), get_church_id(), 'people.view')));
create policy "discipleship_milestones write" on public.discipleship_milestones for all
  using      (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'people.manage'))
  with check (church_id = get_church_id() and user_has_permission(get_app_user_id(), get_church_id(), 'people.manage'));

-- event_rsvps: attendance is church-visible (low sensitivity); a member may
-- create/change their OWN RSVP; staff manage all via events.manage.
drop policy if exists "event_rsvps church scoped" on public.event_rsvps;
create policy "event_rsvps read" on public.event_rsvps for select
  using (church_id = get_church_id());
create policy "event_rsvps write" on public.event_rsvps for all
  using      (church_id = get_church_id()
              and (person_id = get_person_id()
                   or user_has_permission(get_app_user_id(), get_church_id(), 'events.manage')))
  with check (church_id = get_church_id()
              and (person_id = get_person_id()
                   or user_has_permission(get_app_user_id(), get_church_id(), 'events.manage')));

-- Rollback: recreate the church-only ALL policy per table, e.g.
--   create policy "tenant_isolation" on public.<t> for all
--     using (church_id = get_church_id()) with check (church_id = get_church_id());
-- (for announcements/discipleship_milestones/event_rsvps the original names were
-- "<t> church scoped"). Instant, non-destructive.
