/**
 * /api/agents/findings
 *
 *   GET   ?status=&agent_id=&stats=1   — list findings for the caller's
 *         church, newest first. ?stats=1 additionally returns per-agent
 *         precision stats computed over every finding for the church
 *         (not just the filtered list).
 *   PATCH { id, action: 'triage' | 'dismiss' | 'resolve', dismissed_reason?, suppress_days? }
 *         Dismiss sets suppress_until = now() + suppress_days (default 7).
 *   POST  { id, action: 'convert_to_work_order' }
 *         Creates a Work Order carrying the finding's title/detail/
 *         severity, sets the finding to 'actioned' and links work_order_id.
 *
 * Auth: agents.view for GET, agents.manage for PATCH/POST.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent, type PlatformEventType } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, uuid_, int_ } from '../_lib/validation.js';
import { computeAgentPrecision, type AgentFindingPrecisionRow } from '../_lib/agentPrecision.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STATUS_PATTERN = /^(open|triaged|actioned|resolved|dismissed)$/;

const PATCH_SCHEMA = {
  id: uuid_({ required: true }),
  action: str({ required: true, pattern: /^(triage|dismiss|resolve)$/ }),
  dismissed_reason: str({ max: 500 }),
  suppress_days: int_({ min: 1, max: 365 }),
};

const POST_SCHEMA = {
  id: uuid_({ required: true }),
  action: str({ required: true, pattern: /^convert_to_work_order$/ }),
};

const SEVERITY_TO_WORK_ORDER_PRIORITY: Record<string, string> = {
  critical: 'urgent',
  high: 'high',
  normal: 'medium',
  info: 'low',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const actor = await requirePermission(req, res, supabase, 'agents.view');
    if (!actor) return;

    let query = supabase
      .from('agent_findings')
      .select('*')
      .eq('church_id', actor.churchId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (typeof req.query.status === 'string' && STATUS_PATTERN.test(req.query.status)) {
      query = query.eq('status', req.query.status);
    }
    if (typeof req.query.agent_id === 'string') {
      query = query.eq('agent_id', req.query.agent_id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'read_failed' });

    const response: { findings: unknown[]; stats?: Record<string, unknown> } = { findings: data ?? [] };

    if (req.query.stats === '1') {
      const { data: allRows, error: statsError } = await supabase
        .from('agent_findings')
        .select('agent_id, status, created_at, resolved_at')
        .eq('church_id', actor.churchId)
        .limit(5000);
      if (statsError) return res.status(500).json({ error: 'read_failed' });
      response.stats = computeAgentPrecision((allRows ?? []) as AgentFindingPrecisionRow[]);
    }

    return res.status(200).json(response);
  }

  if (req.method === 'PATCH') {
    const actor = await requirePermission(req, res, supabase, 'agents.manage');
    if (!actor) return;

    const body = readBody(req, res, PATCH_SCHEMA);
    if (!body) return;

    const { data: existing, error: fetchErr } = await supabase
      .from('agent_findings')
      .select('*')
      .eq('id', body.id)
      .eq('church_id', actor.churchId)
      .maybeSingle();
    if (fetchErr) return res.status(500).json({ error: 'read_failed' });
    if (!existing) return res.status(404).json({ error: 'not_found' });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let eventType: PlatformEventType;

    if (body.action === 'triage') {
      update.status = 'triaged';
      update.triaged_by_user_id = actor.userId;
      eventType = 'agent_finding.triaged';
    } else if (body.action === 'dismiss') {
      update.status = 'dismissed';
      update.dismissed_reason = body.dismissed_reason ?? null;
      update.suppress_until = new Date(Date.now() + (body.suppress_days ?? 7) * 86_400_000).toISOString();
      eventType = 'agent_finding.dismissed';
    } else {
      update.status = 'resolved';
      update.resolved_at = new Date().toISOString();
      eventType = 'agent_finding.resolved';
    }

    const { data: updated, error } = await supabase
      .from('agent_findings')
      .update(update)
      .eq('id', body.id)
      .eq('church_id', actor.churchId)
      .select()
      .single();
    if (error || !updated) return res.status(500).json({ error: 'update_failed' });

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: actor.churchId,
      eventType,
      sourceApp: 'workos',
      actorUserId: actor.userId,
      subjectType: 'agent_finding',
      subjectId: body.id,
      payload: { action: body.action },
    });
    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: body.action,
      entityType: 'agent_finding',
      entityId: body.id,
      before: existing,
      after: updated,
      correlationId,
      route: '/api/agents/findings',
      method: 'PATCH',
    });

    return res.status(200).json({ finding: updated });
  }

  if (req.method === 'POST') {
    const actor = await requirePermission(req, res, supabase, 'agents.manage');
    if (!actor) return;

    const body = readBody(req, res, POST_SCHEMA);
    if (!body) return;

    const { data: existing, error: fetchErr } = await supabase
      .from('agent_findings')
      .select('*')
      .eq('id', body.id)
      .eq('church_id', actor.churchId)
      .maybeSingle();
    if (fetchErr) return res.status(500).json({ error: 'read_failed' });
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (existing.status === 'resolved' || existing.status === 'dismissed') {
      return res.status(409).json({ error: 'finding_not_actionable', status: existing.status });
    }

    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .insert({
        church_id: actor.churchId,
        title: existing.title,
        description: existing.detail ?? null,
        priority: SEVERITY_TO_WORK_ORDER_PRIORITY[existing.severity] ?? 'medium',
        owner_user_id: actor.userId,
        requested_by_user_id: actor.userId,
      })
      .select()
      .single();
    if (woError || !workOrder) return res.status(500).json({ error: 'work_order_create_failed' });

    const { data: updated, error } = await supabase
      .from('agent_findings')
      .update({ status: 'actioned', work_order_id: workOrder.id, updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .eq('church_id', actor.churchId)
      .select()
      .single();
    if (error || !updated) return res.status(500).json({ error: 'update_failed' });

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: actor.churchId,
      eventType: 'agent_finding.converted',
      sourceApp: 'workos',
      actorUserId: actor.userId,
      subjectType: 'agent_finding',
      subjectId: body.id,
      payload: { work_order_id: workOrder.id },
    });
    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'convert_to_work_order',
      entityType: 'agent_finding',
      entityId: body.id,
      before: existing,
      after: updated,
      correlationId,
      route: '/api/agents/findings',
      method: 'POST',
    });

    return res.status(200).json({ finding: updated, work_order: workOrder });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
