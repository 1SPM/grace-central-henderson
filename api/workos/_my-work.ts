/**
 * GET  /api/workos/my-work — "what's on my plate": Work Orders and
 *      ministry areas *I* own, paired with whatever agent supports each
 *      and that agent's latest run — the Action Center's answer to
 *      "what is GRACE doing on my behalf, and how is it going."
 * POST /api/workos/my-work — "I need to step in": the owner of a Work
 *      Order or ministry area flags the paired agent's activity for the
 *      pastor's attention. Writes into agent_findings, so it appears in
 *      the pastor's existing Decision Queue with no separate surface to
 *      build — the same "everything awaiting a human decision" list
 *      Overview already shows, just with a human-raised item in it.
 *
 * Auth: resolveStaffActor only — deliberately NOT gated on
 * work_orders.view/agents.view (pastor-only since migration 068). This
 * is inherently self-scoped: you can only ever see or flag what you
 * yourself own, which needs no broad permission grant at all.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveStaffActor } from '../_lib/authz.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';
import { getArea, staffDisplayName } from '../_lib/ministryAreas.js';
import { getAgentDefinition } from '../_lib/agentRegistry.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OPEN_WORK_ORDER_STATUSES = ['draft', 'planning', 'awaiting_approval', 'in_progress', 'blocked', 'under_review'];

interface AgentActivity {
  agent_key: string;
  agent_name: string;
  status: string;
  finished_at: string | null;
  summary: string | null;
  error: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') return getMyWork(req, res, supabase);
  if (req.method === 'POST') return postFlag(req, res, supabase);
  return res.status(405).json({ error: 'method_not_allowed' });
}

function toAgentActivity(run: {
  agent_key: string; status: string; finished_at: string | null; started_at: string | null;
  output: { summary?: string } | null; error: string | null;
} | undefined): AgentActivity | null {
  if (!run) return null;
  const def = getAgentDefinition(run.agent_key);
  return {
    agent_key: run.agent_key,
    agent_name: def?.name ?? run.agent_key,
    status: run.status,
    finished_at: run.finished_at ?? run.started_at,
    summary: run.output?.summary ?? null,
    error: run.error,
  };
}

async function getMyWork(
  req: VercelRequest,
  res: VercelResponse,
  supabase: ReturnType<typeof createClient>,
) {
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return;

  const [{ data: workOrders }, { data: assignments }, { data: runs }] = await Promise.all([
    supabase
      .from('work_orders')
      .select('id, title, status, priority, ministry, due_date')
      .eq('church_id', actor.churchId)
      .eq('owner_user_id', actor.userId)
      .in('status', OPEN_WORK_ORDER_STATUSES)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('ministry_assignments')
      .select('area_key, agent_key')
      .eq('church_id', actor.churchId)
      .eq('owner_user_id', actor.userId),
    // One church-wide pull of recent runs, filtered client-side per item —
    // avoids N+1 queries for a handful of owned items.
    supabase
      .from('agent_runs')
      .select('agent_key, status, started_at, finished_at, output, error, work_order_id')
      .eq('church_id', actor.churchId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const runsList = (runs ?? []) as unknown as {
    agent_key: string; status: string; started_at: string | null; finished_at: string | null;
    output: { summary?: string } | null; error: string | null; work_order_id: string | null;
  }[];
  const latestByWorkOrder = new Map<string, (typeof runsList)[number]>();
  const latestByAgentKey = new Map<string, (typeof runsList)[number]>();
  for (const run of runsList) {
    if (run.work_order_id && !latestByWorkOrder.has(run.work_order_id)) latestByWorkOrder.set(run.work_order_id, run);
    if (!latestByAgentKey.has(run.agent_key)) latestByAgentKey.set(run.agent_key, run);
  }

  const myWorkOrders = ((workOrders ?? []) as unknown as {
    id: string; title: string; status: string; priority: string; ministry: string | null; due_date: string | null;
  }[]).map(wo => ({
    id: wo.id,
    title: wo.title,
    status: wo.status,
    priority: wo.priority,
    ministry: wo.ministry,
    due_date: wo.due_date,
    agent_activity: toAgentActivity(latestByWorkOrder.get(wo.id)),
  }));

  const myAreas = ((assignments ?? []) as unknown as { area_key: string; agent_key: string | null }[])
    .map(row => {
      const area = getArea(row.area_key);
      if (!area) return null;
      return {
        area_key: area.key,
        area_name: area.name,
        agent_activity: row.agent_key ? toAgentActivity(latestByAgentKey.get(row.agent_key)) : null,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  return res.status(200).json({ work_orders: myWorkOrders, areas: myAreas });
}

async function postFlag(
  req: VercelRequest,
  res: VercelResponse,
  supabase: ReturnType<typeof createClient>,
) {
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return;

  const body = readBody(req, res, {
    subject_type: str({ required: true, max: 30 }),
    subject_id: uuid_(),
    area_key: str({ max: 50 }),
    note: str({ max: 2000, required: true }),
  });
  if (!body) return;

  let agentKey: string | null = null;
  let subjectId: string;

  if (body.subject_type === 'work_order') {
    if (!body.subject_id) return res.status(400).json({ error: 'subject_id is required for a work_order flag' });
    const { data: wo } = await supabase
      .from('work_orders')
      .select('id, owner_user_id')
      .eq('id', body.subject_id)
      .eq('church_id', actor.churchId)
      .maybeSingle();
    if (!wo || wo.owner_user_id !== actor.userId) {
      return res.status(403).json({ error: 'not_your_work_order' });
    }
    const { data: run } = await supabase
      .from('agent_runs')
      .select('agent_key')
      .eq('work_order_id', body.subject_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    agentKey = run?.agent_key ?? null;
    subjectId = wo.id;
  } else if (body.subject_type === 'ministry_area') {
    if (!body.area_key) return res.status(400).json({ error: 'area_key is required for a ministry_area flag' });
    const area = getArea(body.area_key);
    if (!area) return res.status(400).json({ error: 'unknown_area_key' });
    const { data: assignment } = await supabase
      .from('ministry_assignments')
      .select('owner_user_id, agent_key')
      .eq('church_id', actor.churchId)
      .eq('area_key', body.area_key)
      .maybeSingle();
    if (!assignment || assignment.owner_user_id !== actor.userId) {
      return res.status(403).json({ error: 'not_your_ministry_area' });
    }
    agentKey = assignment.agent_key ?? area.defaultAgentKey;
    subjectId = body.area_key;
  } else {
    return res.status(400).json({ error: 'invalid_subject_type' });
  }

  if (!agentKey) {
    return res.status(400).json({ error: 'no_agent_assigned', detail: 'Nothing here is agent-supported yet — there is nothing to flag.' });
  }

  const agentDef = getAgentDefinition(agentKey);
  const { data: userRow } = await supabase
    .from('users')
    .select('first_name, last_name')
    .eq('id', actor.userId)
    .maybeSingle();
  const staffName = staffDisplayName({ id: actor.userId, first_name: userRow?.first_name ?? null, last_name: userRow?.last_name ?? null });

  const { error } = await supabase.from('agent_findings').insert({
    church_id: actor.churchId,
    agent_id: agentKey,
    source: 'staff_flag',
    dedup_key: `staff-flag-${body.subject_type}-${subjectId}-${Date.now()}`,
    title: `${staffName} flagged ${agentDef?.name ?? agentKey}'s work for review`,
    detail: body.note,
    severity: 'normal',
    status: 'open',
    subject_type: body.subject_type,
    subject_id: subjectId,
    payload: { raised_by_user_id: actor.userId, note: body.note },
  });

  if (error) {
    console.error('[workos/my-work] flag insert failed', error);
    return res.status(500).json({ error: 'flag_failed' });
  }

  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    action: 'agent_activity_flagged',
    entityType: body.subject_type,
    entityId: subjectId,
    after: { agent_key: agentKey, note: body.note },
  });

  return res.status(201).json({ ok: true });
}
