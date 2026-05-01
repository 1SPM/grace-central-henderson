import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.AGENTMAIL_WEBHOOK_SECRET;
const MAX_TIMESTAMP_AGE_SEC = 5 * 60;

interface AgentMailMessage {
  message_id: string;
  thread_id: string;
  inbox_id: string;
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  preview?: string;
  timestamp: string;
}

interface AgentMailEvent {
  event_type: string;
  event_id: string;
  message?: AgentMailMessage;
}

async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function verifySvixSignature(rawBody: string, headers: VercelRequest['headers'], secret: string): boolean {
  const svixId = headers['svix-id'];
  const svixTimestamp = headers['svix-timestamp'];
  const svixSignature = headers['svix-signature'];
  if (typeof svixId !== 'string' || typeof svixTimestamp !== 'string' || typeof svixSignature !== 'string') return false;

  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  const ageSec = Math.abs(Date.now() / 1000 - ts);
  if (ageSec > MAX_TIMESTAMP_AGE_SEC) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  for (const part of svixSignature.split(' ')) {
    const [, sig] = part.split(',');
    if (!sig) continue;
    if (sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

function extractEmailAddress(addr: string): string {
  const match = addr.match(/<([^>]+)>/);
  return (match ? match[1] : addr).trim().toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!WEBHOOK_SECRET) return res.status(503).json({ error: 'AGENTMAIL_WEBHOOK_SECRET not set' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'Supabase not configured' });

  let rawBody: string;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return res.status(400).json({ error: 'Failed to read body' });
  }

  if (!verifySvixSignature(rawBody, req.headers, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event: AgentMailEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (event.event_type !== 'message.received' || !event.message) {
    return res.status(200).json({ ok: true, skipped: event.event_type });
  }

  const msg = event.message;
  const fromEmail = extractEmailAddress(msg.from);
  if (!fromEmail) return res.status(200).json({ ok: true, skipped: 'no_from' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: people, error: lookupError } = await supabase
    .from('people')
    .select('id, church_id, first_name, last_name, email')
    .ilike('email', fromEmail)
    .limit(1);

  if (lookupError) {
    console.error('[agentmail-inbound] supabase lookup failed', lookupError);
    return res.status(500).json({ error: 'Lookup failed' });
  }

  const person = people?.[0];
  if (!person) {
    console.warn('[agentmail-inbound] no person matched', { fromEmail, messageId: msg.message_id });
    return res.status(200).json({ ok: true, skipped: 'no_person_match', fromEmail });
  }

  const bodyText = (msg.text || msg.preview || '').trim();
  const content = `${msg.subject || '(no subject)'}\n\n${bodyText}`.slice(0, 50_000);

  const { error: insertError } = await supabase.from('interactions').insert({
    church_id: person.church_id,
    person_id: person.id,
    type: 'email',
    content,
    created_by: 'agentmail-webhook',
    created_by_name: 'Member via Grace',
  });

  if (insertError) {
    console.error('[agentmail-inbound] interaction insert failed', insertError);
    return res.status(500).json({ error: 'Insert failed' });
  }

  return res.status(200).json({
    ok: true,
    person_id: person.id,
    message_id: msg.message_id,
  });
}
