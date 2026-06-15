/**
 * Local dev routes for Grace ElevenLabs TTS — mirrors api/grace/_tts*.ts on Vercel.
 */

import { Router, Request, Response } from 'express';
import { MAX_TTS_TEXT_LEN, isTtsConfigured, probeTtsHealth, synthesizeSpeech } from '../_lib/grace-tts.js';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const payload = await probeTtsHealth();
  res.status(payload.ok ? 200 : 503).json(payload);
});

router.post('/', async (req: Request, res: Response) => {
  if (!isTtsConfigured()) {
    return res.status(503).json({ error: 'TTS not configured' });
  }

  const text = String(req.body?.text || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Missing text' });
  }
  if (text.length > MAX_TTS_TEXT_LEN) {
    return res.status(400).json({ error: 'Text too long' });
  }

  try {
    const buffer = await synthesizeSpeech(text);
    res.status(200);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (err) {
    console.error('grace/tts error', err instanceof Error ? err.message : err);
    return res.status(502).json({ error: 'TTS request failed' });
  }
});

export default router;
