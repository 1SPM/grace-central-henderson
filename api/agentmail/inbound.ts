import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.AGENTMAIL_WEBHOOK_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MAX_TIMESTAMP_AGE_SEC = 5 * 60;

interface ParsedAction {
  type: string;
  [key: string]: unknown;
}

function buildParsePrompt(senderName: string, fromEmail: string, subject: string, body: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are reading an email a church member sent to their pastor's CRM. Extract any concrete CRM actions the email implies. Return ONLY <action> blocks, one per intended action. Return nothing if the email is purely conversational or has no actionable intent.

Schemas (use exact type strings; "personName" should be the sender unless another person is clearly named):
<action>{"type":"add_task","title":"X","personName":"${senderName}","priority":"medium","dueDate":"YYYY-MM-DD"}</action>
<action>{"type":"add_prayer","content":"X","personName":"${senderName}"}</action>
<action>{"type":"add_note","content":"X","personName":"${senderName}"}</action>
<action>{"type":"add_event","title":"X","startDate":"YYYY-MM-DD","startTime":"HH:MM","location":"optional","category":"event"}</action>

Today: ${today}
From: ${senderName} <${fromEmail}>
Subject: ${subject}
Body:
${body}`.slice(0, 8000);
}

function extractActionBlocks(text: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  const matches = text.matchAll(/<action>([\s\S]*?)<\/action>/g);
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[1]);
      if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
        actions.push(parsed as ParsedAction);
      }
    } catch {
      // skip malformed JSON
    }
  }
  return actions;
}

async function parseEmailActions(senderName: string, fromEmail: string, subject: string, body: string): Promise<ParsedAction[]> {
  if (!GEMINI_API_KEY) return [];
  const prompt = buildParsePrompt(senderName, fromEmail, subject, body);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 600, temperature: 0.3 },
        }),
      },
    );
    if (!response.ok) return [];
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return extractActionBlocks(text);
  } catch (err) {
    console.warn('[agentmail-inbound] gemini parse failed', err);
    return [];
  }
}

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
  const subject = msg.subject || '(no subject)';
  const content = `${subject}\n\n${bodyText}`.slice(0, 50_000);
  const senderName = `${person.first_name} ${person.last_name}`.trim();

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

  const parsedActions = await parseEmailActions(senderName, fromEmail, subject, bodyText);

  const { error: inboxError } = await supabase.from('grace_inbox_messages').upsert({
    church_id: person.church_id,
    person_id: person.id,
    source: 'agentmail',
    source_message_id: msg.message_id,
    source_thread_id: msg.thread_id,
    source_inbox_id: msg.inbox_id,
    from_email: fromEmail,
    subject,
    preview: msg.preview || bodyText.slice(0, 200),
    body_text: bodyText.slice(0, 10_000),
    parsed_actions: parsedActions,
  }, { onConflict: 'source,source_message_id' });

  if (inboxError) {
    console.error('[agentmail-inbound] inbox upsert failed', inboxError);
    // Interaction already saved — don't fail the whole webhook
  }

  return res.status(200).json({
    ok: true,
    person_id: person.id,
    message_id: msg.message_id,
    parsed_actions: parsedActions.length,
  });
}
