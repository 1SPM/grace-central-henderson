/**
 * useRealtimeNotifications — Supabase Realtime subscriptions for the
 * admin notification center (Phase D).
 *
 * Subscribes to INSERTs on:
 *   - grace_inbox_messages   (Grace-processed email, crisis flags)
 *   - member_activity_events (portal logins, RSVPs, gifts, care, card)
 *
 * Replaces polling for "something new happened" — the existing 60s
 * polls remain as a fallback for environments where Realtime isn't
 * enabled on the publication.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createLogger } from '../utils/logger';

const log = createLogger('realtime');

export interface LiveNotification {
  id: string;
  kind: 'inbox' | 'crisis' | 'portal' | 'agent';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

const MAX_NOTIFICATIONS = 50;

interface InboxPayload {
  id: string;
  from_email: string;
  subject: string | null;
  flag: string | null;
}

interface ActivityPayload {
  id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
}

const ACTIVITY_TITLES: Record<string, string> = {
  login: 'Portal sign-in',
  rsvp: 'New RSVP from the portal',
  checkin: 'Portal check-in',
  gift: 'New gift from the portal',
  prayer: 'New prayer request',
  care_message: 'New care message',
  help_request: 'New pastoral help request',
  kyc_submitted: 'Impact Card application',
  card_issued: 'Impact Card issued',
  card_txn: 'Impact Card transaction',
};

const AGENT_TITLES: Record<string, string> = {
  'member-care': 'Member care alert',
  'stewardship': 'Giving insight',
  'operations': 'Operations alert',
  'portal-engagement': 'Portal engagement alert',
  'card-ops': 'Card operations alert',
  'crisis-escalation': 'Crisis escalation',
};

interface AgentLogPayload {
  id: string;
  agent_id: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at?: string;
}

function agentNotification(row: AgentLogPayload): LiveNotification | null {
  if (!row.message.startsWith('observation:')) return null;
  const kind = row.message.slice('observation:'.length).replace(/[_-]/g, ' ');
  const severity = typeof row.metadata?.severity === 'string' ? row.metadata.severity : undefined;
  const isCrisis = row.agent_id === 'crisis-escalation' || severity === 'urgent';
  return {
    id: `agent-${row.id}`,
    kind: isCrisis ? 'crisis' : 'agent',
    title: AGENT_TITLES[row.agent_id] ?? `Agent: ${row.agent_id}`,
    body: kind.charAt(0).toUpperCase() + kind.slice(1),
    createdAt: row.created_at ?? new Date().toISOString(),
    read: false,
  };
}

export function useRealtimeNotifications(churchId: string | undefined) {
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [connected, setConnected] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  const push = useCallback((n: LiveNotification) => {
    if (seenRef.current.has(n.id)) return;
    seenRef.current.add(n.id);
    setNotifications(prev => [n, ...prev].slice(0, MAX_NOTIFICATIONS));
  }, []);

  // Backfill recent agent observations (stewardship, member-care, …).
  // The agent cron runs early morning while nobody is online, so a
  // realtime-only bell would never show its output. Pull the last 48h
  // of observations on mount; realtime keeps it current after that.
  useEffect(() => {
    if (!churchId || !isSupabaseConfigured() || !supabase) return;
    const sb = supabase;
    let cancelled = false;
    void (async () => {
      const sinceIso = new Date(Date.now() - 48 * 3_600_000).toISOString();
      const { data, error } = await sb
        .from('agent_logs')
        .select('id, agent_id, message, metadata, created_at')
        .eq('church_id', churchId)
        .like('message', 'observation:%')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(15);
      if (cancelled || error || !data) return;
      const items = (data as AgentLogPayload[])
        .map(agentNotification)
        .filter((n): n is LiveNotification => n !== null)
        .filter(n => !seenRef.current.has(n.id));
      if (items.length === 0) return;
      for (const n of items) seenRef.current.add(n.id);
      setNotifications(prev =>
        [...prev, ...items]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, MAX_NOTIFICATIONS),
      );
    })();
    return () => { cancelled = true; };
  }, [churchId]);

  useEffect(() => {
    if (!churchId || !isSupabaseConfigured() || !supabase) return;
    const sb = supabase;

    const channel = sb
      .channel(`admin-notifications-${churchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'grace_inbox_messages', filter: `church_id=eq.${churchId}` },
        (payload) => {
          const row = payload.new as InboxPayload;
          push({
            id: `inbox-${row.id}`,
            kind: row.flag === 'crisis' ? 'crisis' : 'inbox',
            title: row.flag === 'crisis' ? 'Crisis-flagged email' : 'New email handled by Grace',
            body: `${row.from_email}${row.subject ? ` — ${row.subject}` : ''}`,
            createdAt: new Date().toISOString(),
            read: false,
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_logs', filter: `church_id=eq.${churchId}` },
        (payload) => {
          const n = agentNotification(payload.new as AgentLogPayload);
          if (n) push(n);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'member_activity_events', filter: `church_id=eq.${churchId}` },
        (payload) => {
          const row = payload.new as ActivityPayload;
          // Logins are too chatty for the bell; they still land in Portal Activity.
          if (row.event_type === 'login') return;
          const crisis = row.metadata?.crisis === true;
          push({
            id: `activity-${row.id}`,
            kind: crisis ? 'crisis' : 'portal',
            title: crisis ? 'Crisis flag in member care' : ACTIVITY_TITLES[row.event_type] ?? `Portal: ${row.event_type}`,
            body: typeof row.metadata?.category === 'string' ? `Category: ${row.metadata.category}` : 'Open Portal Activity for details',
            createdAt: new Date().toISOString(),
            read: false,
          });
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') log.warn('realtime channel error — notifications degraded to polling');
      });

    return () => { void sb.removeChannel(channel); };
  }, [churchId, push]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, connected, markAllRead, clear };
}
