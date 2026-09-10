/**
 * Clerk JWT verification for Vercel serverless routes.
 *
 * Each Sprint 2+ Vercel function previously inlined this. Centralized
 * here so future routes don't drift on which claims they check.
 *
 * Returns a discriminated union so callers handle 401/403 explicitly:
 *
 *   const auth = await requireClerkAuth(req);
 *   if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
 *   // auth.clerkUserId, auth.churchId, auth.role
 *
 * Church_id comes from the JWT's app_metadata.church_id claim — the
 * Clerk JWT template must populate it (see RB-011). If the claim is
 * missing, we return 401 rather than 403: the JWT is technically valid
 * but unusable for tenant-scoped routes, so we treat it as "not
 * authenticated for this purpose".
 */

import type { VercelRequest } from '@vercel/node';
import { verifyToken } from '@clerk/backend';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

export interface AuthOk {
  ok: true;
  clerkUserId: string;
  churchId: string;
  role: string;                       // empty string if no role claim
  sessionId: string;
}

export interface AuthFail {
  ok: false;
  status: 401 | 403 | 503;
  error: string;
}

export type AuthResult = AuthOk | AuthFail;

interface ClerkPayload {
  sub: string;
  sid?: string;
  role?: string;
  app_metadata?: { role?: string; church_id?: string };
  church_id?: string;                 // some Clerk templates flatten this
}

export async function requireClerkAuth(
  req: VercelRequest,
  opts: { allowedRoles?: string[] } = {},
): Promise<AuthResult> {
  if (!CLERK_SECRET_KEY) {
    return { ok: false, status: 503, error: 'auth not configured' };
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'missing bearer token' };
  }

  let payload: ClerkPayload;
  try {
    payload = (await verifyToken(header.slice(7), { secretKey: CLERK_SECRET_KEY })) as unknown as ClerkPayload;
  } catch {
    return { ok: false, status: 401, error: 'invalid token' };
  }

  const churchId = payload.app_metadata?.church_id ?? payload.church_id;
  if (!churchId) {
    return { ok: false, status: 401, error: 'jwt missing church_id claim' };
  }

  // app_metadata.role is the real app-role claim. The flat `role` claim is
  // reserved by Supabase's Third-Party Auth "supabase" JWT template — it's
  // always the literal string "authenticated" (the Postgres role to assume
  // for RLS), never a real app role, so it must not take priority here.
  const role = payload.app_metadata?.role ?? (payload.role !== 'authenticated' ? payload.role : undefined) ?? '';

  if (opts.allowedRoles && opts.allowedRoles.length > 0 && !opts.allowedRoles.includes(role)) {
    return { ok: false, status: 403, error: 'forbidden' };
  }

  return {
    ok: true,
    clerkUserId: payload.sub,
    churchId,
    role,
    sessionId: payload.sid ?? '',
  };
}

export type MinimalAuthResult =
  | { ok: true; clerkUserId: string }
  | { ok: false; status: 401 | 503; error: string };

/**
 * Verifies a Clerk session WITHOUT requiring the church_id claim —
 * requireClerkAuth can't be reused here because the whole point of
 * api/portal/_self-signup.ts is to run BEFORE that claim exists (it's
 * what sets it, via Clerk publicMetadata). Only proves "this is a real,
 * currently-valid Clerk session for this user" — every tenant/permission
 * check for what that session may then do still happens separately.
 */
export async function verifyClerkSessionOnly(req: VercelRequest): Promise<MinimalAuthResult> {
  if (!CLERK_SECRET_KEY) {
    return { ok: false, status: 503, error: 'auth not configured' };
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'missing bearer token' };
  }
  try {
    const payload = (await verifyToken(header.slice(7), { secretKey: CLERK_SECRET_KEY })) as unknown as ClerkPayload;
    return { ok: true, clerkUserId: payload.sub };
  } catch {
    return { ok: false, status: 401, error: 'invalid token' };
  }
}
