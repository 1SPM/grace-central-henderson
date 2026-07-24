/**
 * /api/finance/gift-in-kind
 *
 *   GET  — list transactions (most recent first) plus a running balance
 *          per category (sum of contributions minus distributions).
 *   POST — record one contribution or distribution transaction.
 *
 * Auth: Clerk Bearer (or demo bootstrap), finance.gift_in_kind.view /
 * finance.gift_in_kind.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, num_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CATEGORIES = ['food', 'clothing', 'toys', 'household', 'other'];
const TRANSACTION_TYPES = ['contribution', 'distribution'];

const CREATE_SCHEMA = {
  category: str({ required: true, pattern: new RegExp(`^(${CATEGORIES.join('|')})$`) }),
  transaction_type: str({ required: true, pattern: new RegExp(`^(${TRANSACTION_TYPES.join('|')})$`) }),
  description: str({ max: 500 }),
  quantity: num_({ min: 0 }),
  quantity_unit: str({ max: 40 }),
  estimated_value: num_({ min: 0 }),
  occurred_at: str({ pattern: /^\d{4}-\d{2}-\d{2}$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const actor = await requirePermission(req, res, supabase, 'finance.gift_in_kind.view');
    if (!actor) return;

    const { data, error } = await supabase
      .from('gift_in_kind_transactions')
      .select('id, category, transaction_type, description, quantity, quantity_unit, estimated_value, occurred_at, created_at')
      .eq('church_id', actor.churchId)
      .order('occurred_at', { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: 'read_failed' });

    const balances: Record<string, number> = {};
    for (const category of CATEGORIES) balances[category] = 0;
    for (const row of data ?? []) {
      const delta = row.transaction_type === 'contribution' ? (row.estimated_value ?? 0) : -(row.estimated_value ?? 0);
      balances[row.category] = (balances[row.category] ?? 0) + delta;
    }

    return res.status(200).json({ transactions: data ?? [], balances_by_category: balances });
  }

  if (req.method === 'POST') {
    const actor = await requirePermission(req, res, supabase, 'finance.gift_in_kind.manage');
    if (!actor) return;

    const body = readBody(req, res, CREATE_SCHEMA);
    if (!body) return;

    const { data: transaction, error } = await supabase
      .from('gift_in_kind_transactions')
      .insert({
        church_id: actor.churchId,
        category: body.category,
        transaction_type: body.transaction_type,
        description: body.description ?? null,
        quantity: body.quantity ?? null,
        quantity_unit: body.quantity_unit ?? null,
        estimated_value: body.estimated_value ?? null,
        occurred_at: body.occurred_at ?? new Date().toISOString().slice(0, 10),
        recorded_by_user_id: actor.userId,
      })
      .select()
      .single();
    if (error || !transaction) return res.status(500).json({ error: 'create_failed' });

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: actor.churchId,
      eventType: 'finance.gift_in_kind.recorded',
      sourceApp: 'admin_dashboard',
      actorUserId: actor.userId,
      subjectType: 'gift_in_kind_transaction',
      subjectId: transaction.id,
      payload: { category: transaction.category, transaction_type: transaction.transaction_type },
    });
    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'create',
      entityType: 'gift_in_kind_transaction',
      entityId: transaction.id,
      after: transaction,
      correlationId,
      route: '/api/finance/gift-in-kind',
      method: 'POST',
    });

    return res.status(201).json({ transaction });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
