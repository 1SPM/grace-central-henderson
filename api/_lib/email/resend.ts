/**
 * Resend REST client. No SDK — just direct fetch to keep the lockfile
 * untouched (same pattern as api/_lib/validation.ts).
 *
 * Resend docs: https://resend.com/docs/api-reference/emails/send-email
 *
 * If RESEND_API_KEY is absent, sendViaResend() returns { ok: false,
 * skipped: true } — the caller (queue drain) marks the outbox row
 * 'skipped' instead of 'failed'. This lets us merge + deploy email
 * features before the operator finishes Resend domain verification.
 *
 * The default from address pulls from EMAIL_FROM env var, falling back
 * to GRACE's noreply mailbox. Real production swaps this per-tenant
 * eventually so churches send from their own domain.
 */

// Read env vars at call time, not module load. Tests rely on this;
// Vercel cold starts also benefit from late-binding.
function resendApiKey(): string | undefined { return process.env.RESEND_API_KEY; }
function defaultFrom(): string { return process.env.EMAIL_FROM ?? 'GRACE <noreply@grace-crm.app>'; }

export interface SendEmailInput {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  /** Optional Resend tags for filtering in their dashboard. */
  tags?: { name: string; value: string }[];
}

export type SendEmailResult =
  | { ok: true; provider: 'resend'; message_id: string }
  | { ok: false; skipped: true; reason: 'no_api_key' | 'invalid_recipient' }
  | { ok: false; skipped: false; status: number; error: string };

export async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = resendApiKey();
  if (!apiKey) {
    return { ok: false, skipped: true, reason: 'no_api_key' };
  }
  if (!input.to || !input.to.includes('@')) {
    return { ok: false, skipped: true, reason: 'invalid_recipient' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from ?? defaultFrom(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text ?? htmlToText(input.html),
        reply_to: input.reply_to,
        tags: input.tags,
      }),
    });
    const body = await res.json() as { id?: string; message?: string; name?: string };
    if (!res.ok) {
      return {
        ok: false,
        skipped: false,
        status: res.status,
        error: body.message ?? body.name ?? `resend HTTP ${res.status}`,
      };
    }
    if (!body.id) {
      return { ok: false, skipped: false, status: 200, error: 'resend returned no id' };
    }
    return { ok: true, provider: 'resend', message_id: body.id };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      status: 0,
      error: err instanceof Error ? err.message : 'unknown network error',
    };
  }
}

/**
 * Lazy HTML → plain-text fallback. Real email clients should always
 * render the HTML; this is for receivers that don't (mailing list
 * archives, some accessibility tools). Strips tags, decodes a couple
 * of common entities, collapses whitespace.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
