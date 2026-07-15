/**
 * Shared-platform authorization.
 *
 * Server-enforced RBAC for the WorkOS foundation (Work Orders, approvals,
 * consent, platform events). This is the PRIMARY authorization control —
 * never rely on a frontend hiding a button. RLS (migrations 032, 038)
 * provides a second, independent layer for the two highest-consequence
 * tables; everything else in this module is enforced here regardless of
 * what RLS does.
 *
 * Built on top of requireClerkAuth (api/_lib/auth-helper.ts), which
 * verifies the Clerk JWT and extracts church_id. This module adds:
 *   1. account_status enforcement (a valid JWT from a suspended/
 *      deactivated user is rejected even though the token itself is
 *      valid — TD-012-adjacent, closes a session-lifecycle gap the
 *      original security audit didn't cover).
 *   2. Permission resolution from user_roles → role_permissions →
 *      permissions (migration 032), via the service-role client so the
 *      result doesn't depend on the Clerk↔Supabase RLS wiring described
 *      in TECH_DEBT.md TD-001 being complete.
 *   3. Member-actor resolution (people.clerk_user_id) for Members Portal
 *      self-service endpoints.
 *
 * Usage in a route handler:
 *
 *   const actor = await requirePermission(req, res, supabase, 'work_orders.manage');
 *   if (!actor) return; // response already sent
 *   // actor.userId, actor.churchId, actor.permissions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireClerkAuth } from './auth-helper.js';

// Same convention as the legacy demo bypass in api/_middleware/auth.ts —
// same env var, same "explicit opt-in only" posture (see
// SECURITY_FINDINGS_STATUS.md #3's formal waiver for demo auth). Applied
// here to the WorkOS staff-actor path so the Admin Dashboard WorkOS
// modules are actually operable in the live Central Henderson demo, which
// runs without a production Clerk instance (see the current-state
// assessment). NEVER active unless VITE_ENABLE_DEMO_MODE=true is set —
// tracked as a P1 "confirm disabled before a real tenant" item in
// TECH_DEBT.md (TD-043).
const DEMO_MODE = process.env.VITE_ENABLE_DEMO_MODE === 'true';
const DEMO_CHURCH_ID = process.env.VITE_DEFAULT_CHURCH_ID;
const DEMO_CLERK_ID = 'demo-workos-admin';

export interface StaffActor {
  kind: 'staff';
  userId: string;
  clerkUserId: string;
  churchId: string;
  accountStatus: string;
  role: string; // legacy JWT role claim, kept for callers still on the coarse model
  permissions: Set<string>;
}

export interface MemberActor {
  kind: 'member';
  personId: string;
  clerkUserId: string;
  churchId: string;
}

/**
 * Resolves the calling Clerk user to a `users` row and their effective
 * permission set. Returns null (and writes the HTTP response) on any
 * failure — 401 for auth failures, 403 for a resolvable-but-blocked user
 * (unknown user, inactive account).
 */
export async function resolveStaffActor(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient,
): Promise<StaffActor | null> {
  if (DEMO_MODE) {
    return resolveDemoStaffActor(res, supabase);
  }

  const auth = await requireClerkAuth(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return null;
  }

  const { data: userRow, error } = await supabase
    .from('users')
    .select('id, account_status')
    .eq('clerk_id', auth.clerkUserId)
    .eq('church_id', auth.churchId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: 'actor_lookup_failed' });
    return null;
  }
  if (!userRow) {
    res.status(403).json({ error: 'no_user_record_for_church' });
    return null;
  }
  if (userRow.account_status !== 'active') {
    res.status(403).json({ error: 'account_not_active', account_status: userRow.account_status });
    return null;
  }

  const permissions = await loadPermissionKeys(supabase, userRow.id, auth.churchId);

  return {
    kind: 'staff',
    userId: userRow.id,
    clerkUserId: auth.clerkUserId,
    churchId: auth.churchId,
    accountStatus: userRow.account_status,
    role: auth.role,
    permissions,
  };
}

/**
 * Demo-mode staff actor: find-or-create a real `users` row (so Work
 * Order/approval foreign keys are satisfiable) and ensure it holds the
 * `system_administrator` role, then resolve permissions exactly like the
 * real path. Every WorkOS write made through the demo bypass is a real
 * database row, attributed to this real user — the only thing skipped is
 * Clerk JWT verification.
 */
async function resolveDemoStaffActor(
  res: VercelResponse,
  supabase: SupabaseClient,
): Promise<StaffActor | null> {
  if (!DEMO_CHURCH_ID) {
    res.status(503).json({ error: 'demo_church_not_configured' });
    return null;
  }

  const demoEmail = `demo-workos-admin+${DEMO_CHURCH_ID}@grace-crm.internal`;

  let { data: userRow } = await supabase
    .from('users')
    .select('id, account_status')
    .eq('clerk_id', DEMO_CLERK_ID)
    .eq('church_id', DEMO_CHURCH_ID)
    .maybeSingle();

  if (!userRow) {
    const { data: created, error: createErr } = await supabase
      .from('users')
      .insert({
        clerk_id: DEMO_CLERK_ID,
        church_id: DEMO_CHURCH_ID,
        email: demoEmail,
        first_name: 'Demo',
        last_name: 'Administrator',
        role: 'admin',
        account_status: 'active',
      })
      .select('id, account_status')
      .single();
    if (createErr || !created) {
      res.status(500).json({ error: 'demo_actor_bootstrap_failed' });
      return null;
    }
    userRow = created;
  }

  if (userRow.account_status !== 'active') {
    res.status(403).json({ error: 'account_not_active', account_status: userRow.account_status });
    return null;
  }

  const { data: sysAdminRole } = await supabase
    .from('roles')
    .select('id')
    .eq('key', 'system_administrator')
    .is('church_id', null)
    .maybeSingle();

  if (sysAdminRole) {
    const { data: existingGrant } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userRow.id)
      .eq('role_id', sysAdminRole.id)
      .is('revoked_at', null)
      .maybeSingle();

    if (!existingGrant) {
      await supabase.from('user_roles').insert({
        church_id: DEMO_CHURCH_ID,
        user_id: userRow.id,
        role_id: sysAdminRole.id,
      });
    }
  }

  const permissions = await loadPermissionKeys(supabase, userRow.id, DEMO_CHURCH_ID);

  return {
    kind: 'staff',
    userId: userRow.id,
    clerkUserId: DEMO_CLERK_ID,
    churchId: DEMO_CHURCH_ID,
    accountStatus: userRow.account_status,
    role: 'admin',
    permissions,
  };
}

/**
 * Loads the union of permission keys granted to a user across all of
 * their non-revoked role assignments in the given church.
 */
export async function loadPermissionKeys(
  supabase: SupabaseClient,
  userId: string,
  churchId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role_permissions:role_permissions(permissions:permissions(key))')
    .eq('user_id', userId)
    .eq('church_id', churchId)
    .is('revoked_at', null);

  if (error || !data) return new Set();

  const keys = new Set<string>();
  for (const row of data as unknown as { role_permissions: { permissions: { key: string } | null }[] }[]) {
    for (const rp of row.role_permissions ?? []) {
      if (rp.permissions?.key) keys.add(rp.permissions.key);
    }
  }
  return keys;
}

/**
 * Convenience wrapper: resolve the actor AND require a specific
 * permission. Writes 403 and returns null if the actor lacks it.
 */
export async function requirePermission(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient,
  permissionKey: string,
): Promise<StaffActor | null> {
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return null; // response already sent

  if (!actor.permissions.has(permissionKey)) {
    res.status(403).json({ error: 'insufficient_permission', required: permissionKey });
    return null;
  }
  return actor;
}

/**
 * Resolves the calling Clerk user to their `people` row for Members
 * Portal self-service endpoints (consent, communication preferences,
 * care requests, volunteer interests). Unlike resolveStaffActor, this
 * does NOT require a users row or any role/permission grant — every
 * portal member gets baseline self-access to their own data by design.
 */
export async function resolveMemberActor(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient,
): Promise<MemberActor | null> {
  if (DEMO_MODE) {
    return resolveDemoMemberActor(res, supabase);
  }

  const auth = await requireClerkAuth(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return null;
  }

  const { data: personRow, error } = await supabase
    .from('people')
    .select('id, portal_enabled')
    .eq('clerk_user_id', auth.clerkUserId)
    .eq('church_id', auth.churchId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: 'actor_lookup_failed' });
    return null;
  }
  if (!personRow || !personRow.portal_enabled) {
    res.status(403).json({ error: 'portal_access_not_enabled' });
    return null;
  }

  return {
    kind: 'member',
    personId: personRow.id,
    clerkUserId: auth.clerkUserId,
    churchId: auth.churchId,
  };
}

const DEMO_MEMBER_CLERK_ID = 'demo-portal-member';

/**
 * Demo-mode member actor: find-or-create a real `people` row
 * (portal_enabled=true) so Members Portal writes are real database rows,
 * same posture as resolveDemoStaffActor above — only active when
 * VITE_ENABLE_DEMO_MODE=true, tracked in TECH_DEBT.md (TD-043 covers
 * both the staff and member demo bootstraps).
 */
async function resolveDemoMemberActor(
  res: VercelResponse,
  supabase: SupabaseClient,
): Promise<MemberActor | null> {
  if (!DEMO_CHURCH_ID) {
    res.status(503).json({ error: 'demo_church_not_configured' });
    return null;
  }

  let { data: personRow } = await supabase
    .from('people')
    .select('id, portal_enabled')
    .eq('clerk_user_id', DEMO_MEMBER_CLERK_ID)
    .eq('church_id', DEMO_CHURCH_ID)
    .maybeSingle();

  if (!personRow) {
    const { data: created, error: createErr } = await supabase
      .from('people')
      .insert({
        church_id: DEMO_CHURCH_ID,
        clerk_user_id: DEMO_MEMBER_CLERK_ID,
        first_name: 'Demo',
        last_name: 'Member',
        status: 'member',
        portal_enabled: true,
      })
      .select('id, portal_enabled')
      .single();
    if (createErr || !created) {
      res.status(500).json({ error: 'demo_member_bootstrap_failed' });
      return null;
    }
    personRow = created;
  }

  if (!personRow.portal_enabled) {
    res.status(403).json({ error: 'portal_access_not_enabled' });
    return null;
  }

  return {
    kind: 'member',
    personId: personRow.id,
    clerkUserId: DEMO_MEMBER_CLERK_ID,
    churchId: DEMO_CHURCH_ID,
  };
}

/**
 * Field-level redaction utility. Sensitivity/field-scoped permissions are
 * only partially rolled out in this phase (see SHARED_BACKEND.md "Known
 * gaps") — this establishes the pattern for the one route it's wired into
 * today (work-order evidence returned to non-owner viewers) rather than
 * being retrofitted across every existing endpoint.
 */
export function pickFields<T extends Record<string, unknown>>(record: T, allowed: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const key of allowed) {
    if (key in record) out[key] = record[key];
  }
  return out;
}
