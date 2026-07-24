/**
 * POST /api/portal/assistant
 *
 * The member-facing GRACE assistant. One conversational turn: the
 * client sends the member's message plus a short recent-turn history
 * (client-held, never persisted server-side as a transcript — only
 * individual tool invocations are audited, via
 * api/_lib/assistant/tools.ts's executeAssistantTool, not full chat
 * text), and gets back a reply plus the list of tools invoked.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor — same
 * identity resolution as every other portal route. The assistant never
 * receives or trusts a client-supplied person/church id.
 *
 * Auth is intentionally the ONLY thing this route does directly —
 * everything else (crisis gate, budget, moderation, the tool loop) is
 * api/_lib/ai/assistant-runtime.ts, kept separate from and never
 * importing api/_lib/agentWorkflows.ts (the admin WorkOS agent system).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { runAssistantTurn, type AssistantHistoryTurn } from '../_lib/ai/assistant-runtime.js';
import { readBody, str } from '../_lib/validation.js';
import { microUsdToUsd } from '../_lib/ai/pricing.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SCHEMA = {
  message: str({ required: true, min: 1, max: 4000 }),
};

// `history` is a client-held array of prior turns, not persisted
// server-side — validated by hand (readBody's scalar helpers don't cover
// arrays) rather than trusted as-is. Only role:user/model + text survive;
// nothing else (no client-supplied role:"system" or extra fields).
function parseHistory(raw: unknown): AssistantHistoryTurn[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((h): h is { role: string; text: string } =>
      !!h && typeof h === 'object' && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
    .slice(-10)
    .map(h => ({ role: h.role as 'user' | 'model', text: h.text.slice(0, 4000) }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'assistant_not_configured', detail: 'GEMINI_API_KEY is not set on this deployment.' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  const bodyRaw = req.body as Record<string, unknown> | undefined;
  const history = parseHistory(bodyRaw?.history);
  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  const requestId = (req.headers['x-request-id'] as string | undefined) ?? null;

  const result = await runAssistantTurn({
    supabase,
    member,
    message: body.message!,
    history,
    apiKey: GEMINI_API_KEY,
    requestId,
  });

  if (!result.allowed) {
    if (result.reason === 'moderation_input') {
      return res.status(422).json({ error: 'input_moderation_block' });
    }
    if (result.reason === 'moderation_output') {
      return res.status(422).json({ error: 'output_moderation_block' });
    }
    if (result.reason === 'over_cap' || result.reason === 'hard_cut') {
      return res.status(402).json({
        error: 'ai_budget_exceeded',
        reason: result.reason,
        spent_usd: microUsdToUsd(Number(result.detail.spent_micro_usd ?? 0)),
        cap_usd: microUsdToUsd(Number(result.detail.cap_micro_usd ?? 0)),
      });
    }
    return res.status(502).json({ error: 'assistant_error', detail: String(result.detail) });
  }

  return res.status(200).json({
    reply: result.reply,
    tool_calls: result.toolCalls,
    crisis_detected: result.crisisDetected,
    disclosure: 'GRACE is an AI assistant, not a person. It uses approved church materials and is not a live conversation with a leader.',
  });
}
