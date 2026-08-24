/**
 * Shared-platform WorkOS API client.
 *
 * Thin typed fetch wrapper for api/work-orders/*, api/approvals/*,
 * api/workos/*, api/agents/workos-*, api/audit/timeline. Attaches a Clerk
 * bearer token when one is available (production); when it isn't (demo
 * mode), the server-side demo bootstrap in api/_lib/authz.ts takes over —
 * see AuthContext.getAuthToken.
 */

export class WorkOsApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'WorkOsApiError';
    this.status = status;
    this.body = body;
  }
}

export type GetAuthToken = () => Promise<string | null>;

/**
 * Demo "sign in as [leader]" selection — see src/components/auth/
 * DemoLeaderSignIn.tsx. Only ever read/sent when there's no real bearer
 * token (demo mode has none), so a real Clerk session can never be
 * overridden by a stale localStorage value.
 */
const DEMO_ACTOR_STORAGE_KEY = 'grace-demo-actor-clerk-id';

export function getDemoActor(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(DEMO_ACTOR_STORAGE_KEY);
}

export function setDemoActor(clerkId: string | null): void {
  if (typeof window === 'undefined') return;
  if (clerkId) window.localStorage.setItem(DEMO_ACTOR_STORAGE_KEY, clerkId);
  else window.localStorage.removeItem(DEMO_ACTOR_STORAGE_KEY);
}

export async function workosFetch<T>(
  path: string,
  getAuthToken: GetAuthToken,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    const demoActor = getDemoActor();
    if (demoActor) headers['x-grace-demo-actor'] = demoActor;
  }

  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error : response.statusText;
    throw new WorkOsApiError(message, response.status, body);
  }
  return body as T;
}
