/**
 * Remembers which tenant portal a member came from, across Clerk's redirect.
 *
 * Both tenants' portals are served from one host, so the Host header alone
 * cannot tell api/portal/_self-signup.ts which church a sign-up belongs to —
 * it resolved everyone to Central Henderson, including members who were
 * looking at the Faithful portal. The slug is the missing signal.
 *
 * It has to survive a round trip: Clerk navigates away to its own hosted
 * pages and back, so a value held only in React state or the current URL is
 * gone by the time provisioning runs. sessionStorage is the right scope —
 * per-tab, cleared when the tab closes, never shared with another member on
 * the same machine.
 *
 * This is a HINT, not an authorization. The server re-derives the church and
 * honours a slug only for a demo tenant or when the Host already owns that
 * church (see api/_lib/portalTenants.ts), so a tampered value here cannot
 * move a sign-up into a real tenant.
 */

const STORAGE_KEY = 'grace.portal.origin-tenant';

/** Mirrors TENANT_SLUG_CHURCH_IDS in api/_lib/portalTenants.ts. */
const KNOWN_TENANTS = new Set(['faithful', 'central-henderson']);

/**
 * Call once on app load. Reads ?tenant= from the URL, validates it, and
 * stashes it. Safe to call when there is no param — it leaves any previously
 * captured value alone rather than clearing it, because Clerk returns to a
 * URL without the param.
 */
export function captureOriginTenant(search: string = window.location.search): void {
  let slug: string | null = null;
  try {
    slug = new URLSearchParams(search).get('tenant');
  } catch {
    return;
  }
  if (!slug || !KNOWN_TENANTS.has(slug)) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, slug);
  } catch {
    // Private-mode or storage-disabled browsers: the sign-up still works,
    // it just falls back to Host resolution. Never break auth over a hint.
  }
}

/** The captured slug, or null. Always re-validated: storage is user-writable. */
export function readOriginTenant(): string | null {
  try {
    const slug = window.sessionStorage.getItem(STORAGE_KEY);
    return slug && KNOWN_TENANTS.has(slug) ? slug : null;
  } catch {
    return null;
  }
}

export function clearOriginTenant(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* see captureOriginTenant */
  }
}
