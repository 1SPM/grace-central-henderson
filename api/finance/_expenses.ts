/**
 * /api/finance/expenses
 *
 *   GET  — list expenses (most recent first) plus the program/G&A
 *          expense ratio computed from all recorded rows.
 *   POST — record one expense.
 *
 * Auth: Clerk Bearer (or demo bootstrap), finance.expenses.view /
 * finance.expenses.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, num_ } from '../_lib/validation.js';
import { computeExpenseRatio } from '../_lib/financeMetrics.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FUNCTIONAL_CATEGORIES = ['program', 'g_and_a'];

const CREATE_SCHEMA = {
  functional_category: str({ required: true, pattern: new RegExp(`^(${FUNCTIONAL_CATEGORIES.join('|')})$`) }),
  category: str({ required: true, max: 100 }),
  amount: num_({ required: true, min: 0.01 }),
  fund: str({ max: 100 }),
  expense_date: str({ pattern: /^\d{4}-\d{2}-\d{2}$/ }),
  description: str({ max: 500 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const actor = await requirePermission(req, res, supabase, 'finance.expenses.view');
    if (!actor) return;

    const { data, error } = await supabase
      .from('expenses')
      .select('id, functional_category, category, amount, fund, expense_date, description, created_at')
      .eq('church_id', actor.churchId)
      .order('expense_date', { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: 'read_failed' });

    const ratio = computeExpenseRatio((data ?? []).map(r => ({ functional_category: r.functional_category, amount: r.amount })));

    return res.status(200).json({ expenses: data ?? [], ratio });
  }

  if (req.method === 'POST') {
    const actor = await requirePermission(req, res, supabase, 'finance.expenses.manage');
    if (!actor) return;

    const body = readBody(req, res, CREATE_SCHEMA);
    if (!body) return;

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        church_id: actor.churchId,
        functional_category: body.functional_category,
        category: body.category,
        amount: body.amount,
        fund: body.fund ?? null,
        expense_date: body.expense_date ?? new Date().toISOString().slice(0, 10),
        description: body.description ?? null,
        recorded_by_user_id: actor.userId,
      })
      .select()
      .single();
    if (error || !expense) return res.status(500).json({ error: 'create_failed' });

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: actor.churchId,
      eventType: 'finance.expense.recorded',
      sourceApp: 'admin_dashboard',
      actorUserId: actor.userId,
      subjectType: 'expense',
      subjectId: expense.id,
      payload: { functional_category: expense.functional_category, amount: expense.amount },
    });
    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'create',
      entityType: 'expense',
      entityId: expense.id,
      after: expense,
      correlationId,
      route: '/api/finance/expenses',
      method: 'POST',
    });

    return res.status(201).json({ expense });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
