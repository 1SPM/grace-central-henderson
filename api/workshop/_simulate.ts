/**
 * POST /api/workshop/simulate
 *
 * The "Me" stage of the Maya -> Me -> Us -> Pastor -> Real Pilot workshop
 * experience (see the North Star doc). A workshop attendee scans a QR
 * code and, without signing up or having any account, picks a few causes
 * and a rough monthly spend estimate; this computes "if you'd been using
 * the Impact Card, here's roughly the impact your spending could have
 * created" and records it.
 *
 * Deliberately NOT gated behind Clerk/self-signup/staff review — the
 * whole point (per the brief) is that "the actual financial/card rails
 * do not have to be live yet." No card, no KYC, no member account.
 *
 * There is no real spend-to-impact formula anywhere in the product today
 * (real Impact Card figures come from actual processor interchange fees,
 * not a percentage of spend — see api/neobank/_index.ts). ILLUSTRATIVE_RATE_BPS
 * below is an explicit, clearly-labeled stand-in for the workshop only;
 * it is stored on every row so past evidence stays honestly
 * reconstructible even if this rate is retuned later.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { readBody, str, num_ } from '../_lib/validation.js';
import { resolveChurchIdForHost } from '../_lib/resolveChurchByHost.js';
import { clientIp, enforceRateLimit } from '../_lib/rateLimit/limiter.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** 2% — matches the higher of the two inconsistent hardcoded demo rates
 *  found in the tenant HTML (1% and 2% were both used for different line
 *  items); there was no single real rate to inherit, so this is a fresh,
 *  explicit choice for the workshop, not a value pulled from production. */
const ILLUSTRATIVE_RATE_BPS = 200;

const ALLOWED_CAUSES = ['missions', 'building', 'youth', 'food_pantry', 'care_fund'] as const;
type Cause = (typeof ALLOWED_CAUSES)[number];

interface AllocationInput {
  cause: Cause;
  pct: number;
}

function validateAllocations(input: unknown): { ok: true; value: AllocationInput[] } | { ok: false; error: string } {
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

const SCHEMA = {
  displayName: str({ max: 100 }),
  monthlySpend: num_({ required: true, min: 0, max: 100_000 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: 'service_not_configured' });

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  const allocationsResult = validateAllocations((req.body as Record<string, unknown> | undefined)?.allocations);
  if (!allocationsResult.ok) {
    return res.status(400).json({ error: 'invalid_request', detail: allocationsResult.error, path: 'allocations' });
  }

  // Public, no-login surface — throttle per IP. Generous enough for a
  // whole room of workshop attendees hitting it in the same few minutes
  // from a venue's shared wifi (same IP), stingy enough to stop a script.
  if (await enforceRateLimit(res, `workshop-simulate:ip:${clientIp(req)}`, 40, 300,
    'Too many submissions from this network. Please wait a few minutes and try again.')) return;

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const churchId = await resolveChurchIdForHost(req.headers.host, supabase);
  if (!churchId) {
    return res.status(404).json({ error: 'Workshop simulation is not available on this domain' });
  }

  // num_({ required: true }) guarantees this at runtime (readBody already
  // returned null and exited above otherwise) but its type stays
  // `number | undefined` — the validator doesn't narrow on `required`.
  const monthlySpendMicroUsd = Math.round(body.monthlySpend! * 1_000_000);
  const projectedImpactMicroUsd = Math.round((monthlySpendMicroUsd * ILLUSTRATIVE_RATE_BPS) / 10_000);

  const { data: row, error: insertError } = await supabase
    .from('workshop_simulations')
    .insert({
      church_id: churchId,
      display_name: body.displayName || null,
      monthly_spend_micro_usd: monthlySpendMicroUsd,
      allocations: allocationsResult.value,
      illustrative_rate_bps: ILLUSTRATIVE_RATE_BPS,
      projected_impact_micro_usd: projectedImpactMicroUsd,
    })
    .select('id, created_at')
    .single();

  if (insertError) {
    console.error('[workshop/simulate] insert failed', insertError);
    return res.status(500).json({ error: 'submission_failed' });
  }

  const { count, data: sumRows, error: aggError } = await supabase
    .from('workshop_simulations')
    .select('projected_impact_micro_usd', { count: 'exact' })
    .eq('church_id', churchId);

  if (aggError) {
    console.error('[workshop/simulate] aggregate read failed', aggError);
  }

  const totalProjectedImpactMicroUsd = (sumRows ?? []).reduce((sum, r) => sum + Number(r.projected_impact_micro_usd), 0);

  return res.status(200).json({
    success: true,
    simulationId: row.id,
    projectedImpactUsd: projectedImpactMicroUsd / 1_000_000,
    illustrativeRatePct: ILLUSTRATIVE_RATE_BPS / 100,
    church: {
      participantCount: count ?? 0,
      totalProjectedImpactUsd: totalProjectedImpactMicroUsd / 1_000_000,
    },
  });
}
