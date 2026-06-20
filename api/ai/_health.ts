import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getHermesConfig } from '../_lib/aiProviders.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  if (_req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.json({
    status: GEMINI_API_KEY || getHermesConfig().configured ? 'configured' : 'not_configured',
    model: GEMINI_API_KEY ? MODEL : 'hermes-agent',
    providers: {
      gemini: Boolean(GEMINI_API_KEY),
      hermes: getHermesConfig().configured,
    },
  });
}
