/**
 * Cron authorization — shared by every api/cron/* route.
 *
 * Vercel's cron scheduler sends `Authorization: Bearer <CRON_SECRET>`
 * when the CRON_SECRET env var is set on the project. That bearer match
 * is the ONLY accepted credential:
 *   - `x-vercel-cron` is NOT trusted. Vercel does not send it (verified
 *     via runtime logs 2026-07-18: real scheduler invocations carried
 *     no such header), and inbound requests CAN carry it (verified via
 *     live spoof test: an external curl with the header reached a 200).
 *     Trusting it is an unauthenticated trigger, not an auth check.
 *   - Missing CRON_SECRET is a visible misconfiguration (503), never a
 *     silent fail-open. The pre-review send-pending-emails behavior
 *     (run unauthenticated when no secret is set) is exactly how a
 *     misconfiguration stays invisible for months.
 *
 * Returns null when authorized; otherwise sends the response and
 * returns the status it sent (caller just `return`s).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export function requireCronAuth(req: VercelRequest, res: VercelResponse): number | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'cron_secret_not_configured' });
    return 503;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' });
    return 401;
  }
  return null;
}
