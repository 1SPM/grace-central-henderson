import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_BASE_URL = 'https://api.resend.com';

interface EmailPayload {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
}

interface ResendResponse {
  id?: string;
  message?: string;
}

interface BulkResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function isValidEmail(email: string): boolean {
  // Extract email from "Name <email>" format if present
  const match = email.match(/<([^>]+)>/) || [null, email];
  const emailPart = match[1] || email;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(emailPart) && emailPart.length <= 254;
}

function sanitizeHtml(html: string, maxLength: number = 100000): string {
  return String(html || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .slice(0, maxLength);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const { emails, delayMs = 100 } = req.body as {
    emails: EmailPayload[];
    delayMs?: number;
  };

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'No emails provided' });
  }

  // Limit batch size to prevent timeout
  const MAX_BATCH_SIZE = 50;
  if (emails.length > MAX_BATCH_SIZE) {
    return res.status(400).json({
      error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}. Please send in smaller batches.`,
    });
  }

  const results: BulkResult[] = [];
  const defaultFrom = `Grace CRM <noreply@${process.env.EMAIL_DOMAIN || 'grace-crm.com'}>`;

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];

    // Validate email
    const toAddresses = Array.isArray(email.to) ? email.to : [email.to];
    const validatedTo = toAddresses.filter(isValidEmail);

    if (validatedTo.length === 0) {
      results.push({ success: false, error: 'Invalid recipient email' });
      continue;
    }

    if (!email.subject) {
      results.push({ success: false, error: 'Subject is required' });
      continue;
    }

    const sanitizedHtml = email.html ? sanitizeHtml(email.html) : undefined;
    if (!sanitizedHtml && !email.text) {
      results.push({ success: false, error: 'Email content is required' });
      continue;
    }

    try {
      const response = await fetch(`${RESEND_BASE_URL}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: email.from || defaultFrom,
          to: validatedTo,
          subject: email.subject.slice(0, 998),
          html: sanitizedHtml,
          text: email.text,
        }),
      });

      const data = (await response.json()) as ResendResponse;

      if (!response.ok) {
        results.push({ success: false, error: data.message || 'Failed to send' });
      } else {
        results.push({ success: true, messageId: data.id });
      }
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Send failed',
      });
    }

    // Add delay between emails to avoid rate limiting
    if (i < emails.length - 1 && delayMs > 0) {
      await sleep(Math.min(delayMs, 1000)); // Cap delay at 1 second
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return res.status(200).json({
    success: failCount === 0,
    results,
    summary: {
      total: emails.length,
      sent: successCount,
      failed: failCount,
    },
  });
}
