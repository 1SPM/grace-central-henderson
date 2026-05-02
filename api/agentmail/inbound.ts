import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { buildChurchContext, buildPersonContext, type PersonContext } from '../_lib/grace-context.js';
import { replyToThread } from '../_lib/agentmail-send.js';

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.AGENTMAIL_WEBHOOK_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
const MAX_TIMESTAMP_AGE_SEC = 5 * 60;

const CRISIS_KEYWORDS = /\b(suicide|kill myself|end my life|end it all|self.?harm|abuse|abused|abusing|domestic violence|hurt me|hurt myself|crisis|emergency|hospital|overdose|leaving the church)\b/i;

interface ParsedAction {
  type: string;
  confidence?: number;
  risk?: 'low' | 'medium' | 'high';
  [key: string]: unknown;
}

interface ParseResult {
  actions: ParsedAction[];
  intent: 'informational' | 'request' | 'pastoral' | 'conversational' | 'unknown';
  suggested_reply?: string;
}

function buildParsePrompt(args: {
  churchName: string;
  graceFacts: string;
  person: PersonContext | null;
  senderName: string;
  fromEmail: string;
  subject: string;
  body: string;
}): string {
  const today = new Date().toISOString().slice(0, 10);
  const factsSection = args.graceFacts || '(No church facts on file. If the email asks for specific info, leave suggested_reply empty.)';
  const personSection = args.person?.block || '(No record on file beyond their email address.)';

  return `You're a pastor's assistant at ${args.churchName} reading a member's email. Decide what CRM actions it implies AND optionally draft a reply.

== CHURCH FACTS (use to answer specific questions; cite times/addresses/policies when relevant) ==
${factsSection}

== ABOUT THIS SENDER ==
${personSection}

== EMAIL ==
Date: ${today}
From: ${args.senderName} <${args.fromEmail}>
Subject: ${args.subject}
Body:
${args.body}

== OUTPUT — one JSON object, no other text ==
{
  "intent": "informational" | "request" | "pastoral" | "conversational",
  "actions": [{type, confidence:0..1, risk:"low"|"medium"|"high", ...fields}],
  "suggested_reply": "" or short plain text reply (2-4 sentences)
}

Action shapes (personName defaults to the sender unless someone else is clearly named):
- add_task: title, personName, priority(low|medium|high), dueDate(YYYY-MM-DD)
- add_prayer: content, personName
- add_note: content, personName  (use when sender shares info to log; e.g. "we'll have 4 visitors Sunday")
- add_event: title, startDate(YYYY-MM-DD), startTime(HH:MM), location?, category

Risk: low=note/log/info-reply. medium=task/event. high=other person's record / money / sensitive.

suggested_reply rules:
- Use the church facts above to ANSWER specific questions (service times, address, parking, kids' programs). Don't be vague when the answer is right above.
- If the question requires info NOT in the facts, leave reply empty — pastor would rather see no reply than a fabricated one.
- Warm, plainspoken, brief. Single greeting "Hi ${args.person?.firstName ?? 'there'}," at the start. Sign as "Grace" only.
- Reference history naturally if relevant ("good to hear from you again" if they've been around).`.slice(0, 12_000);
}

function safeParseResult(text: string): ParseResult {
  const fallback: ParseResult = { actions: [], intent: 'unknown' };
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const actions = Array.isArray(parsed.actions) ? parsed.actions.filter((a: unknown) =>
      a && typeof a === 'object' && typeof (a as Record<string, unknown>).type === 'string'
    ) : [];
    const intent = ['informational', 'request', 'pastoral', 'conversational'].includes(parsed.intent)
      ? parsed.intent : 'unknown';
    const suggested_reply = typeof parsed.suggested_reply === 'string' ? parsed.suggested_reply.trim() : '';
    return { actions, intent, suggested_reply: suggested_reply || undefined };
  } catch {
    return fallback;
  }
}

async function parseEmail(args: {
  churchName: string;
  graceFacts: string;
  person: PersonContext | null;
  senderName: string;
  fromEmail: string;
  subject: string;
  body: string;
}): Promise<ParseResult> {
  if (!GEMINI_API_KEY) return { actions: [], intent: 'unknown' };
  const prompt = buildParsePrompt(args);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.3,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
    if (!response.ok) return { actions: [], intent: 'unknown' };
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return safeParseResult(text);
  } catch (err) {
    console.warn('[agentmail-inbound] gemini parse failed', err);
    return { actions: [], intent: 'unknown' };
  }
}

async function sendAgentMailReply(inboxId: string, messageId: string, text: string): Promise<boolean> {
  if (!AGENTMAIL_API_KEY) return false;
  const result = await replyToThread({ apiKey: AGENTMAIL_API_KEY, inboxId, messageId, text });
  if (!result.ok) console.warn('[agentmail-inbound] reply failed', result.status, result.error);
  return result.ok;
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

  // Always log the inbound as an Interaction so the person's history is complete
  // even when we skip parsing (crisis path).
  const { error: insertError } = await supabase.from('interactions').insert({
    church_id: person.church_id,
    person_id: person.id,
    type: 'email',
    content,
    created_by: null,
    created_by_name: 'Member via Grace',
  });
  if (insertError) {
    console.error('[agentmail-inbound] interaction insert failed', insertError);
    return res.status(500).json({ error: 'Insert failed' });
  }

  // ESCALATE: crisis-keyword fast path — never auto-handle, never run Gemini,
  // surface to pastor with a flag so they can respond personally.
  const haystack = `${subject}\n${bodyText}`;
  if (CRISIS_KEYWORDS.test(haystack)) {
    await supabase.from('grace_inbox_messages').upsert({
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
      parsed_actions: [],
      flag: 'crisis',
    }, { onConflict: 'source,source_message_id' });
    return res.status(200).json({ ok: true, routed: 'escalate', person_id: person.id });
  }

  // Build enriched context (church facts + sender history) once, then ask Gemini
  // to extract actions AND suggest a reply against the same context.
  const church = await buildChurchContext(supabase, person.church_id);
  const senderContext = await buildPersonContext(supabase, person.id);

  const parsed = await parseEmail({
    churchName: church.name,
    graceFacts: church.facts,
    person: senderContext,
    senderName,
    fromEmail,
    subject,
    body: bodyText,
  });

  // AUTO: conservative tier — only auto-execute add_note when confidence ≥ 0.85
  // and risk === 'low'. Send a confirmation reply for explicit info Q&A
  // (intent === 'informational' + suggested_reply present).
  const autoNotes = parsed.actions.filter(a =>
    a.type === 'add_note'
    && (a.confidence ?? 0) >= 0.85
    && a.risk === 'low'
    && typeof a.content === 'string'
    && (a.content as string).trim().length > 0,
  );
  const reviewActions = parsed.actions.filter(a => !autoNotes.includes(a));

  const autoSummaryParts: string[] = [];

  for (const note of autoNotes) {
    const { error } = await supabase.from('interactions').insert({
      church_id: person.church_id,
      person_id: person.id,
      type: 'note',
      content: String(note.content),
      created_by: null,
      created_by_name: 'Grace (auto)',
    });
    if (!error) autoSummaryParts.push(`Note: ${String(note.content).slice(0, 80)}`);
  }

  let replySent = false;
  if (parsed.suggested_reply && parsed.suggested_reply.length > 0 && parsed.suggested_reply.length < 1500) {
    const replyBody = `${parsed.suggested_reply}\n\n— Grace 🌿 (auto-reply on behalf of the pastor)`;
    replySent = await sendAgentMailReply(msg.inbox_id, msg.message_id, replyBody);
    if (replySent) {
      autoSummaryParts.push(`Replied: ${parsed.suggested_reply.slice(0, 80)}`);
      await supabase.from('interactions').insert({
        church_id: person.church_id,
        person_id: person.id,
        type: 'email',
        content: `[Grace auto-reply]\n\n${parsed.suggested_reply}`,
        created_by: 'grace-auto',
        created_by_name: 'Grace (auto)',
      });
    }
  }

  const autoHandled = autoSummaryParts.length > 0;
  await supabase.from('grace_inbox_messages').upsert({
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
    parsed_actions: reviewActions,
    auto_handled_at: autoHandled ? new Date().toISOString() : null,
    auto_summary: autoHandled ? autoSummaryParts.join(' | ') : null,
    reply_sent_at: replySent ? new Date().toISOString() : null,
  }, { onConflict: 'source,source_message_id' });

  return res.status(200).json({
    ok: true,
    routed: autoHandled ? (reviewActions.length > 0 ? 'auto+review' : 'auto') : 'review',
    auto: autoNotes.length,
    review: reviewActions.length,
    reply_sent: replySent,
  });
}
