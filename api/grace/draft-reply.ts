import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface DraftReplyBody {
  inbox_message_row_id?: string;
}

interface InteractionRow {
  type: string;
  content: string | null;
  created_at: string;
  created_by_name: string | null;
}

interface PrayerRow {
  content: string;
  is_answered: boolean;
  created_at: string;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!GEMINI_API_KEY) return res.status(503).json({ error: 'AI not configured' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'Supabase not configured' });

  const { inbox_message_row_id } = (req.body || {}) as DraftReplyBody;
  if (!inbox_message_row_id) return res.status(400).json({ error: 'inbox_message_row_id required' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const { data: row, error: rowErr } = await supabase
    .from('grace_inbox_messages')
    .select('id, church_id, person_id, from_email, subject, body_text, preview, created_at')
    .eq('id', inbox_message_row_id)
    .single();
  if (rowErr || !row) return res.status(404).json({ error: 'Inbox row not found' });

  // Church facts
  const { data: church } = await supabase
    .from('churches')
    .select('name, settings')
    .eq('id', row.church_id)
    .single();
  const graceFacts = (church?.settings as { grace_facts?: string } | null)?.grace_facts || '';

  // Person + history
  let personSection = '';
  let firstName = (row.from_email || 'there').split('@')[0];
  if (row.person_id) {
    const { data: person } = await supabase
      .from('people')
      .select('first_name, last_name, status, first_visit, tags')
      .eq('id', row.person_id)
      .single();

    if (person) {
      firstName = person.first_name || firstName;
      const tagLine = Array.isArray(person.tags) && person.tags.length > 0 ? `Tags: ${person.tags.slice(0, 6).join(', ')}.` : '';
      const firstVisitLine = person.first_visit ? `First visit: ${person.first_visit}.` : '';
      personSection += `Sender: ${person.first_name} ${person.last_name} — ${person.status}. ${firstVisitLine} ${tagLine}\n`;

      const { data: interactions } = await supabase
        .from('interactions')
        .select('type, content, created_at, created_by_name')
        .eq('person_id', row.person_id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (interactions && interactions.length > 0) {
        personSection += `Recent interactions (newest first):\n`;
        for (const i of interactions as InteractionRow[]) {
          const snippet = (i.content || '').replace(/\s+/g, ' ').slice(0, 120);
          personSection += `- ${shortDate(i.created_at)} ${i.type}${i.created_by_name ? ` by ${i.created_by_name}` : ''}: ${snippet}\n`;
        }
      }

      const { data: prayers } = await supabase
        .from('prayer_requests')
        .select('content, is_answered, created_at')
        .eq('person_id', row.person_id)
        .order('created_at', { ascending: false })
        .limit(3);
      if (prayers && prayers.length > 0) {
        personSection += `Prayer requests:\n`;
        for (const p of prayers as PrayerRow[]) {
          personSection += `- ${shortDate(p.created_at)}${p.is_answered ? ' (answered)' : ''}: ${p.content.slice(0, 100)}\n`;
        }
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `You're drafting a reply on behalf of the pastor at ${church?.name || 'the church'}.

== CHURCH FACTS (use these freely; cite specific times / addresses / policies when relevant) ==
${graceFacts || '(No church facts on file. If the email asks for specific info, say the pastor will follow up with details.)'}

== ABOUT THIS SENDER ==
${personSection || `(No record on file beyond their email address.)`}

== EMAIL TO REPLY TO ==
Date: ${today}
From: ${row.from_email}
Subject: ${row.subject ?? '(no subject)'}
Body:
${row.body_text ?? row.preview ?? ''}

== INSTRUCTIONS ==
- Warm, plainspoken, brief (2-4 sentences). Match the church tone if the facts mention one.
- Use the church facts to ANSWER specific questions when you can (e.g. service times, address, parking, kids' programs). Don't be vague when the answer is right above.
- If the question requires info not in the facts, say the pastor will follow up — don't invent.
- Reference the sender's history naturally if relevant ("good to hear from you again, ${firstName}" if they've been around; "welcome!" if they're a new visitor).
- Sign as "Grace" only — no "Warmly," or other signature lines.
- Single greeting at start: "Hi ${firstName},". No subject line. Output ONLY the reply body.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1500,
            temperature: 0.6,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return res.status(502).json({ error: 'Gemini error', detail: detail.slice(0, 200) });
    }
    const data = await r.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (!text) return res.status(500).json({ error: 'Empty draft' });
    return res.status(200).json({ success: true, text });
  } catch (err) {
    console.error('[draft-reply]', err);
    return res.status(500).json({ error: 'Draft failed' });
  }
}
