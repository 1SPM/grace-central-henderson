/**
 * Demo-bypass host gating.
 *
 * The anonymous demo bypass (resolveDemoStaffActor / resolveDemoMemberActor)
 * grants a system_administrator role for the resolved church. It must
 * therefore never activate on a real client's hostname.
 *
 * It previously did. isDemoModeActive() was derived from HOST_CHURCH_IDS,
 * and Central Henderson's hostname has to be in that map so the public,
 * token-less Connect Card can resolve its church — so an unauthenticated
 * request to the live tenant's own domain was handed a system_administrator
 * actor scoped to real congregation data. TECH_DEBT.md TD-043 asserted this
 * could not happen ("that hostname will never match HOST_CHURCH_IDS"); it
 * did. These tests make the invariant mechanically enforced rather than
 * asserted in prose, which is what failed last time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest } from '@vercel/node';
// resolveDemoChurchId / resolveStaffActor are imported dynamically per-test
// (they read env captured at module load); these are the env-independent
// shape assertions.
import { isDemoModeActive, DEMO_HOSTS, HOST_CHURCH_IDS } from './authz.js';

const FAITHFUL_CHURCH_ID = '22222222-2222-2222-2222-222222222222';
const CENTRAL_HENDERSON_HOST = 'gracecrm-centralhenderson.org';
const CENTRAL_HENDERSON_CHURCH_ID = '11111111-1111-1111-1111-111111111111';

function reqForHost(host: string | undefined): VercelRequest {
  return { headers: { host } } as unknown as VercelRequest;
}

// DEMO_MODE / DEMO_CHURCH_ID are captured at module load, so a test that
// needs a specific configuration sets the env vars and re-imports the
// module after vi.resetModules() — same pattern as authz.test.ts. The
// statically imported symbols above are used only where ambient env is
// irrelevant (the map/set shape assertions).
beforeEach(() => {
  // Never inherit ambient env: a developer or CI runner exporting
  // VITE_ENABLE_DEMO_MODE=true would otherwise flip these tests for the
  // wrong reason.
  vi.resetModules();
  delete process.env.VITE_ENABLE_DEMO_MODE;
  delete process.env.VITE_DEFAULT_CHURCH_ID;
});

afterEach(() => {
  delete process.env.VITE_ENABLE_DEMO_MODE;
  delete process.env.VITE_DEFAULT_CHURCH_ID;
});

describe('isDemoModeActive — host gating', () => {
  it('does NOT activate for the live client hostname', () => {
    expect(isDemoModeActive(reqForHost(CENTRAL_HENDERSON_HOST))).toBe(false);
  });

  it('activates for each known demo host', () => {
    for (const host of DEMO_HOSTS) {
      expect(isDemoModeActive(reqForHost(host)), `${host} should be a demo host`).toBe(true);
    }
  });

  it('does not activate for an unknown host or a missing Host header', () => {
    expect(isDemoModeActive(reqForHost('evil.example.com'))).toBe(false);
    expect(isDemoModeActive(reqForHost(undefined))).toBe(false);
  });
});

describe('DEMO_HOSTS ↔ HOST_CHURCH_IDS — the invariant that broke', () => {
  it('never contains a hostname belonging to a non-demo church', () => {
    // The bypass grants system_administrator for whichever church the host
    // resolves to, so every demo host must map to a demo tenant.
    const offenders = [...DEMO_HOSTS].filter(
      host => HOST_CHURCH_IDS[host] && HOST_CHURCH_IDS[host] !== FAITHFUL_CHURCH_ID,
    );
    expect(offenders, `demo hosts pointing at a non-demo church: ${offenders.join(', ')}`).toEqual([]);
  });

  it('specifically excludes the live client hostname', () => {
    expect(DEMO_HOSTS.has(CENTRAL_HENDERSON_HOST)).toBe(false);
  });

  it('still resolves the live client hostname to its church for Connect Card intake', () => {
    // HOST_CHURCH_IDS keeps answering "which church owns this hostname?" —
    // resolveChurchByHost.ts depends on this for public, token-less intake.
    expect(HOST_CHURCH_IDS[CENTRAL_HENDERSON_HOST]).toBe(CENTRAL_HENDERSON_CHURCH_ID);
  });
});

describe('resolveDemoChurchId — defence in depth', () => {
  it('resolves a demo host to its demo church', async () => {
    const { resolveDemoChurchId: resolve } = await import('./authz.js');
    expect(resolve(reqForHost('grace-crm.dev'))).toBe(FAITHFUL_CHURCH_ID);
  });

  // These reproduce the configuration docs/DEPLOY.md documents for
  // Production: VITE_ENABLE_DEMO_MODE=true and VITE_DEFAULT_CHURCH_ID set
  // to Central Henderson (a LIVE client). Under that config the env var
  // alone satisfies isDemoModeActive() for every host, so host gating is
  // not enough on its own — resolveDemoChurchId must refuse to name a
  // non-demo church. Without the DEMO_CHURCH_IDS guard these fail and an
  // unauthenticated caller gets a system_administrator actor on real
  // congregation data from any hostname.
  describe('under the documented production env (demo mode ON, default church = a live client)', () => {
    it('refuses to resolve the live client hostname to its own church', async () => {
      process.env.VITE_ENABLE_DEMO_MODE = 'true';
      process.env.VITE_DEFAULT_CHURCH_ID = CENTRAL_HENDERSON_CHURCH_ID;
      const { resolveDemoChurchId: resolve } = await import('./authz.js');

      expect(resolve(reqForHost(CENTRAL_HENDERSON_HOST))).toBeUndefined();
    });

    it('refuses to fall back to a live client church for an unmapped host', async () => {
      process.env.VITE_ENABLE_DEMO_MODE = 'true';
      process.env.VITE_DEFAULT_CHURCH_ID = CENTRAL_HENDERSON_CHURCH_ID;
      const { resolveDemoChurchId: resolve } = await import('./authz.js');

      expect(resolve(reqForHost('evil.example.com'))).toBeUndefined();
      expect(resolve(reqForHost(undefined))).toBeUndefined();
    });

    it('still serves genuine demo hosts', async () => {
      process.env.VITE_ENABLE_DEMO_MODE = 'true';
      process.env.VITE_DEFAULT_CHURCH_ID = CENTRAL_HENDERSON_CHURCH_ID;
      const { resolveDemoChurchId: resolve } = await import('./authz.js');

      expect(resolve(reqForHost('grace-crm.dev'))).toBe(FAITHFUL_CHURCH_ID);
    });

    it('honours VITE_DEFAULT_CHURCH_ID when it names a demo church', async () => {
      process.env.VITE_ENABLE_DEMO_MODE = 'true';
      process.env.VITE_DEFAULT_CHURCH_ID = FAITHFUL_CHURCH_ID;
      const { resolveDemoChurchId: resolve } = await import('./authz.js');

      expect(resolve(reqForHost('localhost:5173'))).toBe(FAITHFUL_CHURCH_ID);
    });
  });
});

describe('resolveStaffActor — fails closed on a live tenant under production env', () => {
  it('does not create a demo users row or grant sysadmin when the church is a live client', async () => {
    process.env.VITE_ENABLE_DEMO_MODE = 'true';
    process.env.VITE_DEFAULT_CHURCH_ID = CENTRAL_HENDERSON_CHURCH_ID;
    const { resolveStaffActor } = await import('./authz.js');
    const { createMockSupabase } = await import('../../tests/fixtures/mockSupabase.js');

    const supabase = createMockSupabase({
      tables: {
        users: () => ({ data: { id: 'demo-user-row-id', account_status: 'active' } }),
        roles: () => ({ data: { id: 'sysadmin-role-id' } }),
        user_roles: () => ({ data: [{ id: 'grant-1', role_id: 'sysadmin-role-id' }] }),
        role_permissions: () => ({ data: [{ permissions: { key: 'care.view' } }] }),
      },
    });
    const res = { status: vi.fn(() => res), json: vi.fn(() => res) } as never;

    const actor = await resolveStaffActor(
      reqForHost(CENTRAL_HENDERSON_HOST),
      res,
      supabase as never,
    );

    expect(actor).toBeNull();
    expect(supabase.__calls.filter(c => c.table === 'users' && c.op === 'insert')).toHaveLength(0);
    expect(supabase.__calls.filter(c => c.table === 'user_roles' && c.op === 'insert')).toHaveLength(0);
  });
});
