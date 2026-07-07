/**
 * Consolidated API dispatcher.
 *
 * Vercel's Hobby plan caps a deployment at 12 serverless functions, and
 * this app has ~36 routes. Every route handler lives in an underscore-
 * prefixed file (which Vercel does not deploy as a function) and is
 * dispatched from this single catch-all instead.
 *
 * Exceptions that remain standalone functions (they need raw request
 * bodies via `bodyParser: false`, which must be set per-function):
 *   - api/webhooks/stripe.ts
 *   - api/webhooks/i2c.ts
 *   - api/agentmail/inbound.ts
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;
type RouteModule = { default: Handler };

const routes: Record<string, () => Promise<RouteModule>> = {
  'admin/seed-demo-data': () => import('./admin/_seed-demo-data.js'),
  'admin/webhooks/dlq': () => import('./admin/webhooks/_dlq.js'),
  'agentmail/reply': () => import('./agentmail/_reply.js'),
  'agentmail/send': () => import('./agentmail/_send.js'),
  'agents/health': () => import('./agents/_health.js'),
  'agents/run': () => import('./agents/_run.js'),
  'agents/settings': () => import('./agents/_settings.js'),
  'ai/generate': () => import('./ai/_generate.js'),
  'ai/health': () => import('./ai/_health.js'),
  'ai/video/start': () => import('./ai/video/_start.js'),
  'ai/video/status': () => import('./ai/video/_status.js'),
  'health': () => import('./_health.js'),
  'billing/activate-trial': () => import('./billing/_activate-trial.js'),
  'billing/connect-onboarding': () => import('./billing/_connect-onboarding.js'),
  'billing/connect-status': () => import('./billing/_connect-status.js'),
  'billing/create-checkout-session': () => import('./billing/_create-checkout-session.js'),
  'billing/create-church': () => import('./billing/_create-church.js'),
  'billing/portal-session': () => import('./billing/_portal-session.js'),
  'calendar/ical': () => import('./calendar/_ical.js'),
  'care/admin': () => import('./care/_admin.js'),
  'care/conversations': () => import('./care/_conversations.js'),
  'care/messages': () => import('./care/_messages.js'),
  'connect-card': () => import('./_connect-card.js'),
  'cron/agents': () => import('./cron/_agents.js'),
  'cron/ai-anomaly': () => import('./cron/_ai-anomaly.js'),
  'cron/reconcile-stripe': () => import('./cron/_reconcile-stripe.js'),
  'cron/send-pending-emails': () => import('./cron/_send-pending-emails.js'),
  'email/send': () => import('./email/_send.js'),
  'giving/create-payment-intent': () => import('./giving/_create-payment-intent.js'),
  'giving/create-subscription': () => import('./giving/_create-subscription.js'),
  'giving/donor-portal-callback': () => import('./giving/_donor-portal-callback.js'),
  'giving/request-donor-portal': () => import('./giving/_request-donor-portal.js'),
  'giving/text-to-give': () => import('./giving/_text-to-give.js'),
  'grace/draft-reply': () => import('./grace/_draft-reply.js'),
  'grace/tts': () => import('./grace/_tts.js'),
  'grace/tts/health': () => import('./grace/_tts-health.js'),
  // Legacy portal path — same handlers as grace/tts (vercel.json rewrites all /api/* here)
  'grace-tts': () => import('./grace/_tts.js'),
  'grace-tts/health': () => import('./grace/_tts-health.js'),
  'import/giving': () => import('./import/_giving.js'),
  'import/people': () => import('./import/_people.js'),
  'leader-apply': () => import('./_leader-apply.js'),
  'leadership/activity': () => import('./leadership/_activity.js'),
  'members/accept-invitation': () => import('./members/_accept-invitation.js'),
  'members/invite': () => import('./members/_invite.js'),
  'neobank': () => import('./neobank/_index.js'),
  'news/headlines': () => import('./news/_headlines.js'),
  'sms/send': () => import('./sms/_send.js'),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const segments = req.query.path;
  const path = Array.isArray(segments) ? segments.join('/') : segments ?? '';

  const load = routes[path];
  if (!load) {
    return res.status(404).json({ error: 'Not found' });
  }

  const mod = await load();
  return mod.default(req, res);
}
