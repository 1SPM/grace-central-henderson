import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendSms } from '../_lib/sms/send.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Recipient (to) and message are required' });
  }

  const result = await sendSms({ to, message: String(message) });

  if (result.ok) {
    return res.status(200).json({ success: true, messageId: result.message_id, status: result.status });
  }
  if (result.skipped) {
    if (result.reason === 'not_configured') {
      return res.status(503).json({ error: 'SMS service not configured' });
    }
    return res.status(400).json({ error: 'Invalid phone number format' });
  }
  return res.status(result.status || 500).json({ error: result.error || 'Failed to send SMS' });
}
