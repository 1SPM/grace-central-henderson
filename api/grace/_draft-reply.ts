import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildChurchContext, buildPersonContext, buildReplyPrompt } from '../_lib/grace-context.js';
import { generate } from '../_lib/ai/gateway.js';
import { microUsdToUsd } from '../_lib/ai/pricing.js';
import { callGemini } from '../_lib/ai/adapters/gemini.js';
import { requireClerkAuth } from '../_lib/auth-helper.js';

const STAFF_ROLES = ['admin', 'pastor', 'staff'];

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const PROVIDER = 'gemini';
const MODEL = 'gemini-2.5-flash';
const FEATURE = 'draft-reply';

interface DraftReplyBody {
  inbox_message_row_id?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!GEMINI_API_KEY) return res.status(503).json({ error: 'AI not configured' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'Supabase not configured' });

  // TD-014: mandatory auth gate — staff only
  const auth = await requireClerkAuth(req, { allowedRoles: STAFF_ROLES });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { inbox_message_row_id } = (req.body || {}) as DraftReplyBody;
  if (!inbox_message_row_id) return res.status(400).json({ error: 'inbox_message_row_id required' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // Scope to caller's church — prevents reading another tenant's inbox messages
  const { data: row, error: rowErr } = await supabase
    .from('grace_inbox_messages')
    .select('id, church_id, person_id, from_email, subject, body_text, preview, created_at')
    .eq('id', inbox_message_row_id)
    .eq('church_id', auth.churchId)
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

  const requestId = (req.headers['x-request-id'] as string | undefined) ?? null;

  // Every Gemini call goes through the gateway: budget → moderation → call → record.
  // Moderation is opt-in: input moderation runs on the inbound email body (the
  // user-controlled portion of the prompt), output moderation runs on the
  // drafted reply before we surface it. Both are no-ops without OPENAI_API_KEY.
  const result = await generate(
    {
      supabase,
      churchId: row.church_id,
      feature: FEATURE,
      provider: PROVIDER,
      model: MODEL,
      requestId,
      moderateInput: row.body_text ?? row.preview ?? '',
      moderateOutput: true,
    },
    () => callGemini({ apiKey: GEMINI_API_KEY!, model: MODEL, prompt }),
  );

  if (!result.allowed) {
    if (result.reason === 'moderation_input') {
      return res.status(422).json({
        error: 'input_moderation_block',
        flagged_categories: result.moderation.flaggedCategories,
      });
    }
    // Budget refusal — 402 Payment Required. Body carries enough detail
    // for the client to render a useful "you've hit your AI cap" message.
    return res.status(402).json({
      error: 'ai_budget_exceeded',
      reason: result.reason,
      spent_usd: microUsdToUsd(result.budget.spentMicroUsd),
      cap_usd: microUsdToUsd(result.budget.capMicroUsd),
      hard_cut_usd: microUsdToUsd(result.budget.hardCutMicroUsd),
      month_start: result.budget.monthStartIso,
    });
  }

  if (!result.provider.success) {
    if (result.provider.errorCode === 'moderation_output') {
      return res.status(422).json({
        error: 'output_moderation_block',
        flagged_categories: result.moderation?.output?.flaggedCategories ?? [],
      });
    }
    return res.status(502).json({
      error: 'ai_provider_error',
      detail: (result.provider.error ?? '').slice(0, 200),
      error_code: result.provider.errorCode,
    });
  }

  return res.status(200).json({ success: true, text: result.provider.text });
}
