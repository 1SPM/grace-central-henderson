/**
 * DLQ admin endpoint (Vercel serverless).
 *
 *   GET  /api/admin/webhooks/dlq?status=unresolved&limit=50
 *        → list DLQ entries (joined with webhook_events) for review
 *   POST /api/admin/webhooks/dlq
 *        { action: 'replay', webhook_event_id: '<uuid>' }
 *        → operator-triggered replay of a single webhook event
 *
 * Auth: Bearer Clerk token, role must be 'admin' or 'staff' in the
 * JWT app_metadata.role claim. The Supabase client used here is the
 * service-role client (we want to bypass RLS to see cross-tenant
 * platform-level DLQ entries; admin = global view).
 *
 * If you ever expose this to a per-tenant admin role, scope by
 * church_id from the JWT before returning rows.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@clerk/backend';
import { replayStripeEvent } from '../../_lib/webhooks/stripe-dispatch.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const ALLOWED_ROLES = new Set(['admin', 'staff', 'platform_admin']);

interface AuthOk {
  ok: true;
  clerkUserId: string;
  role: string;
}
interface AuthFail {
  ok: false;
  status: number;
  error: string;
}
type AuthResult = AuthOk | AuthFail;

async function authorize(req: VercelRequest): Promise<AuthResult> {
  if (!CLERK_SECRET_KEY) {
    return { ok: false, status: 503, error: 'auth not configured' };
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'missing bearer token' };
  }
  const token = header.slice(7);
  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    const role = (payload as Record<string, unknown>).role as string | undefined
      ?? ((payload as Record<string, unknown>).app_metadata as Record<string, unknown> | undefined)?.role as string | undefined
      ?? '';
    if (!ALLOWED_ROLES.has(role)) {
      return { ok: false, status: 403, error: 'forbidden' };
    }
    return { ok: true, clerkUserId: payload.sub, role };
  } catch {
    return { ok: false, status: 401, error: 'invalid token' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'supabase not configured' });

  const auth = await authorize(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const status = String(req.query.status ?? 'unresolved');
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);

    let query = supabase
      .from('webhook_dlq')
      .select(`
        id, webhook_event_id, source, event_type, church_id,
        error_message, error_class, attempt_count,
        first_failed_at, last_attempt_at,
        resolved, resolved_at, resolved_by_clerk_id, resolution_note
      `)
      .order('last_attempt_at', { ascending: false })
      .limit(limit);

    if (status === 'unresolved') query = query.eq('resolved', false);
    else if (status === 'resolved') query = query.eq('resolved', true);
    // status === 'all' → no filter

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'dlq read failed', detail: error.message });
    return res.status(200).json({ entries: data ?? [], count: data?.length ?? 0 });
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { action?: string; webhook_event_id?: string };
    if (body.action !== 'replay' || !body.webhook_event_id) {
      return res.status(400).json({ error: 'invalid request', expected: '{ action: "replay", webhook_event_id: "..." }' });
    }
    if (!STRIPE_SECRET_KEY) return res.status(503).json({ error: 'stripe not configured' });
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

    try {
      const outcome = await replayStripeEvent(body.webhook_event_id, {
        supabase,
        stripe,
        resolvedByClerkId: auth.clerkUserId,
      });
      return res.status(200).json({ ok: true, outcome });
    } catch (err) {
      return res.status(500).json({
        error: 'replay failed',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
}
