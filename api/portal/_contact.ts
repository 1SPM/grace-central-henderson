/**
 * POST /api/portal/contact
 *
 * "Contact the church" — a general (non-crisis, non-pastoral-care)
 * inquiry. Deliberately separate from care/crisis routing, which is out
 * of scope for this phase (see the Members Portal assessment) — this is
 * for ordinary questions ("what time is the Christmas service?",
 * "how do I update my giving statement address?").
 *
 * Creates a real staff task (same Member Portal Requests Work Order
 * pattern as group-join/volunteer) and emits contact.request.submitted.
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { createPortalRequestTask } from '../_lib/portalRequestTask.js';
import { readBody, str } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEMA = {
  subject: str({ required: true, min: 1, max: 150 }),
  message: str({ required: true, min: 1, max: 2000 }),
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

  const { correlationId } = await emitPlatformEvent(supabase, {
    churchId: member.churchId,
    eventType: 'contact.request.submitted',
    sourceApp: 'member_portal',
    actorPersonId: member.personId,
    subjectType: 'contact_request',
    subjectId: null,
    payload: { subject: body.subject },
  });
  const { taskId } = await createPortalRequestTask(supabase, {
    churchId: member.churchId,
    personId: member.personId,
    requestType: 'contact_church',
    title: `Contact: ${body.subject}`,
    description: body.message,
  });

  return res.status(201).json({ correlation_id: correlationId, task_id: taskId });
}
