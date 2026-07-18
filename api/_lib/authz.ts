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

// Mirrors HOST_TENANTS in src/config/tenant.ts. Vercel env vars are
// per-environment, not per-custom-domain, and this project deliberately
// stays a single deployment (see docs/DEPLOY.md) — so which church the
// demo bypass writes to has to be resolved from the request hostname,
// not a shared env var, or every white-label host would silently share
// Central Henderson's data.
const HOST_CHURCH_IDS: Record<string, string> = {
  'grace-crm-two.vercel.app': '22222222-2222-2222-2222-222222222222',
  'grace-crm.dev': '22222222-2222-2222-2222-222222222222',
  'www.grace-crm.dev': '22222222-2222-2222-2222-222222222222',
};

/**
 * Resolves which church the demo bypass should act as, based on the
 * request's Host header. Unmapped hosts (including the real Central
 * Henderson domain) fall back to VITE_DEFAULT_CHURCH_ID.
 */
export function resolveDemoChurchId(req: VercelRequest): string | undefined {
  const host = req.headers.host;
  if (host && HOST_CHURCH_IDS[host]) return HOST_CHURCH_IDS[host];
  return DEMO_CHURCH_ID;
}

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
  /** True when this actor was resolved from a staff-issued preview token
   * (see resolveMemberActor below) rather than the member's own Clerk
   * session. resolveMemberActor already blocks non-GET requests for
   * preview actors, but callers with additional side effects beyond a
   * simple write (e.g. sending an email) should still check this. */
  isPreview?: boolean;
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
    return resolveDemoStaffActor(req, res, supabase);
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
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient,
): Promise<StaffActor | null> {
  const churchId = resolveDemoChurchId(req);
  if (!churchId) {
    res.status(503).json({ error: 'demo_church_not_configured' });
    return null;
  }

  // clerk_id is globally unique (users_clerk_id_key), not scoped per
  // church — a bare 'demo-workos-admin' constant would collide the moment
  // a second demo tenant's bootstrap ran. Scope it per church.
  const demoClerkId = `demo-workos-admin+${churchId}`;
  const demoEmail = `demo-workos-admin+${churchId}@grace-crm.internal`;

  let { data: userRow } = await supabase
    .from('users')
    .select('id, account_status')
    .eq('clerk_id', demoClerkId)
    .eq('church_id', churchId)
    .maybeSingle();

  if (!userRow) {
    const { data: created, error: createErr } = await supabase
      .from('users')
      .insert({
        clerk_id: demoClerkId,
        church_id: churchId,
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
        church_id: churchId,
        user_id: userRow.id,
        role_id: sysAdminRole.id,
      });
    }
  }

  const permissions = await loadPermissionKeys(supabase, userRow.id, churchId);

  return {
    kind: 'staff',
    userId: userRow.id,
    clerkUserId: demoClerkId,
    churchId,
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
  // Two explicit hops rather than a single nested PostgREST embed:
  // user_roles and role_permissions both reference `roles` independently —
  // there is no direct foreign key between user_roles and role_permissions,
  // so a `user_roles -> role_permissions` embed cannot be resolved by
  // PostgREST (it silently returns no rows). Verified against the real
  // production schema; a hand-rolled test mock had been masking this.
  const { data: grants, error: grantsErr } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)
    .eq('church_id', churchId)
    .is('revoked_at', null);

  if (grantsErr || !grants || grants.length === 0) return new Set();

  const roleIds = [...new Set(grants.map(g => g.role_id as string))];

  const { data: rows, error: permsErr } = await supabase
    .from('role_permissions')
    .select('permissions(key)')
    .in('role_id', roleIds);

  if (permsErr || !rows) return new Set();

  const keys = new Set<string>();
  for (const row of rows as unknown as { permissions: { key: string } | null }[]) {
    if (row.permissions?.key) keys.add(row.permissions.key);
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
    return resolveDemoMemberActor(req, res, supabase);
  }

  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (bearer?.startsWith(PREVIEW_TOKEN_PREFIX)) {
    return resolvePreviewMemberActor(req, res, supabase, bearer);
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

// Distinguishes staff-issued preview tokens (opaque random strings) from
// real Clerk JWTs on sight, so resolveMemberActor doesn't waste a Clerk
// verification round-trip on something that was never going to be one.
export const PREVIEW_TOKEN_PREFIX = 'pvt_';

/**
 * Resolves a staff-issued "preview as member" token (see
 * api/people/_preview-portal-token.ts) to the target member's actor.
 * Read-only by design: any non-GET request is rejected here, before it
 * ever reaches a route's mutation logic, so no portal route needs its
 * own preview-mode check. Tokens are short-lived and scoped to one
 * person; every successful resolution is stamped (first/last used,
 * use_count) for the audit trail, but the token itself stays valid
 * until it expires — a preview session makes many GET requests across
 * several portal pages, not just one.
 */
async function resolvePreviewMemberActor(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient,
  token: string,
): Promise<MemberActor | null> {
  if (req.method !== 'GET') {
    res.status(403).json({ error: 'preview_mode_read_only' });
    return null;
  }

  const { data: row } = await supabase
    .from('portal_preview_tokens')
    .select('id, church_id, person_id, expires_at, use_count')
    .eq('token', token)
    .maybeSingle();

  if (!row || new Date(row.expires_at as string) < new Date()) {
    res.status(401).json({ error: 'preview_token_invalid_or_expired' });
    return null;
  }

  const { data: person } = await supabase
    .from('people')
    .select('id, clerk_user_id')
    .eq('id', row.person_id as string)
    .eq('church_id', row.church_id as string)
    .maybeSingle();
  if (!person) {
    res.status(404).json({ error: 'preview_target_not_found' });
    return null;
  }

  const now = new Date().toISOString();
  await supabase
    .from('portal_preview_tokens')
    .update({
      last_used_at: now,
      first_used_at: row.use_count === 0 ? now : undefined,
      use_count: (row.use_count as number) + 1,
    })
    .eq('id', row.id as string);

  return {
    kind: 'member',
    personId: person.id,
    clerkUserId: (person.clerk_user_id as string) ?? '',
    churchId: row.church_id as string,
    isPreview: true,
  };
}

/**
 * Demo-mode member actor: find-or-create a real `people` row
 * (portal_enabled=true) so Members Portal writes are real database rows,
 * same posture as resolveDemoStaffActor above — only active when
 * VITE_ENABLE_DEMO_MODE=true, tracked in TECH_DEBT.md (TD-043 covers
 * both the staff and member demo bootstraps).
 */
async function resolveDemoMemberActor(
  req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient,
): Promise<MemberActor | null> {
  const churchId = resolveDemoChurchId(req);
  if (!churchId) {
    res.status(503).json({ error: 'demo_church_not_configured' });
    return null;
  }

  // clerk_user_id is globally unique (idx_people_clerk_user_id), not
  // scoped per church — a bare 'demo-portal-member' constant would collide
  // the moment a second demo tenant's bootstrap ran. Scope it per church.
  const demoMemberClerkId = `demo-portal-member+${churchId}`;

  let { data: personRow } = await supabase
    .from('people')
    .select('id, portal_enabled')
    .eq('clerk_user_id', demoMemberClerkId)
    .eq('church_id', churchId)
    .maybeSingle();

  if (!personRow) {
    const { data: created, error: createErr } = await supabase
      .from('people')
      .insert({
        church_id: churchId,
        clerk_user_id: demoMemberClerkId,
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
    clerkUserId: demoMemberClerkId,
    churchId,
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
