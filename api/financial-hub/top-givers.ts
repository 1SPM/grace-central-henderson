/**
 * GET /api/financial-hub/top-givers?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=10
 *
 * Top givers leaderboard. Separate endpoint from summary because:
 *   - Returns PII (names + emails) requiring role gate
 *   - Allows different cache headers down the road
 *
 * Auth: Clerk Bearer, role ∈ {admin, staff, financial_secretary,
 * pastor, treasurer}. Volunteer-level roles do NOT see this list
 * (matches the existing GivingDashboard permission model).
 *
 * Joins ledger_entries → people for display names. RLS on people is
 * scoped to own church; the service-role client bypasses it which is
 * intentional here (the auth check already proves church membership).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';
import { requirePlanGate } from '../_lib/billing/gates.js';
import { topGivers, type LedgerRow } from '../_lib/financial-hub/aggregations.js';
import { microUsdToUsd } from '../_lib/ai/pricing.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PRIVILEGED_ROLES = ['admin', 'staff', 'financial_secretary', 'pastor', 'treasurer'];
const MAX_LIMIT = 100;

interface PersonRow {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

function displayName(p: PersonRow | undefined): string {
  if (!p) return 'Unknown';
  if (p.full_name && p.full_name.trim()) return p.full_name.trim();
  const parts = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return parts || p.email || 'Unknown';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'supabase not configured' });

  const auth = await requireClerkAuth(req, { allowedRoles: PRIVILEGED_ROLES });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const gate = await requirePlanGate(auth.churchId, 'financialHub', supabase);
  if (!gate.ok) {
    return res.status(gate.status).json({
      error: gate.error,
      detail: gate.detail,
      required_gate: gate.required_gate,
      required_plan: gate.required_plan,
      current_plan: gate.current_plan,
      current_status: gate.current_status,
    });
  }

  const from = String(req.query.from ?? '').trim();
  const to = String(req.query.to ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: 'from + to required as YYYY-MM-DD' });
  }
  const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), MAX_LIMIT);

  // Pull credit donations only — keep the payload smaller than full summary.
  const { data: ledger, error: ledgerErr } = await supabase
    .from('ledger_entries')
    .select('amount_micro_usd, occurred_at, related_person_id, direction, kind, source, metadata, church_id')
    .eq('church_id', auth.churchId)
    .eq('direction', 'credit')
    .eq('kind', 'donation')
    .gte('occurred_at', `${from}T00:00:00.000Z`)
    .lte('occurred_at', `${to}T23:59:59.999Z`)
    .not('related_person_id', 'is', null);

  if (ledgerErr) {
    console.error('[financial-hub/top-givers]', ledgerErr);
    return res.status(500).json({ error: 'ledger read failed' });
  }

  const givers = topGivers((ledger as unknown as LedgerRow[]) ?? [], limit);
  if (givers.length === 0) {
    return res.status(200).json({ givers: [], count: 0 });
  }

  // Join to people for display.
  const personIds = givers.map((g) => g.personId);
  const { data: people, error: peopleErr } = await supabase
    .from('people')
    .select('id, full_name, first_name, last_name, email')
    .in('id', personIds)
    .eq('church_id', auth.churchId);

  if (peopleErr) {
    console.error('[financial-hub/top-givers] people read failed', peopleErr);
    return res.status(500).json({ error: 'people read failed' });
  }

  const peopleById = new Map<string, PersonRow>(
    ((people as unknown as PersonRow[]) ?? []).map((p) => [p.id, p]),
  );

  return res.status(200).json({
    givers: givers.map((g) => ({
      personId: g.personId,
      displayName: displayName(peopleById.get(g.personId)),
      totalMicroUsd: g.totalMicroUsd,
      totalUsd: microUsdToUsd(g.totalMicroUsd),
      giftCount: g.giftCount,
      firstGiftAt: g.firstGiftAt,
      lastGiftAt: g.lastGiftAt,
    })),
    count: givers.length,
    range: { from, to },
  });
}
