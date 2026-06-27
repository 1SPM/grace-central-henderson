import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../../_lib/auth-helper.js';
import { checkBudget } from '../../_lib/ai/budget.js';
import { recordUsage } from '../../_lib/ai/usage.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const MODEL = 'veo-3.1-fast-generate-preview';

const ASPECT_RATIOS = new Set(['16:9', '9:16']);
const DURATIONS = new Set([4, 6, 8]);
const RESOLUTIONS = new Set(['720p', '1080p']);

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function publicProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/quota|rate|billing|spend|limit/i.test(message)) {
    return 'Gemini video generation quota or billing limit reached. Check Google AI Studio billing, spend caps, and Veo access.';
  }
  return message.slice(0, 240);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireClerkAuth(req);
  if (auth.ok === false) {
    return res.status(auth.status).json({ error: auth.error });
  }

  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Gemini API key is not configured.' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Supabase service role is not configured.' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const budget = await checkBudget(supabase, auth.churchId);
  if (budget.status !== 'ok') {
    return res.status(402).json({
      error: budget.status === 'hard_cut'
        ? 'Monthly AI budget exhausted. Sermon video generation is paused until the new billing month or a cap increase.'
        : 'Monthly AI budget reached. Sermon video generation may be limited — consider raising the cap in Settings.',
      budget_status: budget.status,
      spent_micro_usd: budget.spentMicroUsd,
      cap_micro_usd: budget.capMicroUsd,
    });
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (prompt.length < 12) {
    return res.status(400).json({ error: 'Prompt must be at least 12 characters.' });
  }

  const negativePrompt = typeof req.body?.negativePrompt === 'string'
    ? req.body.negativePrompt.trim()
    : '';
  const aspectRatio = ASPECT_RATIOS.has(req.body?.aspectRatio) ? req.body.aspectRatio : '16:9';
  const durationSeconds = DURATIONS.has(Number(req.body?.durationSeconds))
    ? Number(req.body.durationSeconds)
    : 8;
  const resolution = RESOLUTIONS.has(req.body?.resolution) ? req.body.resolution : '720p';

  const started = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const operation = await ai.models.generateVideos({
      model: MODEL,
      source: { prompt },
      config: {
        numberOfVideos: 1,
        aspectRatio,
        durationSeconds,
        resolution,
        negativePrompt: negativePrompt || undefined,
        enhancePrompt: true,
        generateAudio: true,
      },
    });

    if (!operation.name) {
      return res.status(502).json({ error: 'Gemini did not return a video operation name.' });
    }

    const { data, error } = await supabase
      .from('sermon_video_jobs')
      .insert({
        church_id: auth.churchId,
        created_by_clerk_id: auth.clerkUserId,
        status: 'running',
        operation_name: operation.name,
        prompt,
        negative_prompt: negativePrompt || null,
        model: MODEL,
        aspect_ratio: aspectRatio,
        resolution,
        duration_seconds: durationSeconds,
      })
      .select('id, status, operation_name, prompt, aspect_ratio, resolution, duration_seconds, created_at')
      .single();

    if (error || !data) {
      return res.status(500).json({ error: error?.message || 'Failed to create video job.' });
    }

    void recordUsage(supabase, {
      churchId: auth.churchId,
      provider: 'gemini',
      model: MODEL,
      feature: 'sermon-video',
      promptTokens: estimateTokens(prompt),
      completionTokens: 0,
      success: true,
      latencyMs: Date.now() - started,
      actorClerkId: auth.clerkUserId,
    });

    return res.status(202).json({
      success: true,
      job: {
        id: data.id,
        status: data.status,
        operationName: data.operation_name,
        prompt: data.prompt,
        aspectRatio: data.aspect_ratio,
        resolution: data.resolution,
        durationSeconds: data.duration_seconds,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    void recordUsage(supabase, {
      churchId: auth.churchId,
      provider: 'gemini',
      model: MODEL,
      feature: 'sermon-video',
      promptTokens: estimateTokens(prompt),
      completionTokens: 0,
      success: false,
      errorCode: 'provider_error',
      latencyMs: Date.now() - started,
      actorClerkId: auth.clerkUserId,
    });
    return res.status(502).json({ error: publicProviderError(error) });
  }
}
