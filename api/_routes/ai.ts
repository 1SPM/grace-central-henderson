/**
 * AI Routes - Gemini API Integration
 *
 * Provides AI text generation endpoints using Google's Gemini API.
 * Mirrors production behavior in api/ai/_generate.ts (model, streaming,
 * thinkingConfig). Metering is production-only via the Vercel handler.
 */

import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { buildFullPrompt, generateWithHermes, getHermesConfig, isGeminiQuotaError, sanitizePrompt } from '../_lib/aiProviders.js';

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';

// Rate limiting (simple in-memory, resets on server restart)
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

function providerErrorPayload(error: unknown): { status: number; body: { error: string; detail?: string } } {
  const message = error instanceof Error ? error.message : String(error);
  const publicMessage = message.slice(0, 240);

  if (/API key|invalid key/i.test(message)) {
    return { status: 401, body: { error: 'Invalid API key' } };
  }
  if (isGeminiQuotaError(message)) {
    return { status: 429, body: { error: 'Gemini quota hit. Wait and try again, or check billing at https://aistudio.google.com/app/spend' } };
  }
  if (/safety|blocked|candidate/i.test(message)) {
    return { status: 400, body: { error: 'Model refused the prompt (safety filter)' } };
  }
  return { status: 500, body: { error: 'AI generation failed', detail: publicMessage } };
}

/**
 * POST /api/ai/generate
 * Generate text using Gemini AI
 */
router.post('/generate', async (req: Request, res: Response) => {
  // Check configuration
  if (!GEMINI_API_KEY && !getHermesConfig().configured) {
    return res.status(503).json({ error: 'AI service not configured' });
  }

  // Rate limiting
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || 'unknown';
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

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const config = {
      maxOutputTokens: Math.min(maxTokens || 1024, 4096),
      temperature: 0.7,
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

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) res.write(chunkText);
      }
      res.end();
      return;
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: fullPrompt,
      config,
    });

    const text = response.text;

    if (!text) {
      return res.status(500).json({ error: 'No response generated' });
    }

    return res.status(200).json({
      success: true,
      text,
      model: MODEL,
    });
  } catch (error) {
    console.error('Gemini API error:', error);

    if (res.headersSent) {
      res.end();
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    if (isGeminiQuotaError(message)) {
      if (await sendHermesFallback()) return;
    }

    const payload = providerErrorPayload(error);
    return res.status(payload.status).json(payload.body);
  }
});

/**
 * GET /api/ai/health
 * Check AI service status
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: GEMINI_API_KEY || getHermesConfig().configured ? 'configured' : 'not_configured',
    model: GEMINI_API_KEY ? MODEL : 'hermes-agent',
    providers: {
      gemini: Boolean(GEMINI_API_KEY),
      hermes: getHermesConfig().configured,
    },
  });
});

export default router;
