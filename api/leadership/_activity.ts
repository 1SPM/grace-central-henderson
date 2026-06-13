/**
 * GET /api/leadership/activity
 *
 * Rolls up care conversations, message senders, and member care events
 * per leader for the Leadership hub activity monitor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STAFF_ROLES = ['admin', 'pastor', 'staff'];

interface LeaderRollup {
  leaderId: string;
  displayName: string;
  humanMessages: number;
  aiMessages: number;
  conversations: number;
  lastActiveAt: string | null;
  crisisOpen: number;
}

interface ActivityEvent {
  at: string;
  type: string;
  leaderId?: string;
  memberName?: string;
  preview: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const auth = await requireClerkAuth(req, { allowedRoles: STAFF_ROLES });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: conversations, error: convErr } = await supabase
    .from('anchor_conversations')
    .select('id, leader_id, person_id, crisis_flagged, status, last_message_at, topic')
    .eq('church_id', auth.churchId)
    .order('last_message_at', { ascending: false })
    .limit(200);
  if (convErr) return res.status(500).json({ error: 'read_failed' });

  const convs = conversations ?? [];
  const convIds = convs.map(c => c.id);

  let messages: {
    conversation_id: string;
    sender: string;
    content: string;
    created_at: string;
  }[] = [];

  if (convIds.length > 0) {
    const { data: msgs, error: msgErr } = await supabase
      .from('anchor_messages')
      .select('conversation_id, sender, content, created_at')
      .in('conversation_id', convIds)
      .gte('created_at', since7d)
      .order('created_at', { ascending: false });
    if (msgErr) return res.status(500).json({ error: 'read_failed' });
    messages = msgs ?? [];
  }

  const { data: memberEvents } = await supabase
    .from('member_activity_events')
    .select('person_id, event_type, metadata, created_at')
    .eq('church_id', auth.churchId)
    .in('event_type', ['help_request', 'care_message'])
    .gte('created_at', since7d)
    .order('created_at', { ascending: false })
    .limit(50);

  const personIds = Array.from(
    new Set(convs.map(c => c.person_id).filter((id): id is string => !!id)),
  );
  const peopleMap = new Map<string, string>();
  if (personIds.length > 0) {
    const { data: peopleRows } = await supabase
      .from('people')
      .select('id, first_name, last_name')
      .in('id', personIds);
    for (const p of peopleRows ?? []) {
      peopleMap.set(p.id, `${p.first_name} ${p.last_name}`.trim());
    }
  }

  const convById = new Map(convs.map(c => [c.id, c]));
  const rollupMap = new Map<string, LeaderRollup>();

  const ensureLeader = (leaderId: string) => {
    if (!rollupMap.has(leaderId)) {
      rollupMap.set(leaderId, {
        leaderId,
        displayName: leaderId === '__unassigned__' ? 'Unassigned' : leaderId,
        humanMessages: 0,
        aiMessages: 0,
        conversations: 0,
        lastActiveAt: null,
        crisisOpen: 0,
      });
    }
    return rollupMap.get(leaderId)!;
  };

  for (const conv of convs) {
    const key = conv.leader_id ?? '__unassigned__';
    const row = ensureLeader(key);
    row.conversations += 1;
    if (conv.crisis_flagged && conv.status !== 'closed') row.crisisOpen += 1;
    if (!row.lastActiveAt || conv.last_message_at > row.lastActiveAt) {
      row.lastActiveAt = conv.last_message_at;
    }
  }

  let humanReplies24h = 0;
  let aiReplies24h = 0;

  for (const msg of messages) {
    const conv = convById.get(msg.conversation_id);
    const key = conv?.leader_id ?? '__unassigned__';
    const row = ensureLeader(key);
    if (msg.sender === 'human_leader') {
      row.humanMessages += 1;
      if (msg.created_at >= since24h) humanReplies24h += 1;
    } else if (msg.sender === 'ai_clone') {
      row.aiMessages += 1;
      if (msg.created_at >= since24h) aiReplies24h += 1;
    }
    if (!row.lastActiveAt || msg.created_at > row.lastActiveAt) {
      row.lastActiveAt = msg.created_at;
    }
  }

  const recentEvents: ActivityEvent[] = [];

  for (const msg of messages.slice(0, 30)) {
    const conv = convById.get(msg.conversation_id);
    const leaderId = conv?.leader_id ?? undefined;
    const memberName = conv?.person_id ? peopleMap.get(conv.person_id) : undefined;
    if (msg.sender === 'human_leader') {
      recentEvents.push({
        at: msg.created_at,
        type: 'human_reply',
        leaderId,
        memberName,
        preview: msg.content.slice(0, 120),
      });
    } else if (msg.sender === 'ai_clone') {
      recentEvents.push({
        at: msg.created_at,
        type: 'ai_reply',
        leaderId,
        memberName,
        preview: msg.content.slice(0, 120),
      });
    }
  }

  for (const ev of memberEvents ?? []) {
    const meta = (ev.metadata ?? {}) as Record<string, unknown>;
    recentEvents.push({
      at: ev.created_at,
      type: ev.event_type,
      leaderId: typeof meta.leader_id === 'string' ? meta.leader_id : undefined,
      memberName: ev.person_id ? peopleMap.get(ev.person_id) : undefined,
      preview: ev.event_type === 'help_request' ? 'New help request' : 'Member care message',
    });
  }

  recentEvents.sort((a, b) => (a.at > b.at ? -1 : 1));

  const leaderIds = Array.from(rollupMap.keys()).filter(k => k !== '__unassigned__');
  const summary = {
    totalLeaders: leaderIds.length,
    activeConversations: convs.filter(c => c.status === 'active').length,
    humanReplies24h,
    aiReplies24h,
    unassigned: convs.filter(c => !c.leader_id && c.status === 'active').length,
  };

  return res.status(200).json({
    summary,
    leaders: Array.from(rollupMap.values()),
    recentEvents: recentEvents.slice(0, 40),
  });
}
