/**
 * Donation receipt email. Sent after every successful payment_intent
 * (one-time and recurring renewals). IRS Publication 1771 lays out
 * what a "contemporaneous written acknowledgement" needs to contain
 * for a donor to claim a tax deduction; this template includes:
 *
 *   - Name of the organization (the church)
 *   - Amount of the contribution
 *   - Date of the contribution
 *   - Statement of whether goods or services were provided in exchange
 *     for the contribution (we say "no goods or services" — true for
 *     unrestricted online giving)
 *
 * The church's EIN is included when available (some donors need it
 * for >$5,000 substantiation). Pulled from churches.tax_ein if set.
 *
 * Brand tone matches welcome.ts. The footer carries the GRACE wordmark
 * + a "powered by" link, but the body reads as if it's from the church.
 */

const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://grace-crm.app';

export interface DonationReceiptInput {
  donorName: string | null;
  donorEmail: string;
  churchName: string;
  churchSlug: string | null;
  churchEin: string | null;
  amountCents: number;
  fund: string;
  occurredAt: Date;
  /** When true, this is a recurring-gift renewal receipt; copy mentions it. */
  isRecurring: boolean;
  /** Frequency label for recurring ("month", "week", "year"). Ignored when isRecurring=false. */
  frequency?: string;
}

export function renderDonationReceiptEmail(input: DonationReceiptInput): {
  subject: string;
  html: string;
} {
  const {
    donorName, churchName, churchSlug, churchEin, amountCents, fund, occurredAt,
    isRecurring, frequency,
  } = input;

  const greetingName = (donorName?.split(/\s+/)[0]) || 'Friend';
  const amountDisplay = formatUsd(amountCents);
  const dateDisplay = occurredAt.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const subject = isRecurring
    ? `Receipt: ${amountDisplay}/${frequency ?? 'month'} to ${churchName}`
    : `Receipt: ${amountDisplay} gift to ${churchName}`;

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" style="width: 100%; background: #f3f4f6; padding: 32px 12px;">
      <tr><td>
        <table role="presentation" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden;">
          <tr><td style="padding: 32px 28px 16px; border-bottom: 1px solid #f3f4f6;">
            <h1 style="margin: 0 0 4px; color: #111827; font-size: 22px; font-weight: 500;">
              Thank you, ${escapeHtml(greetingName)}.
            </h1>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Receipt for your gift to ${escapeHtml(churchName)}.
            </p>
          </td></tr>

          <tr><td style="padding: 28px;">
            <div style="display: block; padding: 16px; background: #fefce8; border: 1px solid #fde68a; border-radius: 12px; margin-bottom: 24px;">
              <div style="font-size: 28px; font-weight: 600; color: #111827; line-height: 1;">
                ${escapeHtml(amountDisplay)}${isRecurring ? `<span style="font-size: 14px; font-weight: 400; color: #6b7280;"> / ${escapeHtml(frequency ?? 'month')}</span>` : ''}
              </div>
              <div style="font-size: 13px; color: #6b7280; margin-top: 6px;">
                ${escapeHtml(dateDisplay)} · ${escapeHtml(fund)} fund
              </div>
            </div>

            <h2 style="margin: 0 0 8px; color: #111827; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">
              Tax-deduction record
            </h2>
            <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
              <tr><td style="padding: 4px 0; color: #6b7280; width: 35%;">Organization</td>
                  <td style="padding: 4px 0;">${escapeHtml(churchName)}</td></tr>
              ${churchEin ? `
                <tr><td style="padding: 4px 0; color: #6b7280;">EIN</td>
                    <td style="padding: 4px 0; font-family: monospace;">${escapeHtml(churchEin)}</td></tr>
              ` : ''}
              <tr><td style="padding: 4px 0; color: #6b7280;">Amount</td>
                  <td style="padding: 4px 0;">${escapeHtml(amountDisplay)}</td></tr>
              <tr><td style="padding: 4px 0; color: #6b7280;">Date</td>
                  <td style="padding: 4px 0;">${escapeHtml(dateDisplay)}</td></tr>
              <tr><td style="padding: 4px 0; color: #6b7280;">Fund</td>
                  <td style="padding: 4px 0;">${escapeHtml(fund)}</td></tr>
              <tr><td style="padding: 4px 0; color: #6b7280; vertical-align: top;">Goods or services</td>
                  <td style="padding: 4px 0;">No goods or services were provided in exchange for this contribution.</td></tr>
            </table>

            ${isRecurring ? `
              <div style="margin-top: 24px; padding: 12px 16px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 13px; color: #1e3a8a;">
                <strong>This is a recurring gift.</strong> Your card will be charged
                ${escapeHtml(amountDisplay)} automatically each ${escapeHtml(frequency ?? 'month')}.
                To pause or cancel, reply to this email or contact the church directly.
              </div>
            ` : ''}

            <p style="margin: 24px 0 0; color: #6b7280; font-size: 13px; line-height: 1.55;">
              Keep this email for your records. Consult your tax advisor for guidance on
              whether and how to claim this contribution as a deduction.
            </p>
          </td></tr>

          <tr><td style="padding: 16px 28px 24px; border-top: 1px solid #f3f4f6;">
            ${churchSlug ? `
              <a href="${APP_URL}/give/${escapeHtml(churchSlug)}" style="color: #b45309; font-size: 13px; text-decoration: none;">
                Give again →
              </a>
              <span style="color: #d1d5db; margin: 0 8px;">·</span>
            ` : ''}
            <a href="mailto:?subject=Question about my gift" style="color: #6b7280; font-size: 13px; text-decoration: none;">
              Contact the church
            </a>
          </td></tr>

          <tr><td style="padding: 12px 28px 20px; text-align: center; background: #fafafa;">
            <p style="margin: 0; color: #9ca3af; font-size: 11px;">
              Powered by <a href="${APP_URL}" style="color: #9ca3af; text-decoration: underline;">GRACE</a>
              · Online giving for churches
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
