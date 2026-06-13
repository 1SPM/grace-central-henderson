import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  fetchCommunityPosts,
  fetchConnections,
  fetchConnectionRequests,
  computeGroupCommunityStats,
  computeChurchCommunitySummary,
  getDemoCommunityDataForCRM,
  type GroupCommunityStats,
  type ChurchCommunitySummary,
} from '../lib/services/community';
import type { SmallGroup, Person } from '../types';
import type { MemberActivityEvent } from '../lib/database.types';

export function useGroupCommunityActivity(
  churchId: string | undefined,
  groups: SmallGroup[],
  people: Person[],
) {
  const [activityEvents, setActivityEvents] = useState<MemberActivityEvent[]>([]);
  const [posts, setPosts] = useState(getDemoCommunityDataForCRM().posts);
  const [connections, setConnections] = useState(getDemoCommunityDataForCRM().connections);
  const [requests, setRequests] = useState(getDemoCommunityDataForCRM().requests);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadCounter, setReloadCounter] = useState(0);

  const reload = useCallback(() => setReloadCounter(c => c + 1), []);

  useEffect(() => {
    if (!churchId) {
      setIsLoading(false);
      return;
    }

    void (async () => {
      setIsLoading(true);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      if (!isSupabaseConfigured() || !supabase) {
        const demo = getDemoCommunityDataForCRM();
        setPosts(demo.posts);
        setConnections(demo.connections);
        setRequests(demo.requests);
        setActivityEvents([]);
        setIsLoading(false);
        return;
      }

      const [postsRes, conns, reqs, eventsRes] = await Promise.all([
        fetchCommunityPosts(churchId, 'all'),
        fetchConnections(churchId),
        fetchConnectionRequests(churchId),
        supabase
          .from('member_activity_events')
          .select('*')
          .eq('church_id', churchId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);

      setPosts(postsRes);
      setConnections(conns);
      setRequests(reqs);
      setActivityEvents((eventsRes.data ?? []) as MemberActivityEvent[]);
      setIsLoading(false);
    })();
  }, [churchId, reloadCounter]);

  const churchSummary = useMemo<ChurchCommunitySummary>(() =>
    computeChurchCommunitySummary(
      groups.filter(g => g.isActive),
      posts,
      connections,
      requests,
      activityEvents.map(e => ({
        personId: e.person_id,
        createdAt: e.created_at,
      })),
    ),
  [groups, posts, connections, requests, activityEvents]);

  const getGroupStats = useCallback((groupId: string): GroupCommunityStats | null => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return null;
    return computeGroupCommunityStats(
      group,
      people,
      posts,
      activityEvents.map(e => ({
        personId: e.person_id,
        createdAt: e.created_at,
        eventType: e.event_type,
        metadata: e.metadata,
      })),
      connections,
    );
  }, [groups, people, posts, activityEvents, connections]);

  return { churchSummary, getGroupStats, posts, connections, requests, isLoading, reload };
}
