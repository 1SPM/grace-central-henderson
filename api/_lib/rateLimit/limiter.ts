/**
 * Shared rate-limit helper — durable (Upstash Redis) with an in-memory
 * fallback.
 *
 * WHY: the previous limiter (dispatcherRateLimit.ts) was an in-memory Map,
 * which only catches repeat hits landing on the same warm serverless
 * instance — a distributed or multi-region flood slips past it (assessment
 * gap #2). This adds a real cross-instance counter backed by Upstash Redis.
 *
 * SAFE TO SHIP BEFORE UPSTASH EXISTS: when UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN are unset, it behaves exactly like the old
 * in-memory limiter. Add the two env vars (Vercel → Upstash Marketplace)
 * and every counter becomes global with no code change. If Upstash errors
 * or times out, it falls back to memory rather than failing the request —
 * a rate limiter must never take the API down.
 *
 * Algorithm: fixed window via SET-NX-EX + INCR (one pipelined round-trip).
 * Good enough for an abuse backstop; sliding-window is a later upgrade.
 *
 * No new dependencies — Upstash's REST API is called with global `fetch`.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const UPSTASH_TIMEOUT_MS = 800; // fail over to memory rather than hang a request

export type RateLimitBackend = 'upstash' | 'memory';

export interface RateLimitResult {
  limited: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  backend: RateLimitBackend;
}

export function isDurableRateLimitConfigured(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

/**
 * Extract the client IP for use as a rate-limit subject. Prefers x-real-ip
 * (Vercel sets it to the true edge-connecting client and it is not client-
 * supplied). Falls back to the RIGHTMOST x-forwarded-for entry — the one
 * added by the closest trusted proxy — never the spoofable leftmost.
 */
export function clientIp(req: VercelRequest): string {
  const realIp = req.headers['x-real-ip'];
  const realIpValue = Array.isArray(realIp) ? realIp[0] : realIp;
  if (realIpValue?.trim()) return realIpValue.trim();

  const xff = req.headers['x-forwarded-for'];
  const xffValue = Array.isArray(xff) ? xff[xff.length - 1] : xff;
  const parts = xffValue?.split(',').map(p => p.trim()).filter(Boolean);
  const rightmost = parts && parts.length > 0 ? parts[parts.length - 1] : undefined;
  return rightmost || 'unknown';
}

/**
 * Increment the counter for `key` and report whether it is over `max`
 * within the `windowSeconds` window. `key` should already be namespaced by
 * scope + subject, e.g. `disp:1.2.3.4:sms/send`, `ai:user_123`, `sms:church_9`.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<RateLimitResult> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      return await upstashFixedWindow(key, max, windowSeconds);
    } catch (err) {
      console.warn('[rateLimit] upstash error — falling back to memory:', err instanceof Error ? err.message : String(err));
    }
  }
  return memoryFixedWindow(key, max, windowSeconds);
}

/**
 * Convenience wrapper for route handlers: check `key`, and if over the
 * limit send a 429 with Retry-After and return `true` (the caller should
 * `return`). Returns `false` when the request may proceed.
 *
 *   if (await enforceRateLimit(res, `pay:ip:${ip}`, 10, 3600)) return;
 */
export async function enforceRateLimit(
  res: VercelResponse,
  key: string,
  max: number,
  windowSeconds: number,
  message = 'Too many requests — please slow down and try again shortly.',
): Promise<boolean> {
  const result = await rateLimit(key, max, windowSeconds);
  if (result.limited) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    res.status(429).json({ error: 'rate_limited', detail: message, retry_after_seconds: result.retryAfterSeconds });
    return true;
  }
  return false;
}

// ── Upstash (durable, cross-instance) ────────────────────────────────
async function upstashFixedWindow(key: string, max: number, windowSeconds: number): Promise<RateLimitResult> {
  const k = `rl:${key}`;
  // One pipeline: create the key with a TTL only if absent, increment,
  // read the TTL for Retry-After. TTL is set once so the window is fixed
  // (not sliding-on-activity).
  const commands = [
    ['SET', k, '0', 'EX', String(windowSeconds), 'NX'],
    ['INCR', k],
    ['TTL', k],
  ];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTASH_TIMEOUT_MS);
  let payload: Array<{ result?: unknown; error?: string }>;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`upstash HTTP ${res.status}`);
    payload = await res.json() as Array<{ result?: unknown; error?: string }>;
  } finally {
    clearTimeout(timer);
  }

  const incrErr = payload?.[1]?.error;
  if (incrErr) throw new Error(`upstash INCR error: ${incrErr}`);

  const count = Number(payload?.[1]?.result ?? 0);
  const ttl = Number(payload?.[2]?.result ?? windowSeconds);
  const retryTtl = ttl > 0 ? ttl : windowSeconds;
  const limited = count > max;
  return {
    limited,
    limit: max,
    remaining: Math.max(0, max - count),
    retryAfterSeconds: limited ? retryTtl : 0,
    backend: 'upstash',
  };
}

// ── in-memory fallback (per warm instance) ───────────────────────────
interface MemoryEntry { count: number; resetAt: number }
const store = new Map<string, MemoryEntry>();

function memoryFixedWindow(key: string, max: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  // Opportunistic bounded cleanup (a background timer can't survive
  // serverless freezes and would just leak).
  if (store.size >= 5000) {
    for (const [k, entry] of store) {
      if (entry.resetAt < now) store.delete(k);
    }
  }

  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, limit: max, remaining: max - 1, retryAfterSeconds: 0, backend: 'memory' };
  }
  if (entry.count >= max) {
    return { limited: true, limit: max, remaining: 0, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000), backend: 'memory' };
  }
  entry.count++;
  return { limited: false, limit: max, remaining: Math.max(0, max - entry.count), retryAfterSeconds: 0, backend: 'memory' };
}

/** Test-only: clear the in-memory store between cases. */
export function __resetMemoryStore(): void {
  store.clear();
}
