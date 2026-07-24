/**
 * /api/impact/ministry-metrics
 *
 *   GET — "this year vs. all-time" ministry impact metrics (gift-in-kind
 *         value distributed, care requests handled). Metrics with no
 *         real backing table (households/individuals served) are
 *         returned as not_yet_computed rather than fabricated — see
 *         api/_lib/ministryImpactMetrics.ts.
 *
 * Auth: Clerk Bearer (or demo bootstrap), analytics.view.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { computeMinistryImpactMetrics } from '../_lib/ministryImpactMetrics.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'analytics.view');
  if (!actor) return;

  const now = new Date();
  const fiscalYearStart = `${now.getUTCFullYear()}-01-01`;

  const [distributions, careRequests] = await Promise.all([
    supabase
      .from('gift_in_kind_transactions')
      .select('category, estimated_value, occurred_at')
      .eq('church_id', actor.churchId)
      .eq('transaction_type', 'distribution'),
    supabase
      .from('care_requests')
      .select('created_at')
      .eq('church_id', actor.churchId),
  ]);
  if (distributions.error || careRequests.error) return res.status(500).json({ error: 'read_failed' });

  const metrics = computeMinistryImpactMetrics({
    fiscalYearStart,
    asOf: now.toISOString(),
    giftInKindDistributions: distributions.data ?? [],
    careRequests: careRequests.data ?? [],
  });

  return res.status(200).json({ metrics });
}
