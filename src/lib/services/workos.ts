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
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error : response.statusText;
    throw new WorkOsApiError(message, response.status, body);
  }
  return body as T;
}
