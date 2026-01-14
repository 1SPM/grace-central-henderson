import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_BASE_URL = 'https://api.resend.com';

interface ResendResponse {
  id?: string;
  message?: string;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function sanitizeString(str: string, maxLength: number = 10000): string {
  return String(str || '').trim().slice(0, maxLength);
}

function sanitizeHtml(html: string, maxLength: number = 100000): string {
  // Basic sanitization - remove script tags
  return String(html || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .slice(0, maxLength);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check configuration
  if (!RESEND_API_KEY) {
    return res.status(503).json({ error: 'Email service not configured' });
  }

  const { from, to, subject, html, text, reply_to, cc, bcc } = req.body;

  // Validate required fields
  if (!to || !subject) {
    return res.status(400).json({ error: 'Recipient (to) and subject are required' });
  }

  // Validate and sanitize to address(es)
  const toAddresses = Array.isArray(to) ? to : [to];
  const validatedTo = toAddresses.filter(isValidEmail);
  if (validatedTo.length === 0) {
    return res.status(400).json({ error: 'No valid recipient email addresses' });
  }

  // Sanitize content
  const sanitizedSubject = sanitizeString(subject, 998);
  const sanitizedHtml = html ? sanitizeHtml(html) : undefined;
  const sanitizedText = text ? sanitizeString(text, 100000) : undefined;

  if (!sanitizedHtml && !sanitizedText) {
    return res.status(400).json({ error: 'Either html or text content is required' });
  }

  try {
    const response = await fetch(`${RESEND_BASE_URL}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from || `Grace CRM <noreply@${process.env.EMAIL_DOMAIN || 'grace-crm.com'}>`,
        to: validatedTo,
        subject: sanitizedSubject,
        html: sanitizedHtml,
        text: sanitizedText,
        reply_to: reply_to && isValidEmail(reply_to) ? reply_to : undefined,
        cc: cc ? (Array.isArray(cc) ? cc : [cc]).filter(isValidEmail) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]).filter(isValidEmail) : undefined,
      }),
    });

    const data = await response.json() as ResendResponse;

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Failed to send email' });
    }

    return res.status(200).json({ success: true, messageId: data.id });
  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
