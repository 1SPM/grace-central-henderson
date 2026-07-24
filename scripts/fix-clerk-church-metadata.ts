/**
 * One-off remediation script: backfill a Clerk user's publicMetadata
 * with the church_id/role their `users` table row already has.
 *
 * Root cause this fixes: the Clerk JWT template maps
 * publicMetadata.church_id -> the app_metadata.church_id claim that
 * every RLS policy and route guard depends on (see
 * api/_lib/auth-helper.ts, src/hooks/useRouteGuard.ts). A `users` row
 * created outside the normal /signup -> POST /api/billing/create-church
 * flow (e.g. seeded directly into the database) never gets that Clerk
 * metadata written, so the account is valid and active in the database
 * but the browser can never resolve its own identity — RLS on `users`
 * silently returns zero rows, the client-side user object stays null,
 * and every permission check falls back to the least-privileged
 * default. Symptom: a real admin/staff account sees "Restricted Area"
 * on WorkOS/Settings despite a fully valid sign-in.
 *
 * This script writes the missing publicMetadata using the exact same
 * clerk.users.updateUserMetadata() call already used in the normal
 * onboarding path (api/billing/_create-church.ts) — it does not touch
 * RLS, the database, or any other auth logic.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/fix-clerk-church-metadata.ts <clerk_user_id> <church_id> [role]
 *
 * Requires CLERK_SECRET_KEY in the environment (same var every other
 * Clerk-backend route in this repo already uses — see .env.example).
 *
 * Example (the info@divinityagi.com / Central Henderson case):
 *   npx tsx --env-file=.env.local scripts/fix-clerk-church-metadata.ts \
 *     user_3GamUxHx4PULSyddFddJ1odBDNC \
 *     11111111-1111-1111-1111-111111111111 \
 *     admin
 *
 * Safe to re-run: it merges into existing publicMetadata rather than
 * replacing it, matching the merge pattern in _create-church.ts.
 */

import { createClerkClient } from '@clerk/backend';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

async function main() {
  const [clerkUserId, churchId, role = 'admin'] = process.argv.slice(2);

  if (!CLERK_SECRET_KEY) {
    console.error('Missing CLERK_SECRET_KEY in the environment. Pass --env-file=.env.local (or set it in your shell) and try again.');
    process.exit(1);
  }
  if (!clerkUserId || !churchId) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/fix-clerk-church-metadata.ts <clerk_user_id> <church_id> [role]');
    process.exit(1);
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(churchId)) {
    console.error(`church_id "${churchId}" doesn't look like a UUID — double-check you passed the church's id, not its slug or name.`);
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

  const user = await clerk.users.getUser(clerkUserId);
  console.log(`Found Clerk user ${clerkUserId} (${user.primaryEmailAddress?.emailAddress ?? 'no email on file'}).`);
  console.log('Current publicMetadata:', JSON.stringify(user.publicMetadata ?? {}, null, 2));

  const existingChurchId = user.publicMetadata?.church_id;
  if (existingChurchId) {
    console.log(`This account already has publicMetadata.church_id = "${existingChurchId}".`);
    if (existingChurchId !== churchId) {
      console.error(`That does NOT match the church_id you passed ("${churchId}") — refusing to overwrite without --force. If this is intentional, edit the script or update it via the Clerk dashboard directly.`);
      process.exit(1);
    }
    console.log('Already correct — nothing to do.');
    return;
  }

  const updated = await clerk.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      ...(user.publicMetadata ?? {}),
      church_id: churchId,
      role,
    },
  });

  console.log('Updated publicMetadata:', JSON.stringify(updated.publicMetadata, null, 2));
  console.log('\nDone. That user needs to sign out and back in (or refresh their session token) for the new JWT claim to take effect.');
}

main().catch(err => {
  console.error('Script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
