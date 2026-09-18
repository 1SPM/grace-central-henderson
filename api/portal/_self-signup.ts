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
 * Church comes from the request's Host header, the same trust boundary the
 * public /connect intake form uses — with one deliberate, gated exception:
 * both tenants' portals are served from the SAME host, so a member signing
 * up while looking at the Faithful portal was being created in the real
 * Central Henderson tenant. resolvePortalChurchId lets the request name its
 * tenant slug, but honours it only for a demo tenant or when the Host
 * already owns that church — see api/_lib/portalTenants.ts for the full
 * threat model. A real client tenant is never reachable by slug alone.
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
import { resolvePortalChurchId } from '../_lib/portalTenants.js';
import { isDemoChurch } from '../_lib/demoTenants.js';
import { readBody, str } from '../_lib/validation.js';
import { recordConsents } from '../_lib/consentWrites.js';
import { createHash } from 'node:crypto';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { clientIp, enforceRateLimit } from '../_lib/rateLimit/limiter.js';

/**
 * Every field is optional: the frontend has always called this with no body
 * at all, and must keep working unchanged.
 *   tenant         — which portal the member was actually looking at
 *   preferred_name — captured during the walkthrough, before Clerk sign-up.
 *                    Clerk collects only email + password here, so without
 *                    this every self-registered member is literally "New
 *                    Member" until they edit their profile.
 */
const SIGNUP_SCHEMA = {
  tenant: str({ max: 64, pattern: /^[a-z0-9-]+$/ }),
  preferred_name: str({ max: 80 }),
  // A story redeemed on this device at /claim. The nonce is what authorises
  // the attach — a draft id alone travels in URLs and logs.
  story_draft_id: str({ max: 64, pattern: /^[0-9a-fA-F-]{36}$/ }),
  story_attach_nonce: str({ max: 64, pattern: /^[A-Za-z0-9_-]{20,64}$/ }),
};

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

  const body = readBody({ body: req.body ?? {} }, res, SIGNUP_SCHEMA);
  if (!body) return;

  const churchId = await resolvePortalChurchId(req.headers.host, body.tenant, supabase);
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
    .select('id, tags, self_registered')
    .eq('church_id', churchId)
    .is('clerk_user_id', null)
    .ilike('email', email)
    .limit(1)
    .maybeSingle();
  if (findErr) return res.status(500).json({ error: 'person_lookup_failed' });

  // In a demo tenant the unclaimed rows are fabricated personas with seeded
  // giving, attendance and care history. A pilot participant who types one of
  // those addresses — entirely possible when demo emails are on screen during
  // a workshop — would inherit that history as their own. Only claim a row
  // that represents a real prior interaction (a connect card) or an earlier
  // self-signup; otherwise fall through and insert a fresh person.
  const claimable = existingPerson && (
    !isDemoChurch(churchId)
    || existingPerson.self_registered === true
    || (existingPerson.tags ?? []).includes('connect-card')
  ) ? existingPerson : null;

  let personId: string;
  if (claimable) {
    personId = claimable.id;
    // church_id filter is load-bearing even though the row was selected with
    // it: it keeps the guarantee local to the statement that does the write.
    const { error: updateErr } = await supabase
      .from('people')
      .update({ clerk_user_id: auth.clerkUserId, portal_enabled: true, self_registered: true })
      .eq('id', personId)
      .eq('church_id', churchId);
    if (updateErr) return res.status(500).json({ error: 'person_link_failed' });
  } else {
    // people.first_name/last_name are NOT NULL with no default, but this
    // Clerk instance's sign-up form collects only email + password — so
    // clerkUser.firstName/lastName are routinely empty, not an edge case.
    // A preferred_name captured during the portal walkthrough is the best
    // source we have; it goes in whole rather than being split, because
    // guessing where a surname starts gets names wrong. Failing that, keep
    // the long-standing clearly-a-placeholder fallback the member can
    // replace in My Profile, rather than failing sign-up over a name.
    const firstName = body.preferred_name || clerkUser.firstName || 'New';
    const lastName = body.preferred_name
      ? (clerkUser.lastName || '')
      : (clerkUser.lastName || 'Member');
    const { data: created, error: createErr } = await supabase
      .from('people')
      .insert({
        church_id: churchId,
        clerk_user_id: auth.clerkUserId,
        first_name: firstName,
        last_name: lastName,
        email,
        status: 'member',
        portal_enabled: true,
        self_registered: true,
        // Human-visible separability in the CRM, alongside self_registered:
        // lets staff export or purge pilot sign-ups without a schema change.
        tags: ['portal-signup'],
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
    payload: {
      claimed_existing_record: !!claimable,
      // A match we declined to claim is worth seeing: in a demo tenant it
      // means someone signed up with a seeded persona's address.
      declined_demo_persona_match: !!existingPerson && !claimable,
      tenant_slug_used: body.tenant ?? null,
    },
  });

  // ── Attach a carried story, if one was redeemed on this device ────────────
  //
  // Deliberately after the account exists and after the Clerk metadata write:
  // a research record must never be the reason someone cannot finish signing
  // up. Every failure below is reported and swallowed, the same posture
  // api/_connect-card.ts takes with its secondary writes.
  if (body.story_draft_id && body.story_attach_nonce) {
    const nonceHash = createHash('sha256').update(body.story_attach_nonce).digest('hex');
    // Single conditional UPDATE: claimed_at IS NULL makes the attach
    // single-use, and the church_id filter is load-bearing — it is what stops
    // a draft id scraped from another tenant being attached here.
    const { data: attached, error: attachErr } = await supabase
      .from('visitor_story_drafts')
      .update({
        person_id: personId,
        claimed_at: new Date().toISOString(),
        attach_nonce_sha256: null,
        attach_expires_at: null,
      })
      .eq('id', body.story_draft_id)
      .eq('church_id', churchId)
      .is('claimed_at', null)
      .eq('attach_nonce_sha256', nonceHash)
      .gt('attach_expires_at', new Date().toISOString())
      .select('id, consent_followup, consent_money_sections')
      .maybeSingle();

    if (attachErr || !attached) {
      await emitPlatformEvent(supabase, {
        churchId,
        eventType: 'story.attach_failed',
        sourceApp: 'member_portal',
        actorPersonId: personId,
        subjectType: 'visitor_story_draft',
        subjectId: body.story_draft_id,
        payload: { reason: attachErr ? 'update_failed' : 'no_matching_draft' },
      });
    } else {
      // What the member agreed to at capture time becomes real consent now
      // that a person_id exists. Denials are written, not omitted: "asked and
      // declined" must stay distinguishable from "never asked".
      const consentResult = await recordConsents(supabase, churchId, personId, [
        { consent_type: 'pastoral_contact', status: attached.consent_followup ? 'granted' : 'denied' },
        { consent_type: 'email', status: attached.consent_followup ? 'granted' : 'denied' },
        { consent_type: 'impact_card_communications', status: attached.consent_money_sections ? 'granted' : 'denied' },
        // A brand-new self-registered pilot participant does not belong in a
        // church directory by default, and that default should be explicit.
        { consent_type: 'directory_visibility', status: 'denied' },
      ].map(e => ({ consentType: e.consent_type, status: e.status as 'granted' | 'denied' })));

      await emitPlatformEvent(supabase, {
        churchId,
        eventType: 'story.draft_claimed',
        sourceApp: 'member_portal',
        actorPersonId: personId,
        subjectType: 'visitor_story_draft',
        subjectId: attached.id,
        payload: {
          followup_consented: attached.consent_followup,
          consents_written: consentResult.ok,
        },
      });
    }
  }

  return res.status(200).json({ ok: true, person_id: personId, identity_verified: false });
}
