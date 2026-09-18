/**
 * Tenant-slug resolution gating.
 *
 * resolvePortalChurchId accepts a CLIENT-SUPPLIED tenant slug, which is a
 * deliberate exception to the rule that anonymous routes resolve their church
 * from the Host header alone. The exception exists because both tenants'
 * portals are served from one host, so Host resolution alone sent members
 * signing up on the Faithful portal into the real Central Henderson tenant.
 *
 * The exception is only safe while a forged slug can reach nothing but a demo
 * tenant. That is the invariant these tests enforce mechanically, rather than
 * leaving it asserted in a comment — which is how TD-043 (see
 * authz.demo.test.ts) got through the first time.
 */
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolvePortalChurchId,
  portalTenantSlug,
  TENANT_SLUG_CHURCH_IDS,
  FAITHFUL_CHURCH_ID,
  CENTRAL_HENDERSON_CHURCH_ID,
} from './portalTenants.js';
import { isDemoChurch } from './demoTenants.js';
import { HOST_CHURCH_IDS } from './authz.js';

const CENTRAL_HOST = 'gracecrm-centralhenderson.org';
const SHARED_HOST = 'grace-members.vercel.app';
const DEMO_HOST = 'grace-crm-two.vercel.app';
const UNKNOWN_HOST = 'evil.example';

/** churches.hosts lookup is only reached for hosts not in HOST_CHURCH_IDS. */
function supabaseReturning(id: string | null): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        contains: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: id ? { id } : null }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('resolvePortalChurchId', () => {
  it('falls back to the host when no slug is given', async () => {
    const got = await resolvePortalChurchId(CENTRAL_HOST, undefined, supabaseReturning(null));
    expect(got).toBe(CENTRAL_HENDERSON_CHURCH_ID);
  });

  it.each([null, '', 'not-a-tenant', '../faithful'])(
    'ignores an absent or unknown slug (%p) and uses the host',
    async (slug) => {
      const got = await resolvePortalChurchId(CENTRAL_HOST, slug, supabaseReturning(null));
      expect(got).toBe(CENTRAL_HENDERSON_CHURCH_ID);
    },
  );

  it('resolves the faithful slug on the shared host — the live bug this fixes', async () => {
    // Without the slug this host resolves to Central Henderson, so a member
    // signing up on the Faithful portal landed in the real client tenant.
    expect(HOST_CHURCH_IDS[SHARED_HOST]).toBe(CENTRAL_HENDERSON_CHURCH_ID);
    const got = await resolvePortalChurchId(SHARED_HOST, 'faithful', supabaseReturning(null));
    expect(got).toBe(FAITHFUL_CHURCH_ID);
  });

  it('resolves the faithful slug even on an unknown host', async () => {
    // Demo data only, and this is what makes localhost and preview
    // deployments work without a hostname allowlist.
    const got = await resolvePortalChurchId(UNKNOWN_HOST, 'faithful', supabaseReturning(null));
    expect(got).toBe(FAITHFUL_CHURCH_ID);
  });

  it('REFUSES a real-tenant slug on a host that does not own it', async () => {
    // The injection case. Must fall back to the host, never the slug.
    const got = await resolvePortalChurchId(DEMO_HOST, 'central-henderson', supabaseReturning(null));
    expect(got).toBe(FAITHFUL_CHURCH_ID);
    expect(got).not.toBe(CENTRAL_HENDERSON_CHURCH_ID);
  });

  it('REFUSES a real-tenant slug on an unknown host, resolving to nothing', async () => {
    const got = await resolvePortalChurchId(UNKNOWN_HOST, 'central-henderson', supabaseReturning(null));
    expect(got).toBeNull();
  });

  it('allows a real-tenant slug when the host already owns that church', async () => {
    const got = await resolvePortalChurchId(CENTRAL_HOST, 'central-henderson', supabaseReturning(null));
    expect(got).toBe(CENTRAL_HENDERSON_CHURCH_ID);
  });

  it('honours a white-label host resolved through churches.hosts', async () => {
    const whiteLabel = '33333333-3333-3333-3333-333333333333';
    const got = await resolvePortalChurchId('client.example', undefined, supabaseReturning(whiteLabel));
    expect(got).toBe(whiteLabel);
  });

  it('does not let a slug override a white-label host it does not name', async () => {
    const whiteLabel = '33333333-3333-3333-3333-333333333333';
    const got = await resolvePortalChurchId('client.example', 'central-henderson', supabaseReturning(whiteLabel));
    expect(got).toBe(whiteLabel);
  });
});

describe('slug map invariants', () => {
  it('every slug that is NOT a demo church requires host ownership', async () => {
    // The load-bearing invariant: if a future tenant is added to the map and
    // is not a demo church, it must be unreachable by slug alone.
    for (const [slug, churchId] of Object.entries(TENANT_SLUG_CHURCH_IDS)) {
      if (isDemoChurch(churchId)) continue;
      const got = await resolvePortalChurchId(UNKNOWN_HOST, slug, supabaseReturning(null));
      expect(got, `slug '${slug}' reached a non-demo church without host ownership`).toBeNull();
    }
  });

  it('round-trips church -> slug -> church', () => {
    for (const churchId of [FAITHFUL_CHURCH_ID, CENTRAL_HENDERSON_CHURCH_ID]) {
      expect(TENANT_SLUG_CHURCH_IDS[portalTenantSlug(churchId)]).toBe(churchId);
    }
  });
});
