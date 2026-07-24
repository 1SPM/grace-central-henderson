/**
 * Consolidated API dispatcher.
 *
 * Vercel's Hobby plan caps a deployment at 12 serverless functions, and
 * this app has 45+ routes. Every route handler lives in an underscore-
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
import { checkDispatcherRateLimit } from './_lib/dispatcherRateLimit.js';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;
type RouteModule = { default: Handler };

const routes: Record<string, () => Promise<RouteModule>> = {
  'admin/seed-demo-data': () => import('./admin/_seed-demo-data.js'),
  'admin/webhooks/dlq': () => import('./admin/webhooks/_dlq.js'),
  'agentmail/reply': () => import('./agentmail/_reply.js'),
  'agentmail/send': () => import('./agentmail/_send.js'),
  'agents/findings': () => import('./agents/_findings.js'),
  'agents/health': () => import('./agents/_health.js'),
  'agents/run': () => import('./agents/_run.js'),
  'agents/settings': () => import('./agents/_settings.js'),
  'agents/workos-registry': () => import('./agents/_workos-registry.js'),
  'agents/workos-run': () => import('./agents/_workos-run.js'),
  'ai/generate': () => import('./ai/_generate.js'),
  'ai/health': () => import('./ai/_health.js'),
  'ai/video/start': () => import('./ai/video/_start.js'),
  'ai/video/status': () => import('./ai/video/_status.js'),
  'approvals': () => import('./approvals/_index.js'),
  'audit/timeline': () => import('./audit/_timeline.js'),
  'automation/status': () => import('./automation/_status.js'),
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
  'care-requests': () => import('./care-requests/_index.js'),
  'care-requests/assign': () => import('./care-requests/_assign.js'),
  'care-requests/notes': () => import('./care-requests/_notes.js'),
  'community/reports': () => import('./community/_reports.js'),
  'community/blocks': () => import('./community/_blocks.js'),
  'community/moderate': () => import('./community/_moderate.js'),
  'connect-card': () => import('./_connect-card.js'),
  'consents': () => import('./consents/_index.js'),
  'consents/data-requests': () => import('./consents/_data-requests.js'),
  'cron/agents': () => import('./cron/_agents.js'),
  'cron/ai-anomaly': () => import('./cron/_ai-anomaly.js'),
  'cron/reconcile-stripe': () => import('./cron/_reconcile-stripe.js'),
  'cron/send-pending-emails': () => import('./cron/_send-pending-emails.js'),
  'cron/notify': () => import('./cron/_notify.js'),
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
  'portal/home': () => import('./portal/_home.js'),
  'portal/church': () => import('./portal/_church.js'),
  'portal/profile': () => import('./portal/_profile.js'),
  'portal/journey': () => import('./portal/_journey.js'),
  'portal/groups': () => import('./portal/_groups.js'),
  'portal/events': () => import('./portal/_events.js'),
  'portal/volunteer': () => import('./portal/_volunteer.js'),
  'portal/contact': () => import('./portal/_contact.js'),
  'portal/requests': () => import('./portal/_requests.js'),
  'portal/notifications': () => import('./portal/_notifications.js'),
  'portal/care': () => import('./portal/_care.js'),
  'portal/assistant': () => import('./portal/_assistant.js'),
  'portal/giving': () => import('./portal/_giving.js'),
  'portal/prayer': () => import('./portal/_prayer.js'),
  'prayer-requests': () => import('./prayer-requests/_index.js'),
  'sms/send': () => import('./sms/_send.js'),
  'impact-card/funnel-metrics': () => import('./impact-card/_funnel-metrics.js'),
  'impact/health': () => import('./impact/_health.js'),
  'impact/ministry-metrics': () => import('./impact/_ministry-metrics.js'),
  'finance/gift-in-kind': () => import('./finance/_gift-in-kind.js'),
  'finance/expenses': () => import('./finance/_expenses.js'),
  'people/preview-portal-token': () => import('./people/_preview-portal-token.js'),
  'people/provision-portal': () => import('./people/_provision-portal.js'),
  'people/seed-demo-persona': () => import('./people/_seed-demo-persona.js'),
  'team/invite': () => import('./team/_invite.js'),
  'team/accept-invitation': () => import('./team/_accept-invitation.js'),
  'team/set-role': () => import('./team/_set-role.js'),
  'tenant/config': () => import('./tenant/_config.js'),
  'tenant/hosts': () => import('./tenant/_hosts.js'),
  'work-orders': () => import('./work-orders/_index.js'),
  'work-orders/tasks': () => import('./work-orders/_tasks.js'),
  'work-orders/dependencies': () => import('./work-orders/_dependencies.js'),
  'work-orders/evidence': () => import('./work-orders/_evidence.js'),
  'work-orders/request-approval': () => import('./work-orders/_request-approval.js'),
  'work-orders/pilot-readiness': () => import('./work-orders/_pilot-readiness.js'),
  'work-orders/create-from-template': () => import('./work-orders/_create-from-template.js'),
  'work-orders/completion-report': () => import('./work-orders/_completion-report.js'),
  'workos/permissions': () => import('./workos/_permissions.js'),
  'workos/summary': () => import('./workos/_summary.js'),
  'workos/decision-queue': () => import('./workos/_decision-queue.js'),
  'workos/notification-prefs': () => import('./workos/_notification-prefs.js'),
};

// Generous, per-IP-per-route defaults — this is a defense-in-depth
// backstop against runaway/automated abuse, not a precise per-user
// quota. Deliberately loose enough to never throttle a real admin
// session (e.g. a bulk message send iterating hundreds of recipients
// with a 150ms pace, ~400 req/min in an extreme case) while still
// meaningfully slowing a naive scripted flood. See dispatcherRateLimit.ts.
const RATE_LIMIT_MAX_REQUESTS = 600;
const RATE_LIMIT_WINDOW_MS = 60_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const segments = req.query.path;
  const path = Array.isArray(segments) ? segments.join('/') : segments ?? '';

  const load = routes[path];
  if (!load) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { limited, retryAfterSeconds } = checkDispatcherRateLimit(
    req,
    path,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS,
  );
  if (limited) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const mod = await load();
  return mod.default(req, res);
}
