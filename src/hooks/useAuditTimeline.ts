import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

export interface AuditTimelineEntry {
  id: string;
  kind: 'audit' | 'event';
  timestamp: string;
  actor_user_id: string | null;
  actor_person_id: string | null;
  label: string;
  entity_type: string | null;
  entity_id: string | null;
  source_app: string | null;
  correlation_id: string | null;
  detail: Record<string, unknown>;
}

interface TimelineResponse { entries: AuditTimelineEntry[] }

export interface AuditTimelineFilters {
  entityType?: string;
  action?: string;
  eventType?: string;
  q?: string;
  limit?: number;
}

export function useAuditTimeline() {
  const { getAuthToken } = useAuthContext();
  const [entries, setEntries] = useState<AuditTimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const search = useCallback(async (filters?: AuditTimelineFilters) => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const params = new URLSearchParams();
      if (filters?.entityType) params.set('entity_type', filters.entityType);
      if (filters?.action) params.set('action', filters.action);
      if (filters?.eventType) params.set('event_type', filters.eventType);
      if (filters?.q) params.set('q', filters.q);
      if (filters?.limit) params.set('limit', String(filters.limit));
      const qs = params.toString();
      const data = await workosFetch<TimelineResponse>(`/api/audit/timeline${qs ? `?${qs}` : ''}`, getAuthToken);
      setEntries(data.entries);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Failed to load audit timeline');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void search(); }, [search]);

  return { entries, isLoading, error, forbidden, search };
}
