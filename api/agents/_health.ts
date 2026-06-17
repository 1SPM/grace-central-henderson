import type { VercelRequest, VercelResponse } from '@vercel/node';

const VALID_AGENTS = ['life-event-agent', 'donation-processing-agent', 'new-member-agent'];

export default function handler(_req: VercelRequest, res: VercelResponse) {
  if (_req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  return res.json({
    status: 'ok',
    agents: VALID_AGENTS,
    storage: supabaseUrl && supabaseKey ? 'supabase' : 'memory',
    timestamp: new Date().toISOString(),
  });
}
