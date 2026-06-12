/**
 * /api/care/conversations
 *
 * Member-portal care chat backed by the anchor_* tables (RLS is
 * service-role-only, so this route is the only data path).
 *
 *   GET  — list the caller's conversations (member: own rows only)
 *   POST — create a help request: conversation + first message(s)
 *
 * Auth: Clerk Bearer with church_id claim. The caller's person row is
 * resolved server-side from people.clerk_user_id — clients can never
 * read or write another member's care thread.
 *
 * Crisis handling: category 'crisis' (or crisis keywords in the
 * description) flags the conversation immediately; the Phase D
 * crisis-escalation agent and the admin dashboard pick it up.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';
import { readBody, str, bool_ } from '../_lib/validation.js';
import { detectCrisis, priorityForCategory } from '../_lib/care/crisis.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CREATE_SCHEMA = {
  category: str({ required: true, max: 40, pattern: /^[a-z-]+$/ }),
  description: str({ max: 4000 }),
  is_anonymous: bool_(),
  leader_id: str({ max: 60, pattern: /^[0-9a-fA-F-]+$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const auth = await requireClerkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // Resolve the caller's person record.
  const { data: person } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .eq('clerk_user_id', auth.clerkUserId)
    .eq('church_id', auth.churchId)
    .maybeSingle();

  if (req.method === 'GET') {
    if (!person) return res.status(200).json({ conversations: [] });

    const { data: conversations, error } = await supabase
      .from('anchor_conversations')
      .select('*')
      .eq('church_id', auth.churchId)
      .eq('person_id', person.id)
      .order('last_message_at', { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: 'read_failed' });

    const ids = (conversations ?? []).map(c => c.id);
    let messages: unknown[] = [];
    if (ids.length > 0) {
      const { data: msgs, error: msgErr } = await supabase
        .from('anchor_messages')
        .select('*')
        .in('conversation_id', ids)
        .order('created_at', { ascending: true });
      if (msgErr) return res.status(500).json({ error: 'read_failed' });
      messages = msgs ?? [];
    }
    return res.status(200).json({ conversations: conversations ?? [], messages });
  }

  if (req.method === 'POST') {
    const body = readBody(req, res, CREATE_SCHEMA);
    if (!body) return;
    const { category, description, is_anonymous, leader_id } = body;

    if (!person && !is_anonymous) {
      return res.status(403).json({ error: 'no_member_record' });
    }

    const crisis = category === 'crisis' || (description ? detectCrisis(description) : false);
    const priority = crisis ? 'crisis' : priorityForCategory(category!);
    const anonymousSessionId = is_anonymous || !person
      ? `anon-${Math.random().toString(36).slice(2, 10)}`
      : null;

    const { data: conversation, error: convErr } = await supabase
      .from('anchor_conversations')
      .insert({
        church_id: auth.churchId,
        leader_id: leader_id ?? null,
        person_id: is_anonymous ? null : person?.id ?? null,
        anonymous_session_id: anonymousSessionId,
        status: 'active',
        topic: category,
        category,
        priority,
        crisis_flagged: crisis,
        crisis_flagged_at: crisis ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (convErr || !conversation) {
      console.error('[care/conversations] create failed', convErr);
      return res.status(500).json({ error: 'create_failed' });
    }

    const messages: Record<string, unknown>[] = [];
    if (description) {
      messages.push({
        conversation_id: conversation.id,
        sender: 'member',
        content: description,
        is_crisis_flag: crisis,
      });
    }
    messages.push({
      conversation_id: conversation.id,
      sender: 'system',
      content: crisis
        ? 'Your message has been flagged for immediate pastoral attention. If you are in immediate danger, please call 911 or the 988 Suicide & Crisis Lifeline.'
        : 'Thank you for reaching out. A member of our care team will be with you shortly.',
    });
    const { data: insertedMessages, error: msgErr } = await supabase
      .from('anchor_messages')
      .insert(messages)
      .select();
    if (msgErr) console.error('[care/conversations] message insert failed', msgErr);

    // Activity spine: record the help request.
    await supabase.from('member_activity_events').insert({
      church_id: auth.churchId,
      person_id: is_anonymous ? null : person?.id ?? null,
      event_type: 'help_request',
      entity_type: 'anchor_conversation',
      entity_id: conversation.id,
      metadata: { category, priority, crisis, anonymous: !!is_anonymous },
    });

    return res.status(201).json({ conversation, messages: insertedMessages ?? [] });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
