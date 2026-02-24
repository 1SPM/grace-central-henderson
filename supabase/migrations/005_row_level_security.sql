-- GRACE CRM - Row Level Security Policies
-- Migration: 005_row_level_security.sql
-- NOTE: All statements use DROP IF EXISTS before CREATE for idempotent re-runs.
--
-- This migration adds proper church-scoped RLS policies.
-- Prerequisites: Supabase auth must be configured with app_metadata.church_id in JWT claims.
--
-- To apply: Run this in the Supabase SQL editor AFTER configuring auth,
-- or it will be applied automatically via Supabase CLI migrations.

-- ============================================
-- HELPER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.get_church_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'church_id')::UUID;
$$ LANGUAGE sql STABLE;

-- ============================================
-- DROP PERMISSIVE POLICIES (from initial migrations)
-- ============================================

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

-- ============================================
-- DROP ALL SCOPED POLICIES (for idempotent re-runs)
-- ============================================

-- 001 tables
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

-- 002 leader tables
DROP POLICY IF EXISTS "Church members can view leader applications" ON leader_applications;
DROP POLICY IF EXISTS "Church members can manage leader applications" ON leader_applications;
DROP POLICY IF EXISTS "Church members can view pastoral sessions" ON pastoral_sessions;
DROP POLICY IF EXISTS "Church members can manage pastoral sessions" ON pastoral_sessions;
DROP POLICY IF EXISTS "Church members can view leader availability" ON leader_availability;
DROP POLICY IF EXISTS "Church members can manage leader availability" ON leader_availability;

-- 003 tables
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

-- 002 collection tables
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
-- 001 TABLE POLICIES
-- ============================================

-- Churches: users can only see their own church
CREATE POLICY "Users can view own church"
  ON churches FOR SELECT
  USING (id = public.get_church_id());

-- Users: scoped to same church
CREATE POLICY "Users can view same-church users"
  ON users FOR SELECT
  USING (church_id = public.get_church_id());

-- People: full CRUD scoped to church
CREATE POLICY "Church members can view people"
  ON people FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can insert people"
  ON people FOR INSERT
  WITH CHECK (church_id = public.get_church_id());

CREATE POLICY "Church members can update people"
  ON people FOR UPDATE
  USING (church_id = public.get_church_id());

CREATE POLICY "Church admins can delete people"
  ON people FOR DELETE
  USING (church_id = public.get_church_id());

-- Small Groups: scoped to church
CREATE POLICY "Church members can view groups"
  ON small_groups FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage groups"
  ON small_groups FOR ALL
  USING (church_id = public.get_church_id());

-- Group Memberships: via group's church_id
CREATE POLICY "Church members can view memberships"
  ON group_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM small_groups
      WHERE small_groups.id = group_memberships.group_id
      AND small_groups.church_id = public.get_church_id()
    )
  );

CREATE POLICY "Church members can manage memberships"
  ON group_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM small_groups
      WHERE small_groups.id = group_memberships.group_id
      AND small_groups.church_id = public.get_church_id()
    )
  );

-- Interactions: scoped to church
CREATE POLICY "Church members can view interactions"
  ON interactions FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can create interactions"
  ON interactions FOR INSERT
  WITH CHECK (church_id = public.get_church_id());

-- Tasks: scoped to church
CREATE POLICY "Church members can view tasks"
  ON tasks FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage tasks"
  ON tasks FOR ALL
  USING (church_id = public.get_church_id());

-- Prayer Requests: scoped to church, private ones visible to staff+
CREATE POLICY "Church members can view public prayers"
  ON prayer_requests FOR SELECT
  USING (
    church_id = public.get_church_id()
    AND (
      NOT is_private
      OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff')
      )
    )
  );

CREATE POLICY "Church members can manage prayers"
  ON prayer_requests FOR ALL
  USING (church_id = public.get_church_id());

-- Calendar Events: scoped to church
CREATE POLICY "Church members can view events"
  ON calendar_events FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage events"
  ON calendar_events FOR ALL
  USING (church_id = public.get_church_id());

-- Attendance: scoped to church
CREATE POLICY "Church members can view attendance"
  ON attendance FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage attendance"
  ON attendance FOR ALL
  USING (church_id = public.get_church_id());

-- Giving: scoped to church
CREATE POLICY "Church members can view giving"
  ON giving FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage giving"
  ON giving FOR ALL
  USING (church_id = public.get_church_id());

-- ============================================
-- 002 TABLE POLICIES
-- ============================================

-- Leader Applications: scoped to church
CREATE POLICY "Church members can view leader applications"
  ON leader_applications FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage leader applications"
  ON leader_applications FOR ALL
  USING (church_id = public.get_church_id());

-- Pastoral Sessions: scoped to church
CREATE POLICY "Church members can view pastoral sessions"
  ON pastoral_sessions FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage pastoral sessions"
  ON pastoral_sessions FOR ALL
  USING (church_id = public.get_church_id());

-- Leader Availability: scoped to church
CREATE POLICY "Church members can view leader availability"
  ON leader_availability FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage leader availability"
  ON leader_availability FOR ALL
  USING (church_id = public.get_church_id());

-- ============================================
-- 003 TABLE POLICIES
-- ============================================

-- Scheduled Messages
CREATE POLICY "Users can view scheduled_messages for their church" ON scheduled_messages
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert scheduled_messages for their church" ON scheduled_messages
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can update scheduled_messages for their church" ON scheduled_messages
  FOR UPDATE USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can delete scheduled_messages for their church" ON scheduled_messages
  FOR DELETE USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Message Archive
CREATE POLICY "Users can view message_archive for their church" ON message_archive
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert message_archive for their church" ON message_archive
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Inbound Messages
CREATE POLICY "Users can view inbound_messages for their church" ON inbound_messages
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can update inbound_messages for their church" ON inbound_messages
  FOR UPDATE USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert inbound_messages for their church" ON inbound_messages
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Daily Digests
CREATE POLICY "Users can view their own daily_digests" ON daily_digests
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    OR church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "Users can insert daily_digests for their church" ON daily_digests
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Drip Campaigns
CREATE POLICY "Users can view drip_campaigns for their church" ON drip_campaigns
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can manage drip_campaigns for their church" ON drip_campaigns
  FOR ALL USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Drip Campaign Steps
CREATE POLICY "Users can view drip_campaign_steps for their campaigns" ON drip_campaign_steps
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM drip_campaigns
      WHERE church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
    )
  );

CREATE POLICY "Users can manage drip_campaign_steps for their campaigns" ON drip_campaign_steps
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM drip_campaigns
      WHERE church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
    )
  );

-- Drip Campaign Enrollments
CREATE POLICY "Users can view enrollments for their campaigns" ON drip_campaign_enrollments
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM drip_campaigns
      WHERE church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
    )
  );

CREATE POLICY "Users can manage enrollments for their campaigns" ON drip_campaign_enrollments
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM drip_campaigns
      WHERE church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
    )
  );

-- ============================================
-- 002_COLLECTION TABLE POLICIES
-- ============================================

-- Campaigns: scoped to church
CREATE POLICY "Church members can view campaigns"
  ON campaigns FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage campaigns"
  ON campaigns FOR ALL
  USING (church_id = public.get_church_id());

-- Pledges: scoped to church
CREATE POLICY "Church members can view pledges"
  ON pledges FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage pledges"
  ON pledges FOR ALL
  USING (church_id = public.get_church_id());

-- Donation Batches: scoped to church
CREATE POLICY "Church members can view donation batches"
  ON donation_batches FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage donation batches"
  ON donation_batches FOR ALL
  USING (church_id = public.get_church_id());

-- Batch Items: via batch's church_id
CREATE POLICY "Church members can view batch items"
  ON batch_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM donation_batches
      WHERE donation_batches.id = batch_items.batch_id
      AND donation_batches.church_id = public.get_church_id()
    )
  );

CREATE POLICY "Church members can manage batch items"
  ON batch_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM donation_batches
      WHERE donation_batches.id = batch_items.batch_id
      AND donation_batches.church_id = public.get_church_id()
    )
  );

-- Recurring Giving: scoped to church
CREATE POLICY "Church members can view recurring giving"
  ON recurring_giving FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage recurring giving"
  ON recurring_giving FOR ALL
  USING (church_id = public.get_church_id());

-- Giving Statements: scoped to church
CREATE POLICY "Church members can view giving statements"
  ON giving_statements FOR SELECT
  USING (church_id = public.get_church_id());

CREATE POLICY "Church members can manage giving statements"
  ON giving_statements FOR ALL
  USING (church_id = public.get_church_id());
