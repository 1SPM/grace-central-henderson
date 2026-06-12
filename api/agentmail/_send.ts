import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendFresh } from '../_lib/agentmail-send.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
const FROM_INBOX = process.env.AGENTMAIL_FROM_INBOX || 'askgrace@agentmail.to';

interface SendBody {
  person_id?: string;
  to?: string;
  subject?: string;
  text?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!AGENTMAIL_API_KEY) return res.status(503).json({ error: 'AgentMail not configured' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'Supabase not configured' });

  const { person_id, to, subject, text } = (req.body || {}) as SendBody;
  if (!subject?.trim() || !text?.trim()) {
    return res.status(400).json({ error: 'subject and text are required' });
  }
  if (text.length > 10_000) return res.status(400).json({ error: 'Text too long' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // Resolve recipient: either an explicit address (with safety) or a Person id we look up.
  let recipientEmail = to?.trim().toLowerCase();
  let churchId: string | null = null;
  let resolvedPersonId: string | null = null;

  if (person_id) {
    const { data: person, error } = await supabase
      .from('people')
      .select('id, church_id, email, first_name, last_name')
      .eq('id', person_id)
      .single();
    if (error || !person) return res.status(404).json({ error: 'Person not found' });
    if (!person.email) return res.status(400).json({ error: 'Person has no email on file' });
    recipientEmail = person.email;
    churchId = person.church_id;
    resolvedPersonId = person.id;
  } else if (recipientEmail) {
    const { data: person } = await supabase
      .from('people')
      .select('id, church_id')
      .ilike('email', recipientEmail)
      .limit(1)
      .single();
    churchId = person?.church_id ?? null;
    resolvedPersonId = person?.id ?? null;
  } else {
    return res.status(400).json({ error: 'person_id or to is required' });
  }

  if (!recipientEmail) return res.status(400).json({ error: 'No recipient address resolved' });

  const result = await sendFresh({
    apiKey: AGENTMAIL_API_KEY,
    inboxId: FROM_INBOX,
    to: recipientEmail,
    subject: subject.trim(),
    text: text.trim(),
  });

  if (!result.ok) {
    console.warn('[agentmail-send] failed', result.status, result.error);
    return res.status(502).json({ error: 'AgentMail rejected the send', detail: result.error });
  }

  if (resolvedPersonId && churchId) {
    await supabase.from('interactions').insert({
      church_id: churchId,
      person_id: resolvedPersonId,
      type: 'email',
      content: `${subject.trim()}\n\n${text.trim()}`,
      created_by: null,
      created_by_name: 'Pastor (via Grace)',
    });
  }

  return res.status(200).json({
    ok: true,
    message_id: result.message_id,
    thread_id: result.thread_id,
    person_id: resolvedPersonId,
  });
}
