import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildChurchContext, buildPersonContext, buildReplyPrompt } from '../_lib/grace-context.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface DraftReplyBody {
  inbox_message_row_id?: string;
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

  const church = await buildChurchContext(supabase, row.church_id);
  const person = row.person_id ? await buildPersonContext(supabase, row.person_id) : null;

  const { prompt } = buildReplyPrompt({
    churchName: church.name,
    graceFacts: church.facts,
    person,
    email: {
      from_email: row.from_email,
      subject: row.subject,
      body_text: row.body_text,
      preview: row.preview,
    },
  });

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
