/**
 * POST /api/portal/volunteer
 *
 * Express volunteer interest. Writes a real volunteer_interests row,
 * emits volunteer.interest.submitted, and creates a real staff task —
 * the exact flow named in the WorkOS spec:
 *   Volunteer interest submitted → platform event → staff task created
 *   → authorized coordinator receives assignment → member sees status.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { createPortalRequestTask } from '../_lib/portalRequestTask.js';
import { readBody, str } from '../_lib/validation.js';
import { VOLUNTEER_OPPORTUNITIES } from '../_lib/volunteerOpportunities.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AREA_KEYS = VOLUNTEER_OPPORTUNITIES.map(o => o.key);

const SCHEMA = {
  area: str({ required: true, pattern: new RegExp(`^(${AREA_KEYS.join('|')}|other)$`) }),
  message: str({ max: 1000 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  const areaLabel = VOLUNTEER_OPPORTUNITIES.find(o => o.key === body.area)?.title ?? 'General';

  const { data: interest, error } = await supabase
    .from('volunteer_interests')
    .insert({
      church_id: member.churchId,
      person_id: member.personId,
      area: areaLabel,
      message: body.message ?? null,
    })
    .select()
    .single();
  if (error || !interest) return res.status(500).json({ error: 'create_failed' });

  const { correlationId } = await emitPlatformEvent(supabase, {
    churchId: member.churchId,
    eventType: 'volunteer.interest.submitted',
    sourceApp: 'member_portal',
    actorPersonId: member.personId,
    subjectType: 'volunteer_interest',
    subjectId: interest.id,
    payload: { area: areaLabel },
  });
  const { taskId } = await createPortalRequestTask(supabase, {
    churchId: member.churchId,
    personId: member.personId,
    requestType: 'volunteer_interest',
    title: `Volunteer interest: ${areaLabel}`,
    description: body.message ?? `A member expressed interest in volunteering with ${areaLabel}.`,
  });

  return res.status(201).json({ interest, correlation_id: correlationId, task_id: taskId });
}
