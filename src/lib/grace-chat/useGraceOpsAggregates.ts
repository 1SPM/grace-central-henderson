/**
 * Portal + card-program aggregates for the Ask Grace system context
 * (Phase D). Lets admins ask GRACE about member-portal engagement and
 * the Impact Card program.
 *
 * Reads tables with church-scoped SELECT RLS directly (no API hop):
 *   member_activity_events, kyc_verifications, cards, interchange_events.
 * Refreshes every 5 minutes; returns '' in demo mode so the context
 * string simply omits the sections.
 */

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';

const REFRESH_MS = 5 * 60_000;

export function useGraceOpsAggregates(churchId: string | undefined): string {
  const [context, setContext] = useState('');

  useEffect(() => {
    if (!churchId || !isSupabaseConfigured() || !supabase) return;
    const sb = supabase;
    let cancelled = false;

    const refresh = async () => {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);

        const [activityRes, kycRes, cardsRes, interchangeRes] = await Promise.all([
          sb.from('member_activity_events')
            .select('event_type, person_id, metadata')
            .eq('church_id', churchId)
            .gte('created_at', sevenDaysAgo)
            .limit(2000),
          sb.from('kyc_verifications')
            .select('status')
            .eq('church_id', churchId)
            .limit(500),
          sb.from('cards')
            .select('status')
            .eq('church_id', churchId)
            .limit(1000),
          sb.from('interchange_events')
            .select('event_type, direction, amount_micro_usd')
            .eq('church_id', churchId)
            .gte('occurred_at', monthStart.toISOString())
            .limit(2000),
        ]);
        if (cancelled) return;

        const lines: string[] = [];

        const activity = activityRes.data ?? [];
        if (!activityRes.error) {
          const count = (t: string) => activity.filter(e => e.event_type === t).length;
          const activeMembers = new Set(activity.map(e => e.person_id).filter(Boolean)).size;
          const careCount = count('care_message') + count('help_request');
          const crisisCount = activity.filter(e =>
            (e.event_type === 'care_message' || e.event_type === 'help_request') &&
            (e.metadata as Record<string, unknown> | null)?.crisis === true,
          ).length;
          lines.push(
            `Member portal (last 7d): ${activeMembers} active members; ${count('login')} logins; ` +
            `${count('rsvp')} RSVPs; ${count('gift')} gifts; ${count('checkin')} check-ins; ` +
            `${careCount} care messages${crisisCount > 0 ? ` (${crisisCount} CRISIS-FLAGGED — needs pastoral attention)` : ''}.`,
          );
        }

        const kyc = kycRes.data ?? [];
        const cards = cardsRes.data ?? [];
        const interchange = interchangeRes.data ?? [];
        if (!kycRes.error && !cardsRes.error && (kyc.length > 0 || cards.length > 0)) {
          const pendingKyc = kyc.filter(k => k.status === 'pending' || k.status === 'in_review').length;
          const activeCards = cards.filter(c => c.status === 'active').length;
          const frozenCards = cards.filter(c => c.status === 'frozen').length;
          const interchangeMtd = interchange
            .filter(e => e.event_type === 'fee' && e.direction === 'credit')
            .reduce((s, e) => s + Number(e.amount_micro_usd), 0) / 1_000_000;
          const spendMtd = interchange
            .filter(e => e.event_type === 'capture' && e.direction === 'debit')
            .reduce((s, e) => s + Number(e.amount_micro_usd), 0) / 1_000_000;
          lines.push(
            `GRACE Impact Card program: ${pendingKyc} pending KYC application${pendingKyc === 1 ? '' : 's'}; ` +
            `${activeCards} active cards (${frozenCards} frozen); ` +
            `interchange revenue MTD $${interchangeMtd.toFixed(2)}; card spend MTD $${spendMtd.toFixed(2)}.`,
          );
        }

        setContext(lines.join('\n'));
      } catch {
        // Aggregates are additive context — never break chat over them.
      }
    };

    void refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [churchId]);

  return context;
}
