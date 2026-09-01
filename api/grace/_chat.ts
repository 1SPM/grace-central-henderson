/**
 * POST/GET /api/grace/chat — ADR-014 (Memory V1: "Grace Remembers Me").
 *
 * One conversational turn for the staff Ask GRACE assistant, now with
 * server-side persistence and per-user memory. Replaces the direct
 * api/ai/_generate.ts call for this surface — routes through the gateway
 * (budget + moderation + usage, feature 'ask-grace') instead of bypassing
 * it, and persists both sides of the turn plus any extracted memories.
 *
 * The client still composes the church-data context (dataContext) — see
 * TD-062 in TECH_DEBT.md for why that boundary wasn't retired in this
 * pass. This route adds: conversation load/create, the explicit
 * "remember that…" short-circuit, memory retrieval + injection, and
 * post-turn extraction. Auth via resolveStaffActor — same identity
 * resolution as every other staff route.
 *
 * GET returns the caller's most recent conversation (last 50 messages)
 * for cross-session hydration — the actual "close the browser, come back
 * tomorrow" proof.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveStaffActor } from '../_lib/authz.js';
import { readBody, str } from '../_lib/validation.js';
import { enforceRateLimit } from '../_lib/rateLimit/limiter.js';
import { generateStreamed } from '../_lib/ai/gateway.js';
import { callClaudeStream, DEFAULT_CLAUDE_MODEL } from '../_lib/ai/adapters/claude.js';
import { microUsdToUsd } from '../_lib/ai/pricing.js';
import { parseRememberDirective, saveMemory, retrieveMemories, buildMemoryBlock, runExtraction } from '../_lib/grace-memory.js';
import { retrieveChurchKnowledge, buildKnowledgeBlock } from '../_lib/grace-knowledge.js';
import { buildCapabilityContext } from '../_lib/grace-capability.js';
import { logSecurityEvent, securityContext } from '../_lib/securityLog.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Model service: Grace calls this adapter, never Anthropic's SDK directly
// elsewhere in the app — swapping providers again means adding one more
// adapter under api/_lib/ai/adapters/ and changing these two lines.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Only needed if ANTHROPIC_API_KEY is an identity-linked key — omit for a
// standard workspace/org-wide key.
const ANTHROPIC_WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID;
const PROVIDER = 'claude';
const MODEL = DEFAULT_CLAUDE_MODEL;

const DATA_CONTEXT_MAX_CHARS = 40_000;
const HISTORY_TURN_LIMIT = 12;

const SCHEMA = {
  message: str({ required: true, min: 1, max: 4000 }),
  conversationId: str({ required: false }),
  dataContext: str({ required: false, max: DATA_CONTEXT_MAX_CHARS }),
};

async function getOrCreateConversation(
  supabase: SupabaseClient,
  churchId: string,
  userId: string,
  conversationId: string | undefined,
  firstMessage: string,
): Promise<{ id: string } | null> {
  if (conversationId) {
    const { data } = await supabase
      .from('grace_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('church_id', churchId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return data as { id: string };
  }

  const { data, error } = await supabase
    .from('grace_conversations')
    .insert({ church_id: churchId, user_id: userId, title: firstMessage.slice(0, 80) })
    .select('id')
    .single();
  if (error || !data) return null;
  return data as { id: string };
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return;

  const { data: conversation } = await supabase
    .from('grace_conversations')
    .select('id, last_message_at')
    .eq('church_id', actor.churchId)
    .eq('user_id', actor.userId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    return res.status(200).json({ conversation: null, messages: [] });
  }

  // church_id/user_id are redundant with conversation.id here (a
  // conversation can only ever have been created scoped to this actor —
  // see getOrCreateConversation) but filtering on them anyway is cheap
  // insurance against a future write path breaking that invariant.
  const { data: messages } = await supabase
    .from('grace_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', (conversation as { id: string }).id)
    .eq('church_id', actor.churchId)
    .eq('user_id', actor.userId)
    .order('created_at', { ascending: true })
    .limit(50);

  return res.status(200).json({ conversation, messages: messages ?? [] });
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return;

  if (await enforceRateLimit(res, `grace:chat:${actor.userId}`, 30, 60,
    'You’re sending messages quickly — please wait a moment before the next one.')) return;

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  const message = body.message!;
  const dataContext = (body.dataContext ?? '').slice(0, DATA_CONTEXT_MAX_CHARS);

  const conversation = await getOrCreateConversation(supabase, actor.churchId, actor.userId, body.conversationId, message);
  if (!conversation) {
    return res.status(500).json({ error: 'conversation_create_failed' });
  }

  res.setHeader('X-Conversation-Id', conversation.id);

  const { data: userMsgRow } = await supabase
    .from('grace_messages')
    .insert({ conversation_id: conversation.id, church_id: actor.churchId, user_id: actor.userId, role: 'user', content: message })
    .select('id')
    .single();
  const userMessageId = (userMsgRow as { id: string } | null)?.id ?? null;

  // Explicit "remember that…" — deterministic, no model call.
  const explicitMemory = parseRememberDirective(message);
  if (explicitMemory) {
    const saved = await saveMemory(supabase, {
      churchId: actor.churchId,
      userId: actor.userId,
      content: explicitMemory,
      source: 'user_stated',
      sourceMessageId: userMessageId,
      sourceConversationId: conversation.id,
    });
    const reply = saved ? `Remembered: ${explicitMemory}` : `I already had that noted: ${explicitMemory}`;
    await supabase.from('grace_messages').insert({
      conversation_id: conversation.id, church_id: actor.churchId, user_id: actor.userId, role: 'assistant', content: reply,
    });
    await supabase.from('grace_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.status(200).send(reply);
    return;
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'assistant_not_configured', detail: 'ANTHROPIC_API_KEY is not set on this deployment.' });
  }

  const knowledgeRows = await retrieveChurchKnowledge(supabase, { churchId: actor.churchId, query: message });
  const knowledgeBlock = buildKnowledgeBlock(knowledgeRows);

  const memories = await retrieveMemories(supabase, { churchId: actor.churchId, userId: actor.userId, query: message });
  const memoryBlock = buildMemoryBlock(memories);

  const { data: historyRows } = await supabase
    .from('grace_messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .eq('church_id', actor.churchId)
    .eq('user_id', actor.userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURN_LIMIT + 1); // +1 to exclude the user message just inserted
  const history = ((historyRows ?? []) as Array<{ role: string; content: string }>)
    .slice(1) // drop the just-inserted user message — it's appended explicitly below
    .reverse()
    .map(m => `${m.role === 'user' ? 'User' : 'Grace'}: ${m.content}`)
    .join('\n');

  // Server-composed, actor-scoped — never from client dataContext, never
  // gated by client-claimed permissions. See ADR-017 / grace-capability.ts.
  const capabilityBlock = buildCapabilityContext(actor);

  const promptParts = [dataContext, knowledgeBlock, memoryBlock, capabilityBlock];
  if (history) promptParts.push(`Recent conversation (use to resolve pronouns like "him" / "her" / "that task"):\n${history}`);
  promptParts.push(`User question: ${message}`);
  const prompt = promptParts.filter(Boolean).join('\n\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  let streamedText = '';
  const result = await generateStreamed(
    { supabase, churchId: actor.churchId, feature: 'ask-grace', provider: PROVIDER, model: MODEL, actorClerkId: actor.clerkUserId },
    (chunk) => { streamedText += chunk; res.write(chunk); },
    (onChunk) => callClaudeStream({ apiKey: ANTHROPIC_API_KEY, workspaceId: ANTHROPIC_WORKSPACE_ID, model: MODEL, prompt, maxTokens: 1200 }, onChunk),
  );

  if (!result.allowed) {
    if (!streamedText) {
      res.removeHeader('Content-Type');
      if (result.reason === 'moderation_input') {
        return res.status(422).json({ error: 'input_moderation_block' });
      }
      return res.status(402).json({
        error: 'ai_budget_exceeded',
        reason: result.reason,
        spent_usd: microUsdToUsd(result.budget.spentMicroUsd),
        cap_usd: microUsdToUsd(result.budget.capMicroUsd),
      });
    }
    res.end();
    return;
  }

  if (!result.provider.success) {
    if (!streamedText) {
      res.removeHeader('Content-Type');
      return res.status(502).json({ error: 'assistant_error', detail: result.provider.error });
    }
  }
  res.end();

  const { data: assistantMsgRow, error: assistantMsgError } = await supabase
    .from('grace_messages')
    .insert({
      conversation_id: conversation.id,
      church_id: actor.churchId,
      user_id: actor.userId,
      role: 'assistant',
      content: streamedText,
      model: MODEL,
      prompt_tokens: result.provider.promptTokens ?? null,
      completion_tokens: result.provider.completionTokens ?? null,
    })
    .select('id')
    .single();

  // TD-065: a failed write here used to vanish silently — the user already
  // has the correct answer on screen (streamed above), but the turn would
  // never appear in persisted history and would never reach extraction.
  // Loud, not fatal: the turn is already delivered, so there's nothing left
  // to roll back — just make the loss visible instead of pretending it
  // didn't happen.
  if (assistantMsgError) {
    console.error('[grace/_chat] assistant message insert failed', {
      conversation_id: conversation.id,
      error: assistantMsgError.message,
    });
    await logSecurityEvent(supabase, {
      eventType: 'grace_chat.message_write_failed',
      severity: 'elevated',
      churchId: actor.churchId,
      actorClerkId: actor.clerkUserId,
      ...securityContext(req),
      detail: { conversation_id: conversation.id, role: 'assistant', reason: 'grace_messages_insert_failed' },
    });
  }

  await supabase.from('grace_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);

  // TD-064: this used to be raced against a 3s timeout, which lost almost
  // every time under real gateway + DB overhead — res.end() above already
  // delivered the response, so nothing downstream is waiting on this; a
  // plain await just lets extraction actually finish rather than being
  // abandoned mid-write.
  const assistantMessageId = (assistantMsgRow as { id: string } | null)?.id;
  if (userMessageId && assistantMessageId && streamedText) {
    await runExtraction({
      supabase, churchId: actor.churchId, userId: actor.userId,
      userMessage: message, assistantReply: streamedText,
      sourceMessageId: userMessageId, sourceConversationId: conversation.id,
      apiKey: ANTHROPIC_API_KEY, workspaceId: ANTHROPIC_WORKSPACE_ID,
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'method_not_allowed' });
}
