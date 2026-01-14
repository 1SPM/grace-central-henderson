import type { VercelRequest, VercelResponse } from '@vercel/node';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const TWILIO_BASE_URL = 'https://api.twilio.com/2010-04-01';

interface TwilioResponse {
  sid?: string;
  status?: string;
  message?: string;
}

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (!phone.startsWith('+')) return `+${digits}`;
  return phone;
}

function getTwilioAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check configuration
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return res.status(503).json({ error: 'SMS service not configured' });
  }

  const { to, message } = req.body;

  // Validate required fields
  if (!to || !message) {
    return res.status(400).json({ error: 'Recipient (to) and message are required' });
  }

  // Validate phone number
  if (!isValidPhone(to)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  // Limit message length
  const sanitizedMessage = String(message).slice(0, 1600);
  if (!sanitizedMessage) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const formattedTo = formatPhoneNumber(to);
    const formData = new URLSearchParams();
    formData.append('To', formattedTo);
    formData.append('From', TWILIO_FROM_NUMBER);
    formData.append('Body', sanitizedMessage);

    const response = await fetch(
      `${TWILIO_BASE_URL}/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': getTwilioAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      }
    );

    const data = await response.json() as TwilioResponse;

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Failed to send SMS' });
    }

    return res.status(200).json({ success: true, messageId: data.sid, status: data.status });
  } catch (error) {
    console.error('SMS send error:', error);
    return res.status(500).json({ error: 'Failed to send SMS' });
  }
}
