-- GRACE CRM - Row Level Security Policies
-- Migration: 005_row_level_security.sql
--
-- DEV MODE: Permissive policies that allow all access.
-- When Clerk JWT is configured with app_metadata.church_id,
-- replace these with church-scoped policies for production.

-- ============================================
-- HELPER FUNCTION (for future church-scoped policies)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_church_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'church_id')::UUID;
$$ LANGUAGE sql STABLE;

-- ============================================
-- ENSURE RLS IS ENABLED (required for policies to work)
-- ============================================

ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE small_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE giving ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastoral_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_campaign_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_giving ENABLE ROW LEVEL SECURITY;
ALTER TABLE giving_statements ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP ALL EXISTING POLICIES (clean slate)
-- ============================================

-- 001 tables
DROP POLICY IF EXISTS "Service role full access" ON churches;
DROP POLICY IF EXISTS "Service role full access" ON users;
DROP POLICY IF EXISTS "Service role full access" ON people;
DROP POLICY IF EXISTS "Service role full access" ON small_groups;
DROP POLICY IF EXISTS "Service role full access" ON group_memberships;
DROP POLICY IF EXISTS "Service role full access" ON interactions;
DROP POLICY IF EXISTS "Service role full access" ON tasks;
DROP POLICY IF EXISTS "Service role full access" ON prayer_requests;
DROP POLICY IF EXISTS "Service role full access" ON calendar_events;
DROP POLICY IF EXISTS "Service role full access" ON attendance;
DROP POLICY IF EXISTS "Service role full access" ON giving;
DROP POLICY IF EXISTS "Service role full access" ON leader_applications;
DROP POLICY IF EXISTS "Service role full access" ON pastoral_sessions;
DROP POLICY IF EXISTS "Service role full access" ON leader_availability;
DROP POLICY IF EXISTS "Service role full access" ON scheduled_messages;
DROP POLICY IF EXISTS "Service role full access" ON message_archive;
DROP POLICY IF EXISTS "Service role full access" ON inbound_messages;
DROP POLICY IF EXISTS "Service role full access" ON daily_digests;
DROP POLICY IF EXISTS "Service role full access" ON drip_campaigns;
DROP POLICY IF EXISTS "Service role full access" ON drip_campaign_steps;
DROP POLICY IF EXISTS "Service role full access" ON drip_campaign_enrollments;
DROP POLICY IF EXISTS "Service role full access" ON campaigns;
DROP POLICY IF EXISTS "Service role full access" ON pledges;
DROP POLICY IF EXISTS "Service role full access" ON donation_batches;
DROP POLICY IF EXISTS "Service role full access" ON batch_items;
DROP POLICY IF EXISTS "Service role full access" ON recurring_giving;
DROP POLICY IF EXISTS "Service role full access" ON giving_statements;

-- Scoped policies (from previous version of this migration)
DROP POLICY IF EXISTS "Users can view own church" ON churches;
DROP POLICY IF EXISTS "Users can view same-church users" ON users;
DROP POLICY IF EXISTS "Church members can view people" ON people;
DROP POLICY IF EXISTS "Church members can insert people" ON people;
DROP POLICY IF EXISTS "Church members can update people" ON people;
DROP POLICY IF EXISTS "Church admins can delete people" ON people;
DROP POLICY IF EXISTS "Church members can view groups" ON small_groups;
DROP POLICY IF EXISTS "Church members can manage groups" ON small_groups;
DROP POLICY IF EXISTS "Church members can view memberships" ON group_memberships;
DROP POLICY IF EXISTS "Church members can manage memberships" ON group_memberships;
DROP POLICY IF EXISTS "Church members can view interactions" ON interactions;
DROP POLICY IF EXISTS "Church members can create interactions" ON interactions;
DROP POLICY IF EXISTS "Church members can view tasks" ON tasks;
DROP POLICY IF EXISTS "Church members can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Church members can view public prayers" ON prayer_requests;
DROP POLICY IF EXISTS "Church members can manage prayers" ON prayer_requests;
DROP POLICY IF EXISTS "Church members can view events" ON calendar_events;
DROP POLICY IF EXISTS "Church members can manage events" ON calendar_events;
DROP POLICY IF EXISTS "Church members can view attendance" ON attendance;
DROP POLICY IF EXISTS "Church members can manage attendance" ON attendance;
DROP POLICY IF EXISTS "Church members can view giving" ON giving;
DROP POLICY IF EXISTS "Church members can manage giving" ON giving;
DROP POLICY IF EXISTS "Church members can view leader applications" ON leader_applications;
DROP POLICY IF EXISTS "Church members can manage leader applications" ON leader_applications;
DROP POLICY IF EXISTS "Church members can view pastoral sessions" ON pastoral_sessions;
DROP POLICY IF EXISTS "Church members can manage pastoral sessions" ON pastoral_sessions;
DROP POLICY IF EXISTS "Church members can view leader availability" ON leader_availability;
DROP POLICY IF EXISTS "Church members can manage leader availability" ON leader_availability;
DROP POLICY IF EXISTS "Users can view scheduled_messages for their church" ON scheduled_messages;
DROP POLICY IF EXISTS "Users can insert scheduled_messages for their church" ON scheduled_messages;
DROP POLICY IF EXISTS "Users can update scheduled_messages for their church" ON scheduled_messages;
DROP POLICY IF EXISTS "Users can delete scheduled_messages for their church" ON scheduled_messages;
DROP POLICY IF EXISTS "Users can view message_archive for their church" ON message_archive;
DROP POLICY IF EXISTS "Users can insert message_archive for their church" ON message_archive;
DROP POLICY IF EXISTS "Users can view inbound_messages for their church" ON inbound_messages;
DROP POLICY IF EXISTS "Users can update inbound_messages for their church" ON inbound_messages;
DROP POLICY IF EXISTS "Users can insert inbound_messages for their church" ON inbound_messages;
DROP POLICY IF EXISTS "Users can view their own daily_digests" ON daily_digests;
DROP POLICY IF EXISTS "Users can insert daily_digests for their church" ON daily_digests;
DROP POLICY IF EXISTS "Users can view drip_campaigns for their church" ON drip_campaigns;
DROP POLICY IF EXISTS "Users can manage drip_campaigns for their church" ON drip_campaigns;
DROP POLICY IF EXISTS "Users can view drip_campaign_steps for their campaigns" ON drip_campaign_steps;
DROP POLICY IF EXISTS "Users can manage drip_campaign_steps for their campaigns" ON drip_campaign_steps;
DROP POLICY IF EXISTS "Users can view enrollments for their campaigns" ON drip_campaign_enrollments;
DROP POLICY IF EXISTS "Users can manage enrollments for their campaigns" ON drip_campaign_enrollments;
DROP POLICY IF EXISTS "Church members can view campaigns" ON campaigns;
DROP POLICY IF EXISTS "Church members can manage campaigns" ON campaigns;
DROP POLICY IF EXISTS "Church members can view pledges" ON pledges;
DROP POLICY IF EXISTS "Church members can manage pledges" ON pledges;
DROP POLICY IF EXISTS "Church members can view donation batches" ON donation_batches;
DROP POLICY IF EXISTS "Church members can manage donation batches" ON donation_batches;
DROP POLICY IF EXISTS "Church members can view batch items" ON batch_items;
DROP POLICY IF EXISTS "Church members can manage batch items" ON batch_items;
DROP POLICY IF EXISTS "Church members can view recurring giving" ON recurring_giving;
DROP POLICY IF EXISTS "Church members can manage recurring giving" ON recurring_giving;
DROP POLICY IF EXISTS "Church members can view giving statements" ON giving_statements;
DROP POLICY IF EXISTS "Church members can manage giving statements" ON giving_statements;

-- ============================================
-- DEV: PERMISSIVE POLICIES (allow all access)
-- ============================================
-- These use USING (true) / WITH CHECK (true) so the anon key works.
-- For production, replace with church-scoped policies.

CREATE POLICY "Service role full access" ON churches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON people FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON small_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON group_memberships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON interactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON prayer_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON calendar_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON giving FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leader_applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pastoral_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON leader_availability FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON scheduled_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON message_archive FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON inbound_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON daily_digests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON drip_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON drip_campaign_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON drip_campaign_enrollments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pledges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON donation_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON batch_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON recurring_giving FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON giving_statements FOR ALL USING (true) WITH CHECK (true);
