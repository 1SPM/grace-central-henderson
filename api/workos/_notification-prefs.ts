/**
 * /api/workos/notification-prefs
 *
 *   GET — the caller's own staff_notification_prefs rows. Lazily seeds
 *         one default row (crisis / email / enabled) on first GET for
 *         any actor holding care.view — crisis alerts should reach care
 *         staff by default, not require an opt-in click first. No other
 *         defaults are invented; every other category/channel combo is
 *         simply absent until the caller sets it via PUT, and the
 *         frontend treats an absent row as disabled.
 *   PUT  — upsert a batch of { category, channel, enabled } prefs.
 *          Self-scoped: user_id/church_id always come from the resolved
 *          actor, never the request body — there is no way for a caller
 *          to write another user's preferences through this route.
 *
 * Auth: any active staff actor (no specific permission — these are the
 * caller's own preferences, same posture as workos/permissions).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveStaffActor } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { isValidPhone } from '../_lib/sms/send.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CATEGORIES = new Set(['crisis', 'approvals', 'finance', 'agents', 'digest']);
const CHANNELS = new Set(['email', 'sms']);

interface PrefRow {
  category: string;
  channel: string;
  enabled: boolean;
}

function isValidPrefsArray(value: unknown): value is PrefRow[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return false;
  return value.every(
    p =>
      p && typeof p === 'object' &&
      CATEGORIES.has((p as PrefRow).category) &&
      CHANNELS.has((p as PrefRow).channel) &&
      typeof (p as PrefRow).enabled === 'boolean',
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return;

  if (req.method === 'GET') {
    const { data: userRow } = await supabase.from('users').select('phone').eq('id', actor.userId).maybeSingle();
    const phone = (userRow as { phone?: string | null } | null)?.phone ?? null;

    const { data: existing, error } = await supabase
      .from('staff_notification_prefs')
      .select('category, channel, enabled')
      .eq('user_id', actor.userId);
    if (error) return res.status(500).json({ error: 'read_failed' });

    if ((existing ?? []).length === 0 && actor.permissions.has('care.view')) {
      await supabase.from('staff_notification_prefs').insert({
        church_id: actor.churchId,
        user_id: actor.userId,
        category: 'crisis',
        channel: 'email',
        enabled: true,
      });
      const { data: seeded } = await supabase
        .from('staff_notification_prefs')
        .select('category, channel, enabled')
        .eq('user_id', actor.userId);
      return res.status(200).json({ prefs: seeded ?? [], phone });
    }

    return res.status(200).json({ prefs: existing ?? [], phone });
  }

  if (req.method === 'PUT') {
    const body = req.body as { prefs?: unknown; phone?: unknown } | undefined;
    const prefs = body?.prefs;
    if (!isValidPrefsArray(prefs)) {
      return res.status(400).json({ error: 'invalid_request', detail: 'prefs must be a non-empty array of { category, channel, enabled }' });
    }
    if (body?.phone !== undefined && body.phone !== null) {
      if (typeof body.phone !== 'string' || !isValidPhone(body.phone)) {
        return res.status(400).json({ error: 'invalid_request', detail: 'phone must be a valid phone number' });
      }
      await supabase.from('users').update({ phone: body.phone }).eq('id', actor.userId);
    }

    const rows = prefs.map(p => ({
      church_id: actor.churchId,
      user_id: actor.userId,
      category: p.category,
      channel: p.channel,
      enabled: p.enabled,
      updated_at: new Date().toISOString(),
    }));
    const { data: saved, error } = await supabase
      .from('staff_notification_prefs')
      .upsert(rows, { onConflict: 'user_id,category,channel' })
      .select('category, channel, enabled');
    if (error) return res.status(500).json({ error: 'write_failed' });

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: actor.churchId,
      eventType: 'workos.notification_prefs_updated',
      sourceApp: 'admin_dashboard',
      actorUserId: actor.userId,
      subjectType: 'user',
      subjectId: actor.userId,
      payload: { updated_count: prefs.length },
    });
    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'update',
      entityType: 'staff_notification_prefs',
      entityId: actor.userId,
      after: { prefs },
      correlationId,
      route: '/api/workos/notification-prefs',
      method: 'PUT',
    });

    return res.status(200).json({ prefs: saved ?? [] });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
