/**
 * Single-person portal invitation core, shared by the bulk invite route
 * (api/members/_invite.ts) and the Provisioning Studio's "invite" mode
 * (api/people/_provision-portal.ts) — one code path, so the two never
 * drift on the Clerk invitation shape or the member_invitations write.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { createClerkClient } from '@clerk/backend';
import { randomBytes } from 'node:crypto';

type ClerkClient = ReturnType<typeof createClerkClient>;

export interface InvitablePerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  clerk_user_id: string | null;
}

export interface InviteSinglePersonInput {
  supabase: SupabaseClient;
  clerk: ClerkClient | null;
  churchId: string;
  person: InvitablePerson;
  inviterUserId: string | null;
  appUrl: string;
}

export type InviteSinglePersonResult =
  | { status: 'invited' }
  | { status: 'skipped'; reason: 'no_email' | 'already_linked' }
  | { status: 'error'; error: string };

/** Caller is responsible for fetching `person` (church-scoped) — this only performs the mutation sequence, so a bulk caller can batch-fetch once instead of one query per person. */
export async function inviteSinglePerson(input: InviteSinglePersonInput): Promise<InviteSinglePersonResult> {
  const { supabase, clerk, churchId, person, inviterUserId, appUrl } = input;
  const personId = person.id;

  if (!person.email) return { status: 'skipped', reason: 'no_email' };
  if (person.clerk_user_id) return { status: 'skipped', reason: 'already_linked' };

  try {
    // Revoke any prior live invitation for this person.
    await supabase
      .from('member_invitations')
      .update({ status: 'revoked' })
      .eq('person_id', personId)
      .in('status', ['pending', 'sent']);

    const token = randomBytes(24).toString('base64url');
    const redirectUrl = `${appUrl}/portal?invite=${token}`;

    let clerkInvitationId: string | null = null;
    let status: 'pending' | 'sent' = 'pending';
    if (clerk) {
      const invitation = await clerk.invitations.createInvitation({
        emailAddress: person.email as string,
        redirectUrl,
        publicMetadata: {
          church_id: churchId,
          role: 'member',
          grace_invite_token: token,
        },
        notify: true,
        ignoreExisting: true,
      });
      clerkInvitationId = invitation.id;
      status = 'sent';
    }

    const { error: insertErr } = await supabase.from('member_invitations').insert({
      church_id: churchId,
      person_id: personId,
      email: (person.email as string).toLowerCase(),
      token,
      status,
      invited_by_user_id: inviterUserId,
      clerk_invitation_id: clerkInvitationId,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });
    if (insertErr) throw new Error(insertErr.message);

    // Pre-qualify the person for portal access.
    await supabase.from('people').update({ portal_enabled: true }).eq('id', personId);

    return { status: 'invited' };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'invite_failed' };
  }
}
