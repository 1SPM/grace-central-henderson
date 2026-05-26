/**
 * Welcome email — sent to the admin immediately after their church row
 * is created in /api/billing/create-church. Lands BEFORE Stripe
 * Checkout completes, which is intentional: it confirms the account
 * exists so a user who closes the tab mid-checkout has something in
 * their inbox to come back to.
 *
 * Brand tone: warm, plain-English, no SaaS marketing voice. Same
 * voice as the LandingPage copy.
 */

const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://grace-crm.app';

export interface WelcomeEmailInput {
  adminFullName: string;
  churchName: string;
  /** Optional — included in the receipt CTA when set */
  churchSlug?: string;
}

export function renderWelcomeEmail(input: WelcomeEmailInput): { subject: string; html: string } {
  const { adminFullName, churchName, churchSlug } = input;

  // Use only the first name in greeting if "First Last" pattern matches
  const firstName = adminFullName.split(/\s+/)[0] || adminFullName;

  const subject = `Welcome to GRACE, ${firstName}`;
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #fef3c7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" style="width: 100%; background: #fef3c7; padding: 32px 12px;">
      <tr><td>
        <table role="presentation" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <tr><td>
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="display: inline-block; width: 40px; height: 40px; line-height: 40px; border-radius: 8px; background: linear-gradient(135deg, #f59e0b, #b45309); color: white; font-weight: bold; font-size: 16px;">G</span>
            </div>
            <h1 style="margin: 0 0 16px; color: #111827; font-size: 24px; font-weight: 400; text-align: center;">
              Welcome, ${escapeHtml(firstName)}.
            </h1>
            <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.55;">
              ${escapeHtml(churchName)} is set up on GRACE — your 14-day free trial has started.
              No card has been charged yet; you'll see the first invoice in your inbox the day before
              your trial ends.
            </p>
            <h2 style="margin: 28px 0 12px; color: #111827; font-size: 16px; font-weight: 600;">
              Three things to do this week
            </h2>
            <ol style="margin: 0 0 24px; padding-left: 20px; color: #374151; font-size: 15px; line-height: 1.6;">
              <li style="margin-bottom: 8px;">
                <strong>Import your roster.</strong> Drag a CSV from Planning Center, Breeze,
                ChurchTrac, or any spreadsheet. We auto-detect the columns.
              </li>
              <li style="margin-bottom: 8px;">
                <strong>Set up online giving.</strong> Connect a Stripe account so members can
                give one-time or recurring. Most churches finish setup in 10 minutes.
              </li>
              <li style="margin-bottom: 8px;">
                <strong>Invite your team.</strong> Add other pastors, staff, and volunteer leaders.
                Each gets their own login with the right role.
              </li>
            </ol>
            <div style="text-align: center; margin: 32px 0 16px;">
              <a href="${APP_URL}/welcome" style="display: inline-block; padding: 12px 28px; background: #b45309; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
                Open GRACE
              </a>
            </div>
            ${churchSlug ? `
              <div style="margin-top: 24px; padding: 12px 16px; background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; font-size: 13px; color: #92400e;">
                <strong>Your church's public donate URL</strong> (active once you complete Stripe Connect):
                <br />
                <code style="font-size: 12px; color: #78350f;">${APP_URL}/give/${escapeHtml(churchSlug)}</code>
              </div>
            ` : ''}
            <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 32px 0 16px;" />
            <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center;">
              Reply to this email or write to
              <a href="mailto:support@grace-crm.app" style="color: #b45309;">support@grace-crm.app</a>
              if anything is unclear. A real person answers within 48 hours.
            </p>
            <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
              GRACE · Virtual Worship Solutions Inc.<br />
              <a href="${APP_URL}/privacy" style="color: #9ca3af;">Privacy</a> ·
              <a href="${APP_URL}/terms" style="color: #9ca3af;">Terms</a>
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
