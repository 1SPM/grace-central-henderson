/**
 * usePortalActivity — admin-side reads of the member_activity_events
 * tracking spine. Powers the Portal Activity page and the Dashboard
 * engagement cards.
 *
 * Demo mode: no Supabase → returns empty data with isDemo=true so the
 * page can render a guided empty state.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createLogger } from '../utils/logger';
import type { MemberActivityEvent } from '../lib/database.types';

const log = createLogger('portal-activity');

export interface PortalEngagementSummary {
  /** Distinct members with any portal event in the last 7 days */
  activeMembers7d: number;
  logins7d: number;
  rsvps7d: number;
  gifts7d: number;
  careMessages7d: number;
  checkins7d: number;
  community7d: number;
  totalEvents30d: number;
  /** My Journey tab views in the last 7 days */
  journeyViews7d: number;
  /** Milestone step requests submitted by members in the last 7 days */
  stepRequests7d: number;
}

export interface MemberEngagementRow {
  personId: string;
  lastActiveAt: string;
  eventCount30d: number;
  byType: Record<string, number>;
}

const EMPTY_SUMMARY: PortalEngagementSummary = {
  activeMembers7d: 0,
  logins7d: 0,
  rsvps7d: 0,
  gifts7d: 0,
  careMessages7d: 0,
  checkins7d: 0,
  community7d: 0,
  totalEvents30d: 0,
  journeyViews7d: 0,
  stepRequests7d: 0,
};

export function usePortalActivity(churchId: string) {
  const [events, setEvents] = useState<MemberActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadCounter, setReloadCounter] = useState(0);
  const isDemo = !isSupabaseConfigured();

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase!
        .from('member_activity_events')
        .select('*')
        .eq('church_id', churchId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (cancelled) return;
      if (error) {
        log.warn('activity load failed', error.message);
      } else {
        setEvents((data ?? []) as MemberActivityEvent[]);
      }
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [churchId, reloadCounter]);

  const summary = useMemo<PortalEngagementSummary>(() => {
    if (events.length === 0) return EMPTY_SUMMARY;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = events.filter(e => new Date(e.created_at).getTime() >= sevenDaysAgo);
    const activePeople = new Set(recent.map(e => e.person_id).filter(Boolean));
    const count = (type: string) => recent.filter(e => e.event_type === type).length;
    const communityTypes = ['community_post', 'group_post', 'community_react', 'community_comment', 'connection_request', 'connection_accept'];
    return {
      activeMembers7d: activePeople.size,
      logins7d: count('login'),
      rsvps7d: count('rsvp'),
      gifts7d: count('gift'),
      careMessages7d: count('care_message') + count('help_request'),
      checkins7d: count('checkin'),
      community7d: recent.filter(e => communityTypes.includes(e.event_type)).length,
      totalEvents30d: events.length,
      journeyViews7d: count('journey_view'),
      stepRequests7d: count('milestone_step_request'),
    };
  }, [events]);

  const memberRollup = useMemo<MemberEngagementRow[]>(() => {
    const byPerson = new Map<string, MemberEngagementRow>();
    for (const e of events) {
      if (!e.person_id) continue;
      const row = byPerson.get(e.person_id) ?? {
        personId: e.person_id,
        lastActiveAt: e.created_at,
        eventCount30d: 0,
        byType: {},
      };
      row.eventCount30d++;
      row.byType[e.event_type] = (row.byType[e.event_type] ?? 0) + 1;
      if (new Date(e.created_at) > new Date(row.lastActiveAt)) {
        row.lastActiveAt = e.created_at;
      }
      byPerson.set(e.person_id, row);
    }
    return Array.from(byPerson.values()).sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
    );
  }, [events]);

  return { events, summary, memberRollup, isLoading, isDemo, reload };
}
