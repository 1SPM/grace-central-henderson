/**
 * POST /api/workshop/wallet-activate
 *
 * The "Wallet" sub-stage of the "Me" stage, continuing from a completed
 * /api/workshop/simulate submission. An attendee who already saw their
 * illustrative spend-allocation impact can continue to a second screen
 * showing an illustrative "Impact Card" preview keyed to one headline
 * cause — same public, anonymous, no-account posture as /simulate.
 *
 * Deliberately NOT wired to api/neobank's real card-issuing backend —
 * illustrative only, per the same honesty posture as workshop_simulations
 * (see api/workshop/_shared.ts and migration 080's own comment). No PAN,
 * no CVV, no KYC, no application of any kind.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { readBody, uuid_ } from '../_lib/validation.js';
import { resolveChurchIdForHost } from '../_lib/resolveChurchByHost.js';
import { clientIp, enforceRateLimit } from '../_lib/rateLimit/limiter.js';
import { validateHeadlineCause } from './_shared.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEMA = {
  simulationId: uuid_({ required: true }),
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

  const causeResult = validateHeadlineCause((req.body as Record<string, unknown> | undefined)?.headlineCause);
  if (!causeResult.ok) {
    return res.status(400).json({ error: 'invalid_request', detail: causeResult.error, path: 'headlineCause' });
  }

  // Same budget as /simulate — this is a lighter-weight follow-up tap,
  // not a form submit, but there's no reason to give it a separate
  // number; a whole room continuing through the wallet stage in the
  // same few minutes should tolerate the same generous limit.
  if (await enforceRateLimit(res, `workshop-wallet:ip:${clientIp(req)}`, 40, 300,
    'Too many submissions from this network. Please wait a few minutes and try again.')) return;

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const churchId = await resolveChurchIdForHost(req.headers.host, supabase);
  if (!churchId) {
    return res.status(404).json({ error: 'Workshop simulation is not available on this domain' });
  }

  // church_id filter here is load-bearing: it's what stops a scraped
  // simulationId from another tenant's workshop being attached to this
  // one's wallet-activation table.
  const { data: parent, error: parentError } = await supabase
    .from('workshop_simulations')
    .select('id, display_name, projected_impact_micro_usd')
    .eq('id', body.simulationId!)
    .eq('church_id', churchId)
    .maybeSingle();

  if (parentError) {
    console.error('[workshop/wallet-activate] parent lookup failed', parentError);
    return res.status(500).json({ error: 'submission_failed' });
  }
  if (!parent) {
    return res.status(404).json({ error: 'unknown_simulation' });
  }

  const { data: row, error: upsertError } = await supabase
    .from('workshop_wallet_activations')
    .upsert(
      {
        church_id: churchId,
        simulation_id: parent.id,
        display_name: parent.display_name,
        headline_cause: causeResult.value,
        projected_monthly_impact_micro_usd: parent.projected_impact_micro_usd,
      },
      { onConflict: 'simulation_id' },
    )
    .select('id')
    .single();

  if (upsertError) {
    console.error('[workshop/wallet-activate] upsert failed', upsertError);
    return res.status(500).json({ error: 'submission_failed' });
  }

  const { count, data: sumRows, error: aggError } = await supabase
    .from('workshop_wallet_activations')
    .select('projected_monthly_impact_micro_usd', { count: 'exact' })
    .eq('church_id', churchId);

  if (aggError) {
    console.error('[workshop/wallet-activate] aggregate read failed', aggError);
  }

  const totalWalletProjectedImpactMicroUsd = (sumRows ?? []).reduce(
    (sum, r) => sum + Number(r.projected_monthly_impact_micro_usd),
    0,
  );

  return res.status(200).json({
    success: true,
    activationId: row.id,
    headlineCause: causeResult.value,
    projectedMonthlyImpactUsd: Number(parent.projected_impact_micro_usd) / 1_000_000,
    church: {
      walletActivationCount: count ?? 0,
      totalWalletProjectedImpactUsd: totalWalletProjectedImpactMicroUsd / 1_000_000,
    },
  });
}
