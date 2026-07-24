/**
 * Rate limiting for api/[...path].ts — the consolidated dispatcher that
 * handles every production API request.
 *
 * This is now a thin wrapper over the shared, durable limiter in
 * rateLimit/limiter.ts: it builds a per-IP-per-route key and delegates.
 * When UPSTASH_REDIS_REST_URL / _TOKEN are set the counter is global across
 * serverless instances (a real backstop against distributed floods); when
 * they're absent it falls back to the original in-memory behaviour, so this
 * is safe to run before Upstash is provisioned.
 */

import type { VercelRequest } from '@vercel/node';
import { rateLimit, clientIp } from './rateLimit/limiter.js';

export interface RateLimitCheck {
  limited: boolean;
  retryAfterSeconds?: number;
}

/** routeKey should be the resolved dispatcher path (e.g. "sms/send"), not
 * the raw request path — keeps limits scoped per-route rather than one
 * shared bucket across the whole API. */
export async function checkDispatcherRateLimit(
  req: VercelRequest,
  routeKey: string,
  maxRequests: number,
  windowMs = 60_000,
): Promise<RateLimitCheck> {
  const result = await rateLimit(`disp:${clientIp(req)}:${routeKey}`, maxRequests, Math.ceil(windowMs / 1000));
  return result.limited
    ? { limited: true, retryAfterSeconds: result.retryAfterSeconds }
    : { limited: false };
}
