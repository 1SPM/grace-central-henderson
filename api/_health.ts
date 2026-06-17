import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthStatus } from './_middleware/auth.js';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  if (_req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authStatus = getAuthStatus();
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    resend: Boolean(process.env.RESEND_API_KEY),
    twilio: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
    ),
    supabase: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    agents: true,
    auth: authStatus,
  });
}
