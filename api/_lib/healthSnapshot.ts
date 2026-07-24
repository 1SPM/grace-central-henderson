/**
 * IO wrapper around api/_lib/healthMetrics.ts's pure functions — fetches
 * the raw rows for one church and either returns them (for the live
 * "current" read in api/impact/_health.ts) or computes + upserts a
 * health_snapshots row (for the nightly cron).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { computeHealthMetrics, type HealthMetricsInput, type HealthMetricsResult } from './healthMetrics.js';

const EVENTS_WINDOW_DAYS = 90;

export async function fetchHealthMetricsInput(
  supabase: SupabaseClient,
  churchId: string,
  now: Date,
): Promise<HealthMetricsInput> {
  const eventsSince = new Date(now.getTime() - EVENTS_WINDOW_DAYS * 86_400_000).toISOString();

  const [
    { data: people },
    { data: recurringGivers },
    { data: groupMemberships },
    { data: careRequests },
    { data: events },
  ] = await Promise.all([
    supabase
      .from('people')
      .select('id, status, first_visit, portal_enabled, clerk_user_id, first_name, last_name')
      .eq('church_id', churchId)
      .limit(10_000),
    supabase
      .from('recurring_giving')
      .select('person_id')
      .eq('church_id', churchId)
      .eq('status', 'active')
      .limit(10_000),
    supabase
      .from('group_memberships')
      .select('person_id, small_groups!inner(church_id)')
      .eq('small_groups.church_id', churchId)
      .eq('status', 'active')
      .limit(10_000),
    supabase
      .from('care_requests')
      .select('created_at')
      .eq('church_id', churchId)
      .eq('status', 'submitted')
      .limit(10_000),
    supabase
      .from('member_activity_events')
      .select('person_id, event_type, created_at')
      .eq('church_id', churchId)
      .gte('created_at', eventsSince)
      .limit(20_000),
  ]);

  return {
    people: (people ?? []) as HealthMetricsInput['people'],
    activeRecurringGivers: (recurringGivers ?? []) as HealthMetricsInput['activeRecurringGivers'],
    activeGroupMemberships: (groupMemberships ?? []) as HealthMetricsInput['activeGroupMemberships'],
    openCareRequests: (careRequests ?? []) as HealthMetricsInput['openCareRequests'],
    events: (events ?? []) as HealthMetricsInput['events'],
    now,
  };
}

export async function snapshotHealthForChurch(
  supabase: SupabaseClient,
  churchId: string,
  now: Date,
): Promise<HealthMetricsResult> {
  const input = await fetchHealthMetricsInput(supabase, churchId, now);
  const metrics = computeHealthMetrics(input);

  await supabase.from('health_snapshots').upsert(
    {
      church_id: churchId,
      snapshot_date: now.toISOString().slice(0, 10),
      metrics,
    },
    { onConflict: 'church_id,snapshot_date' },
  );

  return metrics;
}
