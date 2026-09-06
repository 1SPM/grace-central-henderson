/**
 * POST /api/portal/self-signup
 *
 * Completes a member's own Clerk sign-up into a usable Member Portal
 * identity — no staff action required. Called by the frontend right
 * after Clerk's own sign-up widget succeeds (see PortalAuthContext.tsx),
 * BEFORE the caller's session has a usable church_id claim: setting that
 * claim (via Clerk publicMetadata) is the whole point of this route, so
 * it authenticates with verifyClerkSessionOnly rather than
 * requireClerkAuth, which would demand the very claim we're about to
 * create.
 *
 * Church comes from the request's Host header (resolveChurchIdForHost),
 * the same trust boundary the public /connect intake form uses — never
 * from the client body.
 *
 * Matching: looks for an existing, unclaimed `people` row in that church
 * by email first (a visitor who already filled out a connect card, or
 * someone staff already entered) and attaches to it rather than
 * creating a duplicate. Either way the result is self_registered=true,
 * staff_reviewed_at=null — even an existing record's giving/care/impact
 * history stays hidden (MemberActor.identityVerified=false, see
 * authz.ts's requireVerifiedIdentity) until a staff member confirms the
 * account is who it claims to be. Everything else (events, groups,
 * church info, Ask GRACE) is usable immediately — see migration 078.
 *
 * Idempotent: calling again for an already-linked Clerk user is a cheap
 * no-op success, so the frontend can call this unconditionally whenever
 * it can't find a church_id claim, rather than tracking whether signup
 * already ran.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';
import { verifyClerkSessionOnly } from '../_lib/auth-helper.js';
import { resolveChurchIdForHost } from '../_lib/resolveChurchByHost.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { clientIp, enforceRateLimit } from '../_lib/rateLimit/limiter.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !CLERK_SECRET_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const auth = await verifyClerkSessionOnly(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  // Public-reachable the instant someone finishes Clerk sign-up — throttle
  // both per-account and per-IP, same posture as the /connect intake form.
  if (await enforceRateLimit(res, `portal:self-signup:${auth.clerkUserId}`, 5, 300,
    'Too many attempts. Please wait a few minutes and try again.')) return;
  if (await enforceRateLimit(res, `portal:self-signup:ip:${clientIp(req)}`, 15, 300,
    'Too many attempts from this network. Please wait a few minutes and try again.')) return;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

  const churchId = await resolveChurchIdForHost(req.headers.host, supabase);
  if (!churchId) {
    return res.status(404).json({ error: 'signup_not_available_on_this_domain' });
  }

  const { data: alreadyLinked, error: linkedErr } = await supabase
    .from('people')
    .select('id, self_registered, staff_reviewed_at')
    .eq('clerk_user_id', auth.clerkUserId)
    .eq('church_id', churchId)
    .maybeSingle();
  if (linkedErr) return res.status(500).json({ error: 'person_lookup_failed' });
  if (alreadyLinked) {
    return res.status(200).json({
      ok: true,
      person_id: alreadyLinked.id,
      identity_verified: !alreadyLinked.self_registered || !!alreadyLinked.staff_reviewed_at,
    });
  }

  const clerkUser = await clerk.users.getUser(auth.clerkUserId);
  const email = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
    ?? clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    return res.status(400).json({ error: 'no_email_on_account' });
  }

  // Auto-claim: attach to an existing, unclaimed record for this email
  // rather than duplicating it. Never touches a row someone already
  // signed into (clerk_user_id IS NULL guards that).
  const { data: existingPerson, error: findErr } = await supabase
    .from('people')
    .select('id')
    .eq('church_id', churchId)
    .is('clerk_user_id', null)
    .ilike('email', email)
    .limit(1)
    .maybeSingle();
  if (findErr) return res.status(500).json({ error: 'person_lookup_failed' });

  let personId: string;
  if (existingPerson) {
    personId = existingPerson.id;
    const { error: updateErr } = await supabase
      .from('people')
      .update({ clerk_user_id: auth.clerkUserId, portal_enabled: true, self_registered: true })
      .eq('id', personId);
    if (updateErr) return res.status(500).json({ error: 'person_link_failed' });
  } else {
    const { data: created, error: createErr } = await supabase
      .from('people')
      .insert({
        church_id: churchId,
        clerk_user_id: auth.clerkUserId,
        first_name: clerkUser.firstName || null,
        last_name: clerkUser.lastName || null,
        email,
        status: 'member',
        portal_enabled: true,
        self_registered: true,
      })
      .select('id')
      .single();
    if (createErr || !created) return res.status(500).json({ error: 'person_create_failed' });
    personId = created.id;
  }

  // Same publicMetadata shape provisionPortalMemberDirect writes for
  // staff-initiated activation — one Clerk JWT template mapping (RB-011)
  // serves both paths.
  await clerk.users.updateUserMetadata(auth.clerkUserId, {
    publicMetadata: { ...(clerkUser.publicMetadata ?? {}), church_id: churchId, role: 'member', person_id: personId },
  });

  await emitPlatformEvent(supabase, {
    churchId,
    eventType: 'portal.self_signup_completed',
    sourceApp: 'member_portal',
    actorPersonId: personId,
    subjectType: 'person',
    subjectId: personId,
    payload: { claimed_existing_record: !!existingPerson },
  });

  return res.status(200).json({ ok: true, person_id: personId, identity_verified: false });
}
