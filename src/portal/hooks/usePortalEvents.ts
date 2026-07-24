import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';

export interface PortalEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string | null;
  category: string;
  my_rsvp: { status: 'yes' | 'no' | 'maybe'; guest_count: number } | null;
}

export function usePortalEvents() {
  const { getAuthToken } = usePortalAuth();
  const [events, setEvents] = useState<PortalEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rsvpingId, setRsvpingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workosFetch<{ events: PortalEvent[] }>('/api/portal/events', getAuthToken);
      setEvents(result.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const rsvp = useCallback(async (eventId: string, status: 'yes' | 'no' | 'maybe', guestCount = 0) => {
    setRsvpingId(eventId);
    try {
      await workosFetch('/api/portal/events', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId, status, guest_count: guestCount }),
      });
      await refresh();
    } finally {
      setRsvpingId(null);
    }
  }, [getAuthToken, refresh]);

  return { events, isLoading, error, rsvpingId, refresh, rsvp };
}
