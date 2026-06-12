/**
 * POST /api/care/messages
 *
 * Appends a message to a care conversation (member side of the chat).
 * Staff replies also come through here with sender 'human_leader'.
 *
 * Body: { conversation_id, content, sender? }
 *   sender defaults to 'member'; only staff roles may post as
 *   'human_leader'.
 *
 * Crisis keywords in any member message flag the conversation.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';
import { readBody, str } from '../_lib/validation.js';
import { detectCrisis } from '../_lib/care/crisis.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STAFF_ROLES = ['admin', 'pastor', 'staff'];

const SCHEMA = {
  conversation_id: str({ required: true, max: 60, pattern: /^[0-9a-fA-F-]+$/ }),
  content: str({ required: true, max: 4000 }),
  sender: str({ max: 20, pattern: /^(member|human_leader)$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const auth = await requireClerkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = readBody(req, res, SCHEMA);
  if (!body) return;
  const { conversation_id, content } = body;
  const sender = body.sender ?? 'member';

  const isStaff = STAFF_ROLES.includes(auth.role);
  if (sender === 'human_leader' && !isStaff) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const { data: conversation, error: convErr } = await supabase
    .from('anchor_conversations')
    .select('id, church_id, person_id, crisis_flagged, category')
    .eq('id', conversation_id)
    .eq('church_id', auth.churchId)
    .maybeSingle();
  if (convErr) return res.status(500).json({ error: 'read_failed' });
  if (!conversation) return res.status(404).json({ error: 'conversation_not_found' });

  // Members may only post into their own conversation.
  if (!isStaff) {
    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('clerk_user_id', auth.clerkUserId)
      .eq('church_id', auth.churchId)
      .maybeSingle();
    if (!person || conversation.person_id !== person.id) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }

  const crisis = sender === 'member' && detectCrisis(content!);

  const { data: message, error: msgErr } = await supabase
    .from('anchor_messages')
    .insert({
      conversation_id,
      sender,
      content,
      is_crisis_flag: crisis,
    })
    .select()
    .single();
  if (msgErr || !message) return res.status(500).json({ error: 'message_insert_failed' });

  const convUpdates: Record<string, unknown> = { last_message_at: new Date().toISOString() };
  if (crisis && !conversation.crisis_flagged) {
    convUpdates.crisis_flagged = true;
    convUpdates.crisis_flagged_at = new Date().toISOString();
    convUpdates.priority = 'crisis';
  }
  await supabase.from('anchor_conversations').update(convUpdates).eq('id', conversation_id);

  if (sender === 'member') {
    await supabase.from('member_activity_events').insert({
      church_id: auth.churchId,
      person_id: conversation.person_id,
      event_type: 'care_message',
      entity_type: 'anchor_conversation',
      entity_id: conversation_id,
      metadata: { category: conversation.category, crisis },
    });
  }

  return res.status(201).json({ message, crisis_flagged: crisis || conversation.crisis_flagged });
}
