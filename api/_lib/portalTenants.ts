/**
 * The canonical mapping between a Member Portal tenant slug (the
 * `/tenants/<slug>/member-portal.html` path segment) and a church_id, plus
 * the one safe way to resolve a church when the Host header alone cannot.
 *
 * WHY THIS EXISTS
 *
 * Host-based resolution (resolveChurchIdForHost) is the right trust boundary
 * for public intake, and it is what every anonymous route uses: Vercel routes
 * by domain/SNI, so a caller cannot make it resolve to a church whose domain
 * they are not actually connecting to.
 *
 * It breaks down in exactly one situation, which is live today: BOTH tenants'
 * static portals are served from the SAME host. `grace-members.vercel.app`
 * maps to Central Henderson in HOST_CHURCH_IDS (a placeholder until the M8
 * custom-domain cutover), and the Faithful portal is served from that same
 * host at /tenants/faithful/member-portal.html. So a member completing Clerk
 * sign-up while looking at the Faithful portal was resolved as a CENTRAL
 * HENDERSON person — a real client tenant. One host cannot express two
 * tenants, and no amount of care in the calling route fixes that.
 *
 * THE RULE, AND WHY IT IS SAFE
 *
 * A client-supplied slug is honoured only when EITHER:
 *   1. the church it names is a demo tenant (isDemoChurch), or
 *   2. the request's own Host already resolves to that same church.
 *
 * So the worst a forged slug can do is write into the fabricated demo tenant.
 * A real client tenant remains selectable only by a host that already owns it,
 * which is precisely the injection hole api/_connect-card.ts documents closing
 * when it stopped accepting church_id from the request body.
 *
 * Anything else — no slug, an unknown slug, or a real-tenant slug on a host
 * that does not own it — falls through to Host resolution unchanged, so
 * existing callers keep their current behaviour exactly.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveChurchIdForHost } from './resolveChurchByHost.js';
import { isDemoChurch } from './demoTenants.js';

export const FAITHFUL_CHURCH_ID = '22222222-2222-2222-2222-222222222222';
export const CENTRAL_HENDERSON_CHURCH_ID = '11111111-1111-1111-1111-111111111111';

/**
 * Slug -> church. Mirrored by apps/member-web/public/tenants/<slug>/ on disk;
 * adding a tenant directory without adding it here means its members resolve
 * to whatever the Host says, which is the bug this module exists to fix.
 */
export const TENANT_SLUG_CHURCH_IDS: Readonly<Record<string, string>> = {
  faithful: FAITHFUL_CHURCH_ID,
  'central-henderson': CENTRAL_HENDERSON_CHURCH_ID,
};

/** church -> slug. Faithful is the fallback: it is the demo tenant. */
export function portalTenantSlug(churchId: string): string {
  return churchId === CENTRAL_HENDERSON_CHURCH_ID ? 'central-henderson' : 'faithful';
}

/**
 * Resolve the church for a request that may name a tenant slug.
 *
 * @param host  the request's own Host header — never client body content
 * @param slug  a client-supplied tenant slug, or undefined
 */
export async function resolvePortalChurchId(
  host: string | undefined,
  slug: string | undefined | null,
  supabase: SupabaseClient,
): Promise<string | null> {
  const hostChurchId = await resolveChurchIdForHost(host, supabase);

  if (typeof slug !== 'string' || slug === '') return hostChurchId;

  const slugChurchId = TENANT_SLUG_CHURCH_IDS[slug];
  if (!slugChurchId) return hostChurchId;

  // Demo tenants are selectable from anywhere: a forged slug can only ever
  // reach fabricated data, and this is what makes localhost and Vercel
  // preview deployments work without maintaining a hostname allowlist.
  if (isDemoChurch(slugChurchId)) return slugChurchId;

  // Real tenant: only honoured when the host already owns it. A slug can
  // never move a request INTO a real tenant it did not already belong to.
  if (hostChurchId && hostChurchId === slugChurchId) return slugChurchId;

  return hostChurchId;
}
