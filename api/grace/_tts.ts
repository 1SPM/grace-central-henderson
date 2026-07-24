import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MAX_TTS_TEXT_LEN, isTtsConfigured, synthesizeSpeech } from '../_lib/grace-tts.js';
import { clientIp, enforceRateLimit } from '../_lib/rateLimit/limiter.js';
import { requireClerkAuth } from '../_lib/auth-helper.js';
import { isDemoModeActive } from '../_lib/authz.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isTtsConfigured()) {
    return res.status(503).json({ error: 'TTS not configured' });
  }

  // TTS calls a paid upstream provider — require a real app identity so the
  // open internet can't drive the bill. A signed-in user sends a Clerk bearer
  // token; the anonymous public demo is allowed via the demo-mode path (it is
  // separately IP-rate-limited). No token + not demo → 401.
  const hasBearer = typeof req.headers.authorization === 'string'
    && req.headers.authorization.startsWith('Bearer ');
  if (hasBearer) {
    const auth = await requireClerkAuth(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  } else if (!isDemoModeActive(req)) {
    return res.status(401).json({ error: 'auth_required' });
  }

  // Cap per-IP synthesis rate so a single caller can't run up the bill.
  // Falls back to on-screen text.
  if (await enforceRateLimit(res, `tts:ip:${clientIp(req)}`, 30, 300,
    'Voice playback is busy — please wait a moment. The text is still available on screen.')) return;

  let body: { text?: string } = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const text = String(body.text || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Missing text' });
  }
  if (text.length > MAX_TTS_TEXT_LEN) {
    return res.status(400).json({ error: 'Text too long' });
  }

  try {
    const buffer = await synthesizeSpeech(text);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(buffer);
  } catch (err) {
    console.error('grace/tts error', err instanceof Error ? err.message : err);
    return res.status(502).json({ error: 'TTS request failed' });
  }
}
