import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  return res.status(410).json({
    error: 'removed',
    message: 'Financial Hub top-givers has been removed. Use Impact Campaigns reporting instead.',
  });
}
