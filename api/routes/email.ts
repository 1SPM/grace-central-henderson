/**
 * Email Routes - Resend Integration
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  isValidEmail,
  sanitizeString,
  sanitizeHtml,
  validateEmailArray,
  LIMITS,
} from './validation';

const router = Router();
const RESEND_BASE_URL = 'https://api.resend.com';

// API response types
interface ResendResponse {
  id?: string;
  message?: string;
}

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Send single email
router.post('/send', asyncHandler(async (req: Request, res: Response) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'Email service not configured' });
    return;
  }

  const { to, subject, html, text, from, replyTo, cc, bcc } = req.body;

  if (!to || !subject) {
    res.status(400).json({ error: 'Recipient (to) and subject are required' });
    return;
  }

  const toArray = Array.isArray(to) ? to : [to];
  const validatedTo = validateEmailArray(toArray);
  if (!validatedTo) {
    res.status(400).json({ error: 'Invalid email address format' });
    return;
  }

  const sanitizedSubject = sanitizeString(subject, LIMITS.SUBJECT_MAX);
  if (!sanitizedSubject) {
    res.status(400).json({ error: 'Subject is required' });
    return;
  }

  const sanitizedHtml = html ? sanitizeHtml(html, LIMITS.MESSAGE_MAX * 10) : undefined;
  const sanitizedText = text ? sanitizeString(text, LIMITS.MESSAGE_MAX) : undefined;
  const validatedCc = cc ? validateEmailArray(Array.isArray(cc) ? cc : [cc]) : undefined;
  const validatedBcc = bcc ? validateEmailArray(Array.isArray(bcc) ? bcc : [bcc]) : undefined;
  const validatedReplyTo = replyTo && isValidEmail(replyTo) ? replyTo : undefined;

  try {
    const response = await fetch(`${RESEND_BASE_URL}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from || `Grace CRM <noreply@${process.env.EMAIL_DOMAIN || 'grace-crm.com'}>`,
        to: validatedTo,
        subject: sanitizedSubject,
        html: sanitizedHtml,
        text: sanitizedText,
        reply_to: validatedReplyTo,
        cc: validatedCc,
        bcc: validatedBcc,
      }),
    });

    const data = await response.json() as ResendResponse;

    if (!response.ok) {
      res.status(response.status).json({ error: data.message || 'Failed to send email' });
      return;
    }

    res.json({ success: true, messageId: data.id });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
}));

// Send bulk emails
router.post('/send-bulk', asyncHandler(async (req: Request, res: Response) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'Email service not configured' });
    return;
  }

  const { emails, delayMs = 100 } = req.body;

  if (!Array.isArray(emails) || emails.length === 0) {
    res.status(400).json({ error: 'Emails array is required' });
    return;
  }

  if (emails.length > 100) {
    res.status(400).json({ error: 'Maximum 100 emails per batch' });
    return;
  }

  const results: Array<{ success: boolean; messageId?: string; error?: string }> = [];

  for (const email of emails) {
    const toArray = Array.isArray(email.to) ? email.to : [email.to];
    const validatedTo = validateEmailArray(toArray);
    if (!validatedTo) {
      results.push({ success: false, error: 'Invalid email address' });
      continue;
    }

    const sanitizedSubject = sanitizeString(email.subject, LIMITS.SUBJECT_MAX);
    if (!sanitizedSubject) {
      results.push({ success: false, error: 'Missing subject' });
      continue;
    }

    try {
      const response = await fetch(`${RESEND_BASE_URL}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: email.from || `Grace CRM <noreply@${process.env.EMAIL_DOMAIN || 'grace-crm.com'}>`,
          to: validatedTo,
          subject: sanitizedSubject,
          html: email.html ? sanitizeHtml(email.html, LIMITS.MESSAGE_MAX * 10) : undefined,
          text: email.text ? sanitizeString(email.text, LIMITS.MESSAGE_MAX) : undefined,
        }),
      });

      const data = await response.json() as ResendResponse;

      if (response.ok) {
        results.push({ success: true, messageId: data.id });
      } else {
        results.push({ success: false, error: data.message || 'Failed to send' });
      }
    } catch {
      results.push({ success: false, error: 'Request failed' });
    }

    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 1000)));
    }
  }

  const successful = results.filter(r => r.success).length;
  res.json({
    success: successful === emails.length,
    total: emails.length,
    successful,
    failed: emails.length - successful,
    results,
  });
}));

export default router;
