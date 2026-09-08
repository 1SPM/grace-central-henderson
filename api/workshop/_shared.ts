/**
 * Shared constants and helpers for the Maya -> Me -> Us -> Pastor ->
 * Real Pilot workshop experience, used by more than one route in this
 * directory. Extracted from api/workshop/_simulate.ts (where these were
 * originally module-private) so a second endpoint (the wallet stage)
 * doesn't have to import another route's internals.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** 2% — matches the higher of the two inconsistent hardcoded demo rates
 *  found in the tenant HTML (1% and 2% were both used for different line
 *  items); there was no single real rate to inherit, so this is a fresh,
 *  explicit choice for the workshop, not a value pulled from production. */
export const ILLUSTRATIVE_RATE_BPS = 200;

export const ALLOWED_CAUSES = ['missions', 'building', 'youth', 'food_pantry', 'care_fund'] as const;
export type Cause = (typeof ALLOWED_CAUSES)[number];

export interface AllocationInput {
  cause: Cause;
  pct: number;
}

export function validateAllocations(input: unknown): { ok: true; value: AllocationInput[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: 'allocations must be a non-empty array' };
  }
  if (input.length > ALLOWED_CAUSES.length) {
    return { ok: false, error: `allocations must have at most ${ALLOWED_CAUSES.length} entries` };
  }
  const out: AllocationInput[] = [];
  let total = 0;
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'object' || item === null) {
      return { ok: false, error: 'each allocation must be an object' };
    }
    const { cause, pct } = item as Record<string, unknown>;
    if (typeof cause !== 'string' || !ALLOWED_CAUSES.includes(cause as Cause)) {
      return { ok: false, error: `allocation cause must be one of ${ALLOWED_CAUSES.join(', ')}` };
    }
    if (seen.has(cause)) {
      return { ok: false, error: `duplicate allocation cause: ${cause}` };
    }
    seen.add(cause);
    if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      return { ok: false, error: 'allocation pct must be a number between 0 and 100' };
    }
    total += pct;
    out.push({ cause: cause as Cause, pct });
  }
  if (Math.abs(total - 100) > 0.5) {
    return { ok: false, error: `allocation percentages must sum to 100 (got ${total})` };
  }
  return { ok: true, value: out };
}

/** A single-value sibling to validateAllocations, for the wallet stage
 *  (one headline cause, not a % split). Kept as its own small function
 *  rather than overloading validateAllocations to handle both shapes. */
export function validateHeadlineCause(input: unknown): { ok: true; value: Cause } | { ok: false; error: string } {
  if (typeof input !== 'string' || !ALLOWED_CAUSES.includes(input as Cause)) {
    return { ok: false, error: `headlineCause must be one of ${ALLOWED_CAUSES.join(', ')}` };
  }
  return { ok: true, value: input as Cause };
}

/**
 * Given a church id, returns the public URL where that church's
 * /workshop.html actually lives -- or null if none is known yet.
 *
 * Deliberately NOT derived from churches.hosts (migration 049's
 * cosmetic/branding custom-domain list). Verified live: Central
 * Henderson's own custom domain (gracecrm-centralhenderson.org) is the
 * ADMIN-web project's domain -- requesting /workshop.html there returns
 * HTTP 200 but silently serves the admin CRM's own index.html shell
 * (its SPA-fallback rewrite doesn't exclude that path), not the real
 * workshop page. Using churches.hosts here would reproduce that exact
 * silent-wrong-content bug.
 *
 * This is a narrow, explicit sibling to HOST_CHURCH_IDS's own member-web
 * entry (api/_lib/authz.ts) -- update both together if the pending M8
 * custom-domain cutover ever gives grace-members its own domain, or if
 * a second tenant's Member Portal goes live on its own host.
 */
const WORKSHOP_URLS_BY_CHURCH_ID: Record<string, string> = {
  '11111111-1111-1111-1111-111111111111': 'https://grace-members.vercel.app/workshop.html', // Central Henderson
};

export async function resolveWorkshopUrlForChurch(churchId: string, _supabase: SupabaseClient): Promise<string | null> {
  return WORKSHOP_URLS_BY_CHURCH_ID[churchId] ?? null;
}
