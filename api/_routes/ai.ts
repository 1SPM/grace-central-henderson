/**
 * AI Routes - Gemini API Integration
 *
 * Provides AI text generation endpoints using Google's Gemini API.
 * Works in both local development (Express) and production (Vercel serverless).
 */

import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Rate limiting (simple in-memory, resets on server restart)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // requests per minute
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

function sanitizePrompt(prompt: string, maxLength: number = 10000): string {
  return String(prompt || '').trim().slice(0, maxLength);
}

/**
 * POST /api/ai/generate
 * Generate text using Gemini AI
 */
router.post('/generate', async (req: Request, res: Response) => {
  // Check configuration
  if (!GEMINI_API_KEY) {
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

  // Build the full prompt with optional context
  let fullPrompt = sanitizedPrompt;
  if (context && typeof context === 'string') {
    const sanitizedContext = sanitizePrompt(context, 5000);
    fullPrompt = `Context: ${sanitizedContext}\n\nRequest: ${sanitizedPrompt}`;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: fullPrompt,
      config: {
        maxOutputTokens: Math.min(maxTokens || 1024, 4096),
        temperature: 0.7,
      },
    });

    const text = response.text;

    if (!text) {
      return res.status(500).json({ error: 'No response generated' });
    }

    return res.status(200).json({
      success: true,
      text,
      model: 'gemini-2.0-flash',
    });
  } catch (error) {
    console.error('Gemini API error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return res.status(401).json({ error: 'Invalid API key configuration' });
      }
      if (error.message.includes('quota')) {
        return res.status(429).json({ error: 'API quota exceeded' });
      }
    }

    return res.status(500).json({ error: 'AI generation failed' });
  }
});

/**
 * GET /api/ai/health
 * Check AI service status
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: GEMINI_API_KEY ? 'configured' : 'not_configured',
    model: 'gemini-2.0-flash',
  });
});

export default router;
