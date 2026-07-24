/**
 * One-off provisioning script: issue a real Clerk portal account for an
 * existing `people` row, the same way a member's account gets connected
 * to the CRM through normal onboarding (see api/billing/_create-church.ts
 * for the equivalent staff-side pattern).
 *
 * Creates the Clerk user (or reuses one already at that email), stamps
 * publicMetadata.church_id so the JWT template's app_metadata.church_id
 * claim resolves (required by every portal route — see RB-011 /
 * api/_lib/auth-helper.ts), and does NOT set a password: the account
 * holder completes sign-in themselves via Clerk's password-reset / email
 * code flow, so no one ever has to type or transmit a password for them.
 *
 * This script only touches Clerk. It does not write to Supabase — after
 * it prints the new clerk_user_id, link it into the `people` row's
 * clerk_user_id column (and flip portal_enabled to true) separately.
 *
 * publicMetadata mirrors exactly what api/members/_accept-invitation.ts
 * sets for a normally-invited member (church_id, role: 'member',
 * person_id) — this script exists for the case where the person_id
 * already exists in `people` (e.g. seeded/placeholder data) and we're
 * provisioning the account directly instead of running the invite ->
 * accept round trip.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/provision-portal-member.ts \
 *     <email> <church_id> <person_id> [first_name] [last_name]
 *
 * Requires CLERK_SECRET_KEY (Production instance) in the environment.
 */

import { createClerkClient } from '@clerk/backend';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

async function main() {
  const [email, churchId, personId, firstName, lastName] = process.argv.slice(2);

  if (!CLERK_SECRET_KEY) {
    console.error('Missing CLERK_SECRET_KEY in the environment. Pass --env-file=.env.local (or set it in your shell) and try again.');
    process.exit(1);
  }
  if (!email || !churchId || !personId) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/provision-portal-member.ts <email> <church_id> <person_id> [first_name] [last_name]');
    process.exit(1);
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(churchId) || !UUID_RE.test(personId)) {
    console.error('church_id and person_id must both be UUIDs — double-check you passed the ids, not slugs or names.');
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const metadata = { church_id: churchId, role: 'member', person_id: personId };

  const existing = await clerk.users.getUserList({ emailAddress: [email] });
  if (existing.data.length > 0) {
    const user = existing.data[0];
    console.log(`A Clerk user already exists for ${email}: ${user.id}`);
    console.log('Current publicMetadata:', JSON.stringify(user.publicMetadata ?? {}, null, 2));
    const alreadyCorrect = user.publicMetadata?.church_id === churchId
      && user.publicMetadata?.role === 'member'
      && user.publicMetadata?.person_id === personId;
    if (alreadyCorrect) {
      console.log('Already correct — nothing to do.');
    } else {
      const updated = await clerk.users.updateUserMetadata(user.id, {
        publicMetadata: { ...(user.publicMetadata ?? {}), ...metadata },
      });
      console.log('Updated publicMetadata:', JSON.stringify(updated.publicMetadata, null, 2));
    }
    console.log(`\nclerk_user_id: ${user.id}`);
    return;
  }

  const user = await clerk.users.createUser({
    emailAddress: [email],
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    publicMetadata: metadata,
    skipPasswordChecks: true,
    skipPasswordRequirement: true,
  });

  console.log(`Created Clerk user ${user.id} for ${email}.`);
  console.log('publicMetadata:', JSON.stringify(user.publicMetadata, null, 2));
  console.log(`\nclerk_user_id: ${user.id}`);
  console.log('\nNo password was set. The account holder signs in via "forgot password" / email code on the sign-in page to establish one.');
}

main().catch(err => {
  console.error('Script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
