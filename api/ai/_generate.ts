import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildFullPrompt, generateWithHermes, getHermesConfig, isGeminiQuotaError, sanitizePrompt } from '../_lib/aiProviders.js';
import { requireClerkAuth } from '../_lib/auth-helper.js';
import { checkBudget } from '../_lib/ai/budget.js';
import { recordUsage } from '../_lib/ai/usage.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MODEL = 'gemini-2.5-flash';

/**
 * Metering context (Phase D): when the caller sends a Clerk Bearer
 * token, this route runs through the AI gateway's budget pipeline —
 * checkBudget before the provider call, recordUsage after. Ask Grace
 * is the highest-volume inference path, so this is where the
 * per-tenant budget tracking matters most.
 *
 * Calls without a token (marketing site, demo mode) stay unmetered —
 * identical to the pre-Phase-D behavior.
 */
interface Metering {
  supabase: SupabaseClient;
  churchId: string;
  actorClerkId: string;
}

async function resolveMetering(req: VercelRequest): Promise<Metering | null> {
  if (!req.headers.authorization || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const auth = await requireClerkAuth(req);
  if (!auth.ok) return null;
  return {
    supabase: createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } }),
    churchId: auth.churchId,
    actorClerkId: auth.clerkUserId,
  };
}

/** Rough fallback when the provider doesn't report token counts. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Rate limiting (simple in-memory, resets on cold start)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }

  if (record.count >= RATE_LIMIT) {
    return true;
  }

  record.count++;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check configuration
  if (!GEMINI_API_KEY && !getHermesConfig().configured) {
    return res.status(503).json({ error: 'AI service not configured' });
  }

  // Rate limiting
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown';
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { prompt, context, maxTokens } = req.body;

  // Validate required fields
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required and must be a string' });
  }

  const sanitizedPrompt = sanitizePrompt(prompt);
  if (sanitizedPrompt.length < 2) {
    return res.status(400).json({ error: 'Prompt is too short' });
  }

  const fullPrompt = buildFullPrompt(sanitizedPrompt, typeof context === 'string' ? context : undefined);

  const shouldStream = req.query.stream === '1' || req.query.stream === 'true';

  // ---- AI gateway: budget check (Phase D) ----
  const metering = await resolveMetering(req);
  if (metering) {
    const budget = await checkBudget(metering.supabase, metering.churchId);
    if (budget.status !== 'ok') {
      void recordUsage(metering.supabase, {
        churchId: metering.churchId,
        provider: 'gemini',
        model: MODEL,
        feature: 'ask-grace',
        promptTokens: 0,
        completionTokens: 0,
        success: false,
        errorCode: budget.status === 'hard_cut' ? 'budget_hard_cut' : 'budget_over_cap',
        latencyMs: 0,
        actorClerkId: metering.actorClerkId,
      });
      return res.status(402).json({
        error: budget.status === 'hard_cut'
          ? 'Monthly AI budget exhausted. Ask Grace is paused until the new billing month or a cap increase.'
          : 'Monthly AI budget reached. Ask Grace responses may be limited — consider raising the cap in Settings.',
        budget_status: budget.status,
        spent_micro_usd: budget.spentMicroUsd,
        cap_micro_usd: budget.capMicroUsd,
      });
    }
  }

  const meterResult = (input: {
    success: boolean;
    promptTokens?: number;
    completionTokens?: number;
    errorCode?: string;
    latencyMs: number;
  }) => {
    if (!metering) return;
    void recordUsage(metering.supabase, {
      churchId: metering.churchId,
      provider: 'gemini',
      model: MODEL,
      feature: 'ask-grace',
      promptTokens: input.promptTokens ?? estimateTokens(fullPrompt),
      completionTokens: input.completionTokens ?? 0,
      success: input.success,
      errorCode: input.errorCode,
      latencyMs: input.latencyMs,
      actorClerkId: metering.actorClerkId,
    });
  };

  const sendHermesFallback = async () => {
    const hermes = await generateWithHermes({ prompt: fullPrompt, maxTokens });
    if (!hermes.success || !hermes.text) return false;
    if (shouldStream) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.write(hermes.text);
      res.end();
      return true;
    }
    res.status(200).json({ success: true, text: hermes.text, model: hermes.model || 'hermes-agent' });
    return true;
  };

  if (!GEMINI_API_KEY) {
    if (await sendHermesFallback()) return;
    return res.status(503).json({ error: 'AI service not configured' });
  }

  const started = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const config = {
      maxOutputTokens: Math.min(maxTokens || 1024, 4096),
      temperature: 0.7,
      // gemini-2.5-flash enables "thinking" by default, and thinking tokens
      // count against maxOutputTokens — which truncated chat replies to a few
      // words. Disable it for this conversational endpoint.
      thinkingConfig: { thinkingBudget: 0 },
    };

    if (shouldStream) {
      const stream = await ai.models.generateContentStream({
        model: MODEL,
        contents: fullPrompt,
        config,
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');

      let streamedText = '';
      let promptTokens: number | undefined;
      let completionTokens: number | undefined;
      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) {
          streamedText += chunkText;
          res.write(chunkText);
        }
        // The final chunk carries usage metadata when the API reports it.
        if (chunk.usageMetadata) {
          promptTokens = chunk.usageMetadata.promptTokenCount ?? promptTokens;
          completionTokens = chunk.usageMetadata.candidatesTokenCount ?? completionTokens;
        }
      }
      res.end();
      meterResult({
        success: true,
        promptTokens,
        completionTokens: completionTokens ?? estimateTokens(streamedText),
        latencyMs: Date.now() - started,
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: fullPrompt,
      config,
    });

    const text = response.text;

    if (!text) {
      meterResult({ success: false, errorCode: 'empty_response', latencyMs: Date.now() - started });
      return res.status(500).json({ error: 'No response generated' });
    }

    meterResult({
      success: true,
      promptTokens: response.usageMetadata?.promptTokenCount,
      completionTokens: response.usageMetadata?.candidatesTokenCount ?? estimateTokens(text),
      latencyMs: Date.now() - started,
    });

    return res.status(200).json({
      success: true,
      text,
      model: MODEL,
    });
  } catch (error) {
    console.error('Gemini API error:', error);
    meterResult({
      success: false,
      errorCode: 'provider_error',
      completionTokens: 0,
      latencyMs: Date.now() - started,
    });

    // Pass through specifics so the client UI can show something useful
    const message = error instanceof Error ? error.message : String(error);

    // Avoid leaking keys or noisy stack traces; truncate.
    const publicMessage = message.slice(0, 240);

    if (res.headersSent) {
      res.end();
      return;
    }

    if (/API key|invalid key/i.test(message)) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    if (isGeminiQuotaError(message)) {
      if (await sendHermesFallback()) return;
      let friendly = 'Gemini quota hit. Could be the per-minute rate limit, daily quota, or spend cap. Check https://aistudio.google.com/app/spend or wait 60 seconds.';
      if (/per minute|RPM|requests.*minute/i.test(message)) {
        friendly = 'Hit the Gemini per-minute rate limit. Wait 60 seconds and try again, or upgrade tier at https://aistudio.google.com/app/billing';
      } else if (/per day|RPD|requests.*day|daily/i.test(message)) {
        friendly = 'Hit the Gemini daily quota. Resets at midnight Pacific, or upgrade tier at https://aistudio.google.com/app/billing';
      } else if (/spending|spend cap|billing/i.test(message)) {
        friendly = 'Gemini spend cap reached. Raise it at https://aistudio.google.com/app/spend';
      }
      return res.status(429).json({ error: friendly });
    }
    if (/safety|blocked|candidate/i.test(message)) {
      return res.status(400).json({ error: 'Model refused the prompt (safety filter)' });
    }

    return res.status(500).json({ error: 'AI generation failed', detail: publicMessage });
  }
}
