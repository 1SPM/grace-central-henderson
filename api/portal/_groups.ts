/**
 * /api/portal/groups
 *
 *   GET  — discover active groups + the member's own membership status
 *          per group (none / pending / active).
 *   POST { group_id } — request to join. Creates a `pending`
 *          group_memberships row, emits group.join.requested, and
 *          creates a real staff task (Member Portal Requests Work
 *          Order) so a coordinator actually sees it.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { createPortalRequestTask } from '../_lib/portalRequestTask.js';
import { readBody, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const JOIN_SCHEMA = {
  group_id: uuid_({ required: true }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  if (req.method === 'GET') {
    const [{ data: groups, error }, { data: myMemberships }] = await Promise.all([
      supabase.from('small_groups').select('id, name, description, meeting_day, meeting_time, location').eq('church_id', member.churchId).eq('is_active', true).order('name'),
      supabase.from('group_memberships').select('group_id, status').eq('person_id', member.personId),
    ]);
    if (error) return res.status(500).json({ error: 'read_failed' });

    const statusByGroup = new Map((myMemberships ?? []).map(m => [m.group_id, m.status]));
    const withStatus = (groups ?? []).map(g => ({ ...g, my_status: statusByGroup.get(g.id) ?? null }));

    return res.status(200).json({ groups: withStatus });
  }

  if (req.method === 'POST') {
    const body = readBody(req, res, JOIN_SCHEMA);
    if (!body) return;

    const { data: group } = await supabase
      .from('small_groups')
      .select('id, name')
      .eq('id', body.group_id)
      .eq('church_id', member.churchId)
      .eq('is_active', true)
      .maybeSingle();
    if (!group) return res.status(404).json({ error: 'group_not_found' });

    const { data: existing } = await supabase
      .from('group_memberships')
      .select('id, status')
      .eq('group_id', body.group_id)
      .eq('person_id', member.personId)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'already_requested_or_member', status: existing.status });
    }

    const { data: membership, error } = await supabase
      .from('group_memberships')
      .insert({ group_id: body.group_id, person_id: member.personId, status: 'pending' })
      .select()
      .single();
    if (error || !membership) return res.status(500).json({ error: 'request_failed' });

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: member.churchId,
      eventType: 'group.join.requested',
      sourceApp: 'member_portal',
      actorPersonId: member.personId,
      subjectType: 'group',
      subjectId: body.group_id,
      payload: { group_name: group.name },
    });
    const { taskId } = await createPortalRequestTask(supabase, {
      churchId: member.churchId,
      personId: member.personId,
      requestType: 'group_join',
      title: `Group join request: ${group.name}`,
      description: `A member requested to join "${group.name}." Approve or decline in Groups.`,
    });

    return res.status(201).json({ membership, correlation_id: correlationId, task_id: taskId });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
