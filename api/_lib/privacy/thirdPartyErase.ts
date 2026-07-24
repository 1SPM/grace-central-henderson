/**
 * Third-party erasure — propagate a right-to-be-forgotten deletion to
 * processors that hold their own copy. Called by /api/consents/erase.
 *
 * Every function is best-effort: it never throws (a failure is returned as a
 * string outcome recorded in the audit), and short-circuits to
 * 'not_configured' when the processor's admin credentials aren't set — so the
 * endpoint works before the keys exist and starts propagating once they do.
 *
 * PostHog: holds per-person analytics events keyed on the distinct id (the
 *   Clerk user id). Deleted via the GDPR person-delete API (delete_events=true).
 * D-ID:   streaming avatar sessions are ephemeral and we store no per-person
 *   handle, so there is nothing to delete via API — reported honestly.
 */

const PH_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const PH_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
// Personal-API host (NOT the ingestion host); default US cloud.
const PH_API_HOST = (process.env.POSTHOG_API_HOST || 'https://us.posthog.com').replace(/\/$/, '');
const TIMEOUT_MS = 2500;

export type EraseOutcome = 'deleted' | 'not_found' | 'not_configured' | 'no_stored_identifier' | string;

async function phFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${PH_API_HOST}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${PH_API_KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Delete a person (and their events) from PostHog by distinct id. Tries each
 * candidate id (e.g. the Clerk id); returns the first concrete outcome.
 */
export async function erasePostHogPerson(distinctIds: string[]): Promise<EraseOutcome> {
  if (!PH_PROJECT_ID || !PH_API_KEY) return 'not_configured';
  const ids = distinctIds.filter(Boolean);
  if (ids.length === 0) return 'no_stored_identifier';

  try {
    let anyFound = false;
    for (const distinctId of ids) {
      const lookup = await phFetch(
        `/api/projects/${PH_PROJECT_ID}/persons/?distinct_id=${encodeURIComponent(distinctId)}`,
        { method: 'GET' },
      );
      if (!lookup.ok) return `error: lookup HTTP ${lookup.status}`;
      const body = await lookup.json() as { results?: Array<{ id: string | number }> };
      const personId = body.results?.[0]?.id;
      if (personId == null) continue;
      anyFound = true;
      const del = await phFetch(
        `/api/projects/${PH_PROJECT_ID}/persons/${personId}/?delete_events=true`,
        { method: 'DELETE' },
      );
      if (!del.ok) return `error: delete HTTP ${del.status}`;
    }
    return anyFound ? 'deleted' : 'not_found';
  } catch (err) {
    return `error: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`;
  }
}
