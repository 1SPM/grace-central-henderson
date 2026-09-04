/**
 * Per-member rate limit for Members Portal write routes.
 *
 * api/portal/_assistant.ts already rate-limits its one route
 * (20 requests / 60s per personId, on top of the church-wide AI budget).
 * The other write routes — prayer, care, giving-cancel, profile, journey,
 * groups, events, volunteer, contact, notifications — had no per-caller
 * limit at all; they relied solely on the dispatcher's blanket 600
 * requests/60s per IP (api/[...path].ts), which does nothing to stop one
 * authenticated member from hammering a single route (see the
 * members-portal audit, Phase 1). Reads are left alone — this only
 * guards the routes that write a row.
 *
 * Same budget as the assistant for consistency: generous enough for
 * normal use (nobody submits 20 prayer requests a minute), tight enough
 * to bound abuse from one compromised or scripted session.
 */

import type { VercelResponse } from '@vercel/node';
import { enforceRateLimit } from './rateLimit/limiter.js';

const PORTAL_WRITE_LIMIT = 20;
const PORTAL_WRITE_WINDOW_SECONDS = 60;

export async function enforcePortalWriteLimit(
  res: VercelResponse,
  route: string,
  personId: string,
): Promise<boolean> {
  return enforceRateLimit(
    res,
    `portal:${route}:${personId}`,
    PORTAL_WRITE_LIMIT,
    PORTAL_WRITE_WINDOW_SECONDS,
    'You’re submitting requests quickly — please wait a moment before trying again.',
  );
}
