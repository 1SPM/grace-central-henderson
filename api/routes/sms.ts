/**
 * SMS Routes (Twilio)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { isValidPhone, sanitizeString, LIMITS } from './validation';

const router = Router();

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const TWILIO_BASE_URL = 'https://api.twilio.com/2010-04-01';

// Twilio API response type
interface TwilioResponse {
  sid?: string;
  status?: string;
  message?: string;
}

// Error handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }
  return phone;
}

// Check if SMS service is configured
function isSmsConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
}

// Get auth header for Twilio
function getTwilioAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
}

// Send SMS
router.post('/send', asyncHandler(async (req: Request, res: Response) => {
  if (!isSmsConfigured()) {
    res.status(503).json({ error: 'SMS service not configured' });
    return;
  }

  const { to, message } = req.body;

  // Validate required fields
  if (!to || !message) {
    res.status(400).json({ error: 'Recipient (to) and message are required' });
    return;
  }

  // Validate phone number format
  if (!isValidPhone(to)) {
    res.status(400).json({ error: 'Invalid phone number format' });
    return;
  }

  // Sanitize and limit message length
  const sanitizedMessage = sanitizeString(message, LIMITS.SMS_MAX);
  if (!sanitizedMessage) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    const formattedTo = formatPhoneNumber(to);
    const formData = new URLSearchParams();
    formData.append('To', formattedTo);
    formData.append('From', TWILIO_FROM_NUMBER!);
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
      res.status(response.status).json({ error: data.message || 'Failed to send SMS' });
      return;
    }

    res.json({ success: true, messageId: data.sid, status: data.status });
  } catch (error) {
    console.error('SMS send error:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
}));

// Send bulk SMS with rate limiting
router.post('/send-bulk', asyncHandler(async (req: Request, res: Response) => {
  if (!isSmsConfigured()) {
    res.status(503).json({ error: 'SMS service not configured' });
    return;
  }

  const { messages, delayMs = 200 } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Messages array is required' });
    return;
  }

  // Limit bulk SMS to prevent abuse
  if (messages.length > 50) {
    res.status(400).json({ error: 'Maximum 50 messages per batch' });
    return;
  }

  const results: Array<{ success: boolean; messageId?: string; error?: string }> = [];

  for (const msg of messages) {
    // Validate each message in the batch
    if (!msg.to || !msg.message) {
      results.push({ success: false, error: 'Missing to or message' });
      continue;
    }

    if (!isValidPhone(msg.to)) {
      results.push({ success: false, error: 'Invalid phone number' });
      continue;
    }

    const sanitizedMessage = sanitizeString(msg.message, LIMITS.SMS_MAX);
    if (!sanitizedMessage) {
      results.push({ success: false, error: 'Invalid message' });
      continue;
    }

    try {
      const formattedTo = formatPhoneNumber(msg.to);
      const formData = new URLSearchParams();
      formData.append('To', formattedTo);
      formData.append('From', TWILIO_FROM_NUMBER!);
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

      if (response.ok) {
        results.push({ success: true, messageId: data.sid });
      } else {
        results.push({ success: false, error: data.message || 'Failed to send' });
      }
    } catch {
      results.push({ success: false, error: 'Request failed' });
    }

    // Rate limiting delay
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 1000)));
    }
  }

  const successful = results.filter(r => r.success).length;
  res.json({
    success: successful === messages.length,
    total: messages.length,
    successful,
    failed: messages.length - successful,
    results,
  });
}));

// Get SMS status
router.get('/status/:messageId', asyncHandler(async (req: Request, res: Response) => {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    res.status(503).json({ error: 'SMS service not configured' });
    return;
  }

  const { messageId } = req.params;

  try {
    const response = await fetch(
      `${TWILIO_BASE_URL}/Accounts/${TWILIO_ACCOUNT_SID}/Messages/${messageId}.json`,
      {
        method: 'GET',
        headers: {
          'Authorization': getTwilioAuthHeader(),
        },
      }
    );

    const data = await response.json() as TwilioResponse;

    if (!response.ok) {
      res.status(response.status).json({ error: data.message || 'Failed to get status' });
      return;
    }

    res.json({ success: true, messageId: data.sid, status: data.status });
  } catch (error) {
    console.error('SMS status error:', error);
    res.status(500).json({ error: 'Failed to get message status' });
  }
}));

export default router;
