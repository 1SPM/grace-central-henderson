import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { buildFullPrompt, generateWithHermes, getHermesConfig, isGeminiQuotaError, sanitizePrompt } from '../_lib/aiProviders.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
    };

    if (shouldStream) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');

      const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config,
      });

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) res.write(chunkText);
      }
      res.end();
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
      model: 'gemini-2.5-flash',
    });
  } catch (error) {
    console.error('Gemini API error:', error);

    // Pass through specifics so the client UI can show something useful
    const message = error instanceof Error ? error.message : String(error);

    // Avoid leaking keys or noisy stack traces; truncate.
    const publicMessage = message.slice(0, 240);

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
