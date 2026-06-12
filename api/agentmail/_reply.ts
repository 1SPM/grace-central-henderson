import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { replyToThread } from '../_lib/agentmail-send.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;

interface ReplyBody {
  inbox_id?: string;
  message_id?: string;
  inbox_message_row_id?: string;
  text?: string;
  draft_with_grace?: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!AGENTMAIL_API_KEY) return res.status(503).json({ error: 'AgentMail not configured' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'Supabase not configured' });

  const { inbox_id, message_id, inbox_message_row_id, text } = (req.body || {}) as ReplyBody;
  if (!inbox_id || !message_id || !inbox_message_row_id || !text?.trim()) {
    return res.status(400).json({ error: 'inbox_id, message_id, inbox_message_row_id, and text are required' });
  }
  if (text.length > 10_000) return res.status(400).json({ error: 'Reply too long' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // Verify the row exists so we don't let arbitrary strangers send via our inbox
  const { data: row, error: rowErr } = await supabase
    .from('grace_inbox_messages')
    .select('id, church_id, person_id, source_inbox_id, source_message_id')
    .eq('id', inbox_message_row_id)
    .single();

  if (rowErr || !row) return res.status(404).json({ error: 'Inbox row not found' });
  if (row.source_inbox_id !== inbox_id || row.source_message_id !== message_id) {
    return res.status(400).json({ error: 'inbox_id or message_id mismatch' });
  }

  const result = await replyToThread({
    apiKey: AGENTMAIL_API_KEY,
    inboxId: inbox_id,
    messageId: message_id,
    text: text.trim(),
  });

  if (!result.ok) {
    console.warn('[agentmail-reply] AgentMail returned', result.status, result.error);
    return res.status(502).json({ error: 'AgentMail rejected the reply', detail: result.error });
  }

  const agentMailMessageId = result.message_id;

  if (row.person_id) {
    await supabase.from('interactions').insert({
      church_id: row.church_id,
      person_id: row.person_id,
      type: 'email',
      content: `[Reply via Grace Mail]\n\n${text.trim()}`,
      created_by: null,
      created_by_name: 'Pastor (via Grace Mail)',
    });
  }

  await supabase
    .from('grace_inbox_messages')
    .update({ reply_sent_at: new Date().toISOString() })
    .eq('id', row.id);

  return res.status(200).json({ ok: true, agent_mail_message_id: agentMailMessageId });
}
