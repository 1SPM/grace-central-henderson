/**
 * "Direct" portal provisioning — server-side replica of
 * scripts/provision-portal-member.ts's manual sequence, wired into
 * api/people/_provision-portal.ts so the Clerk secret never has to
 * touch a laptop again. Creates (or converges an existing) Clerk user
 * with no password, then binds it into `people`/`users` and records an
 * already-accepted member_invitations row for the audit trail — this is
 * staff acting on the member's behalf, not the member going through the
 * invite → accept round trip themselves.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { createClerkClient } from '@clerk/backend';
import { randomBytes } from 'node:crypto';

type ClerkClient = ReturnType<typeof createClerkClient>;

export interface DirectProvisionPerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export interface DirectProvisionResult {
  clerkUserId: string;
  email: string;
  clerkUserCreated: boolean;
}

export async function provisionPortalMemberDirect(
  supabase: SupabaseClient,
  clerk: ClerkClient,
  churchId: string,
  person: DirectProvisionPerson,
): Promise<DirectProvisionResult> {
  const metadata = { church_id: churchId, role: 'member', person_id: person.id };

  const existing = await clerk.users.getUserList({ emailAddress: [person.email] });
  let clerkUserId: string;
  let clerkUserCreated = false;

  if (existing.data.length > 0) {
    const user = existing.data[0];
    clerkUserId = user.id;
    const alreadyCorrect = user.publicMetadata?.church_id === churchId
      && user.publicMetadata?.role === 'member'
      && user.publicMetadata?.person_id === person.id;
    if (!alreadyCorrect) {
      await clerk.users.updateUserMetadata(user.id, {
        publicMetadata: { ...(user.publicMetadata ?? {}), ...metadata },
      });
    }
  } else {
    const user = await clerk.users.createUser({
      emailAddress: [person.email],
      firstName: person.first_name || undefined,
      lastName: person.last_name || undefined,
      publicMetadata: metadata,
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });
    clerkUserId = user.id;
    clerkUserCreated = true;
  }

  await supabase.from('users').upsert(
    {
      clerk_id: clerkUserId,
      email: person.email,
      first_name: person.first_name,
      last_name: person.last_name,
      role: 'member',
      church_id: churchId,
    },
    { onConflict: 'clerk_id' },
  );

  await supabase
    .from('people')
    .update({ clerk_user_id: clerkUserId, portal_enabled: true })
    .eq('id', person.id);

  // Audit-trail row — status is already 'accepted' since staff completed
  // this on the member's behalf; there is no separate accept step.
  await supabase.from('member_invitations').insert({
    church_id: churchId,
    person_id: person.id,
    email: person.email.toLowerCase(),
    token: randomBytes(24).toString('base64url'),
    status: 'accepted',
    accepted_at: new Date().toISOString(),
  });

  return { clerkUserId, email: person.email, clerkUserCreated };
}
