/**
 * Donor portal magic-link email. Sent when a donor requests access
 * to manage their giving on /give/<slug>/manage.
 *
 * The link is single-use, 30-minute TTL. We tell the donor that
 * explicitly so they understand why a stale link won't work.
 */

const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://grace-crm.app';

export interface DonorPortalLinkInput {
  churchName: string;
  link: string;
}

export function renderDonorPortalLinkEmail(input: DonorPortalLinkInput): {
  subject: string;
  html: string;
} {
  const { churchName, link } = input;

  const subject = `Manage your giving to ${churchName}`;
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
        <table role="presentation" style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <tr><td>
            <h1 style="margin: 0 0 16px; color: #111827; font-size: 22px; font-weight: 500;">
              Manage your giving
            </h1>
            <p style="margin: 0 0 24px; color: #374151; font-size: 15px; line-height: 1.55;">
              Click the button below to manage your giving to ${escapeHtml(churchName)}. You'll be
              taken to Stripe (our payment processor) where you can pause, cancel, or update the
              card on file for any active recurring gifts.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${link}" style="display: inline-block; padding: 12px 32px; background: #b45309; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
                Manage my giving
              </a>
            </div>
            <p style="margin: 16px 0 0; color: #6b7280; font-size: 13px; line-height: 1.55;">
              This link is single-use and expires in 30 minutes. If you didn't request this,
              you can safely ignore this email — no one else can use the link.
            </p>
            <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 28px 0 16px;" />
            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
              Powered by <a href="${APP_URL}" style="color: #9ca3af; text-decoration: underline;">GRACE</a>
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
