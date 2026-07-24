/**
 * /api/tenant/hosts
 *
 *   GET  — the caller's church's custom-domain list (Settings → Custom
 *          domains card).
 *   PUT  { hosts: string[] } — replaces the list.
 *
 * This governs branding lookups only (api/tenant/_config.ts) — never
 * auth or data-tenancy resolution (see that file's header comment).
 * Adding a hostname here does not, by itself, make the domain reach
 * this app — it still needs to be attached to the Vercel project (a
 * manual dashboard step); the UI carries an explicit note about that.
 *
 * Auth: portal.provision_member (Provisioning Studio access).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, arrayOfStr } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PUT_SCHEMA = {
  hosts: arrayOfStr({ maxLength: 10, maxItem: 255 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'portal.provision_member');
  if (!actor) return;

  if (req.method === 'GET') {
    const { data: church, error } = await supabase
      .from('churches')
      .select('hosts')
      .eq('id', actor.churchId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'read_failed' });
    return res.status(200).json({ hosts: (church?.hosts as string[] | null) ?? [] });
  }

  if (req.method === 'PUT') {
    const body = readBody(req, res, PUT_SCHEMA);
    if (!body) return;

    const hosts = (body.hosts ?? []).map(h => h.toLowerCase());
    const HOSTNAME_SHAPE = /^[a-z0-9.-]+$/;
    if (hosts.some(h => !HOSTNAME_SHAPE.test(h))) {
      return res.status(400).json({ error: 'invalid_host_shape' });
    }

    if (hosts.length > 0) {
      // Advisory only — two concurrent PUTs from different churches
      // could still race between this check and the update below.
      // Acceptable: the loser just needs to retry after the 409.
      const { data: conflicts } = await supabase
        .from('churches')
        .select('id, hosts')
        .neq('id', actor.churchId)
        .overlaps('hosts', hosts);
      if (conflicts && conflicts.length > 0) {
        return res.status(409).json({ error: 'host_already_claimed' });
      }
    }

    const { data: existing } = await supabase
      .from('churches')
      .select('hosts')
      .eq('id', actor.churchId)
      .maybeSingle();

    const { data: updated, error } = await supabase
      .from('churches')
      .update({ hosts })
      .eq('id', actor.churchId)
      .select('hosts')
      .single();
    if (error || !updated) return res.status(500).json({ error: 'update_failed' });

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: actor.churchId,
      eventType: 'tenant.hosts_updated',
      sourceApp: 'admin_dashboard',
      actorUserId: actor.userId,
      subjectType: 'church',
      subjectId: actor.churchId,
      payload: { hosts },
    });
    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'update',
      entityType: 'church',
      entityId: actor.churchId,
      before: { hosts: existing?.hosts ?? [] },
      after: { hosts },
      correlationId,
      route: '/api/tenant/hosts',
      method: 'PUT',
    });

    return res.status(200).json({ hosts: updated.hosts ?? [] });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
