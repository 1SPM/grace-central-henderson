/**
 * POST /api/people/provision-portal
 *
 * Body: { person_id: string, mode: 'invite' | 'direct' }
 *
 *   invite — the normal round trip: mint a member_invitations row +
 *            Clerk invitation email; the member accepts it themselves
 *            (delegates to api/_lib/memberInvite.ts, the same core
 *            api/members/_invite.ts uses).
 *   direct — server-side replica of scripts/provision-portal-member.ts:
 *            create (or converge) a Clerk user with no password, bind
 *            people.clerk_user_id + portal_enabled, and record an
 *            already-accepted member_invitations row. The account
 *            holder signs in themselves via "forgot password" / email
 *            code — no one ever types or transmits a password for them.
 *
 * Auth: portal.provision_member.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';
import { requirePermission } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';
import { inviteSinglePerson } from '../_lib/memberInvite.js';
import { provisionPortalMemberDirect } from '../_lib/portalProvisioning.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const APP_URL = process.env.FRONTEND_URL || process.env.VERCEL_URL
  ? (process.env.FRONTEND_URL || `https://${process.env.VERCEL_URL}`)
  : 'http://localhost:3000';

const SCHEMA = {
  person_id: uuid_({ required: true }),
  mode: str({ required: true, pattern: /^(invite|direct)$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'portal.provision_member');
  if (!actor) return;

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  const { data: person, error: personErr } = await supabase
    .from('people')
    .select('id, first_name, last_name, email, clerk_user_id')
    .eq('id', body.person_id)
    .eq('church_id', actor.churchId)
    .maybeSingle();
  if (personErr) return res.status(500).json({ error: 'person_read_failed' });
  if (!person) return res.status(404).json({ error: 'not_found' });
  if (person.clerk_user_id) return res.status(409).json({ error: 'already_linked' });
  if (!person.email) return res.status(400).json({ error: 'email_required' });

  let email: string;
  let clerkUserId: string | null = null;
  let clerkUserCreated = false;

  if (body.mode === 'invite') {
    const clerk = CLERK_SECRET_KEY ? createClerkClient({ secretKey: CLERK_SECRET_KEY }) : null;
    const { data: inviter } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', actor.clerkUserId)
      .maybeSingle();

    const result = await inviteSinglePerson({
      supabase,
      clerk,
      churchId: actor.churchId,
      person,
      inviterUserId: inviter?.id ?? null,
      appUrl: APP_URL,
    });
    if (result.status === 'skipped') return res.status(409).json({ error: result.reason });
    if (result.status === 'error') return res.status(500).json({ error: result.error });
    email = person.email;
  } else {
    if (!CLERK_SECRET_KEY) return res.status(503).json({ error: 'clerk_not_configured' });
    const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
    const result = await provisionPortalMemberDirect(supabase, clerk, actor.churchId, {
      id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      email: person.email,
    });
    email = result.email;
    clerkUserId = result.clerkUserId;
    clerkUserCreated = result.clerkUserCreated;
  }

  const { correlationId } = await emitPlatformEvent(supabase, {
    churchId: actor.churchId,
    eventType: 'portal.member_provisioned',
    sourceApp: 'admin_dashboard',
    actorUserId: actor.userId,
    subjectType: 'person',
    subjectId: person.id,
    payload: { mode: body.mode, email },
  });
  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'provision_portal_account',
    entityType: 'person',
    entityId: person.id,
    after: { mode: body.mode, email, clerk_user_id: clerkUserId },
    correlationId,
    route: '/api/people/provision-portal',
    method: 'POST',
  });

  return res.status(200).json({ mode: body.mode, email, clerk_user_created: clerkUserCreated });
}
