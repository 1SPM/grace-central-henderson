import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isTtsConfigured, probeTtsHealth } from '../_lib/grace-tts.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = await probeTtsHealth();
  return res.status(payload.ok ? 200 : 503).json(payload);
}
