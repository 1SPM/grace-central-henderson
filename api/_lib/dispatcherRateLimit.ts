/**
 * Rate limiting for api/[...path].ts — the consolidated dispatcher that
 * handles every production API request (see its own docstring). The
 * Express rate limiter in api/_middleware/rateLimit.ts only protects the
 * local dev server (api/_server.ts) — it was never reachable in
 * production, since Vercel routes everything through the dispatcher
 * instead. That gap is Finding 4 in SECURITY_FINDINGS_STATUS.md.
 *
 * This is a defense-in-depth backstop, not a precise per-user quota:
 * Vercel serverless functions don't share memory across instances or
 * regions, so this in-memory store only catches repeat hits that land
 * on the same warm instance (Fluid Compute reuses instances across
 * concurrent requests, which helps, but gives no cross-instance
 * guarantee). For a hard global limit, a durable store (e.g. Upstash
 * Redis) would be needed — out of scope here; this closes "zero
 * rate limiting at all" without introducing a new infra dependency.
 */

import type { VercelRequest } from '@vercel/node';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Opportunistic cleanup on access rather than a background setInterval —
// a timer doesn't reliably survive serverless function freezes/recycles,
// and would just leak if it did. Bounded so a burst of unique keys can't
// grow the map unchecked between cleanups.
function cleanupExpired(now: number): void {
  if (store.size < 5000) return;
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

function clientKey(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  const first = Array.isArray(xff) ? xff[0] : xff;
  const ip = first?.split(',')[0]?.trim();
  return ip || 'unknown';
}

export interface RateLimitCheck {
  limited: boolean;
  retryAfterSeconds?: number;
}

/** routeKey should be the resolved dispatcher path (e.g. "sms/send"), not
 * the raw request path — keeps limits scoped per-route like the original
 * Express middleware, rather than one shared bucket across the whole API. */
export function checkDispatcherRateLimit(
  req: VercelRequest,
  routeKey: string,
  maxRequests: number,
  windowMs = 60_000,
): RateLimitCheck {
  const now = Date.now();
  cleanupExpired(now);

  const key = `${clientKey(req)}:${routeKey}`;
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  if (entry.count >= maxRequests) {
    return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { limited: false };
}
