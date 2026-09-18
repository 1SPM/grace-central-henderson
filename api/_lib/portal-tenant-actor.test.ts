/**
 * resolveMemberActor must resolve a member in the same tenant the sign-up that
 * created them used.
 *
 * api/portal/_self-signup.ts honours a tenant slug, so a member who signs up
 * while looking at the Faithful portal is created in Faithful. Reading them back
 * used the Host alone, and grace-members.vercel.app maps to Central Henderson —
 * so that member was written to one tenant and looked up in another, and could
 * never be found again. Their session resolved to null, which (before this) also
 * took the whole onboarding layer down with it.
 *
 * The safety property matters as much as the fix: a slug may select a demo
 * tenant, or the church the Host already owns, and nothing else.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
// Written out rather than imported from portalTenants.js on purpose: that module
// pulls authz.js in through resolveChurchByHost, so importing it at the top of
// this file evaluates authz before beforeEach can set CLERK_SECRET_KEY, and every
// case then fails with "auth not configured" instead of testing anything.
const FAITHFUL_CHURCH_ID = '22222222-2222-2222-2222-222222222222';
const CENTRAL_HENDERSON_CHURCH_ID = '11111111-1111-1111-1111-111111111111';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));

const CLERK_USER = 'user_3Ge90H8';
const SHARED_HOST = 'grace-members.vercel.app'; // maps to Central Henderson

function makeReq(extra: Record<string, unknown> = {}) {
  return {
    headers: { authorization: 'Bearer valid-token', host: SHARED_HOST, ...(extra.headers as object ?? {}) },
    query: extra.query ?? {},
    body: extra.body,
  } as unknown as import('@vercel/node').VercelRequest;
}
const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }) as never;

/** The people row exists in whichever church the query asked for. */
function supabaseWherePersonExists() {
  return createMockSupabase({
    tables: { people: () => ({ data: { id: 'person-1', portal_enabled: true, self_registered: false, staff_reviewed_at: null } }) },
  });
}

beforeEach(async () => {
  process.env.CLERK_SECRET_KEY = 'test-secret-key';
  delete process.env.VITE_ENABLE_DEMO_MODE;   // the demo bypass would skip the path under test
  const { verifyToken } = await import('@clerk/backend');
  (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    sub: CLERK_USER,
    app_metadata: { church_id: CENTRAL_HENDERSON_CHURCH_ID },
  });
});

describe('resolveMemberActor — portal tenant', () => {
  it('without a slug, resolves by Host exactly as before', async () => {
    const { resolveMemberActor } = await import('./authz.js');
    const actor = await resolveMemberActor(makeReq(), makeRes(), supabaseWherePersonExists() as never);
    expect(actor?.churchId).toBe(CENTRAL_HENDERSON_CHURCH_ID);
  });

  it('resolves into the demo tenant when the Faithful portal names it (?tenant=)', async () => {
    const { resolveMemberActor } = await import('./authz.js');
    const actor = await resolveMemberActor(
      makeReq({ query: { tenant: 'faithful' } }), makeRes(), supabaseWherePersonExists() as never);
    expect(actor?.churchId).toBe(FAITHFUL_CHURCH_ID);
  });

  it('falls back to the Referer path, since the static pages fetch without parameters', async () => {
    const { resolveMemberActor } = await import('./authz.js');
    const actor = await resolveMemberActor(
      makeReq({ headers: { referer: `https://${SHARED_HOST}/tenants/faithful/member-portal.html` } }),
      makeRes(), supabaseWherePersonExists() as never);
    expect(actor?.churchId).toBe(FAITHFUL_CHURCH_ID);
  });

  // ── the safety property ────────────────────────────────────────────────
  //
  // The escalation to rule out is a member of one real tenant naming another
  // real tenant's slug. Note what the fallback is when a slug is refused: the
  // church on the caller's OWN Clerk token, never the slug. So "ignored" here
  // means they stay where their token puts them.
  it('a slug can never move a member into a real tenant the Host does not own', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: CLERK_USER,
      app_metadata: { church_id: FAITHFUL_CHURCH_ID },   // a Faithful member...
    });
    const { resolveMemberActor } = await import('./authz.js');
    const req = makeReq({
      headers: { host: 'demo.example.org' },             // ...on a host owning no church...
      query: { tenant: 'central-henderson' },            // ...asking to be Central.
    });
    const supabase = createMockSupabase({
      tables: {
        churches: () => ({ data: null }),
        people: () => ({ data: { id: 'person-1', portal_enabled: true, self_registered: false, staff_reviewed_at: null } }),
      },
    });
    const actor = await resolveMemberActor(req, makeRes(), supabase as never);
    expect(actor?.churchId).toBe(FAITHFUL_CHURCH_ID);
    expect(actor?.churchId).not.toBe(CENTRAL_HENDERSON_CHURCH_ID);
  });

  it('a Faithful member on the shared host cannot become Central by naming its slug', async () => {
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: CLERK_USER,
      app_metadata: { church_id: FAITHFUL_CHURCH_ID },
    });
    const { resolveMemberActor } = await import('./authz.js');
    const res = makeRes();
    // The host DOES own Central, so the slug resolves to Central -- and the
    // lookup then finds no Faithful member there. Selecting a tenant is not
    // access to it; the people row still has to exist.
    const supabase = createMockSupabase({ tables: { people: () => ({ data: null }) } });
    const actor = await resolveMemberActor(
      makeReq({ query: { tenant: 'central-henderson' } }), res, supabase as never);
    expect(actor).toBeNull();
    expect((res as unknown as { status: ReturnType<typeof vi.fn> }).status).toHaveBeenCalledWith(403);
  });

  it('keeps the real tenant when the Host does own it', async () => {
    const { resolveMemberActor } = await import('./authz.js');
    const actor = await resolveMemberActor(
      makeReq({ query: { tenant: 'central-henderson' } }), makeRes(), supabaseWherePersonExists() as never);
    expect(actor?.churchId).toBe(CENTRAL_HENDERSON_CHURCH_ID);
  });

  it('ignores an unknown or malformed slug rather than failing the request', async () => {
    const { resolveMemberActor } = await import('./authz.js');
    for (const tenant of ['not-a-tenant', '../../etc', 'FAITHFUL', '']) {
      const actor = await resolveMemberActor(
        makeReq({ query: { tenant } }), makeRes(), supabaseWherePersonExists() as never);
      expect(actor?.churchId).toBe(CENTRAL_HENDERSON_CHURCH_ID);
    }
  });

  it('still refuses a member with no row in the resolved tenant', async () => {
    const { resolveMemberActor } = await import('./authz.js');
    const res = makeRes();
    const supabase = createMockSupabase({ tables: { people: () => ({ data: null }) } });
    const actor = await resolveMemberActor(makeReq({ query: { tenant: 'faithful' } }), res, supabase as never);
    expect(actor).toBeNull();
    expect((res as unknown as { status: ReturnType<typeof vi.fn> }).status).toHaveBeenCalledWith(403);
  });
});
