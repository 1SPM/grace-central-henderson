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

  // Rate-limit key: prefer the authenticated USER, not the IP. Each spoken
  // answer is split into several chunked POSTs, and a whole church office
  // often shares one NAT IP — a per-IP cap throttled staff collectively and
  // cut answers off mid-sentence ("GRACE stopped speaking"). Per-user gives
  // each signed-in staffer their own generous budget; the anonymous public
  // demo stays per-IP (tighter, since it's untrusted).
  let rateKey = `tts:ip:${clientIp(req)}`;
  let rateLimit = 30;
  if (hasBearer) {
    const auth = await requireClerkAuth(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    rateKey = `tts:user:${auth.clerkUserId}`;
    rateLimit = 120; // ~40 chunked answers / 5 min per staffer — ample, still bounds abuse
  } else if (!isDemoModeActive(req)) {
    return res.status(401).json({ error: 'auth_required' });
  }

  // Cap synthesis rate so a single caller can't run up the bill. On trip the
  // client shows a transient "voice is busy" notice; the text stays on screen.
  if (await enforceRateLimit(res, rateKey, rateLimit, 300,
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
