import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface MailInboxStats {
  total: number;
  needsReview: number;
  flagged: number;
  loading: boolean;
}

const EMPTY: MailInboxStats = { total: 0, needsReview: 0, flagged: 0, loading: true };

/**
 * Polls grace_inbox_messages for counts that the Home page can surface.
 * - total: undismissed rows period
 * - needsReview: not flagged, not auto-handled, has at least one parsed action
 * - flagged: crisis-flagged rows that need a personal response
 *
 * Refreshes every 60s. Same cadence as the Mail tab itself so the badge stays
 * roughly in sync without piling on Supabase queries.
 */
export function useMailInboxStats(): MailInboxStats {
  const [stats, setStats] = useState<MailInboxStats>(EMPTY);

  useEffect(() => {
    const sb = supabase;
    if (!sb) { setStats({ ...EMPTY, loading: false }); return; }
    let cancelled = false;

    const fetchStats = async () => {
      const { data, error } = await sb
        .from('grace_inbox_messages')
        .select('id, flag, auto_summary, reply_sent_at, parsed_actions')
        .is('dismissed_at', null)
        .limit(500);
      if (cancelled || error || !data) return;

      let needsReview = 0;
      let flagged = 0;
      for (const row of data as Array<{
        flag: string | null;
        auto_summary: string | null;
        reply_sent_at: string | null;
        parsed_actions: unknown;
      }>) {
        if (row.flag === 'crisis') { flagged++; continue; }
        const handled = !!row.auto_summary || !!row.reply_sent_at;
        const actionCount = Array.isArray(row.parsed_actions) ? row.parsed_actions.length : 0;
        if (!handled && actionCount > 0) needsReview++;
      }

      setStats({ total: data.length, needsReview, flagged, loading: false });
    };

    void fetchStats();
    const interval = setInterval(fetchStats, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return stats;
}
