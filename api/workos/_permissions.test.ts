/**
 * Route tests for /api/workos/permissions — specifically the two fields
 * added by migration 068 (GRACE WorkOS goes pastor-only): has_workos_access
 * (the hub's own gate) and hierarchy_tier (a display-only derivation, never
 * used for access control — see the field's own comment in _permissions.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function makeReq() {
  return { method: 'GET', headers: { authorization: 'Bearer valid-token' } } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

beforeEach(async () => {
  vi.resetModules();
  process.env.CLERK_SECRET_KEY = 'test-secret-key';
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  const { verifyToken } = await import('@clerk/backend');
  (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    sub: FIXTURE_STAFF_USER.clerk_id,
    app_metadata: { church_id: FIXTURE_CHURCH_ID },
  });
});

async function runWith(permissionKeys: string[], employmentType: string | null, embedAsArray = false) {
  const handler = (await import('./_permissions.js')).default;
  const supabase = createMockSupabase({
    tables: {
      users: () => ({
        data: {
          id: FIXTURE_STAFF_USER.id,
          account_status: 'active',
          first_name: 'Taylor',
          last_name: 'Testworthy',
          staff_profiles: embedAsArray ? [{ employment_type: employmentType }] : { employment_type: employmentType },
        },
      }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: permissionKeys.map(key => ({ permissions: { key } })) }),
    },
  });
  const { createClient } = await import('@supabase/supabase-js');
  vi.mocked(createClient).mockReturnValue(supabase as never);

  const res = makeRes();
  await handler(makeReq(), res);
  return res.json.mock.calls[0][0];
}

describe('GET /api/workos/permissions — has_workos_access and hierarchy_tier', () => {
  it('grants has_workos_access and the pastor tier for a workos.access holder', async () => {
    const body = await runWith(['workos.access', 'work_orders.manage'], 'staff');
    expect(body.has_workos_access).toBe(true);
    expect(body.hierarchy_tier).toBe('pastor');
  });

  it('is pastor-tier even for a workos.access holder whose employment_type is volunteer', async () => {
    // The real grant beats the organizational label — a Senior Pastor
    // account is never demoted to "volunteer" for holding that field.
    const body = await runWith(['workos.access'], 'volunteer');
    expect(body.hierarchy_tier).toBe('pastor');
  });

  it('denies has_workos_access and derives clergy tier from employment_type when there is no grant', async () => {
    const body = await runWith(['work_orders.view'], 'clergy');
    expect(body.has_workos_access).toBe(false);
    expect(body.hierarchy_tier).toBe('clergy');
  });

  it('derives volunteer tier from employment_type', async () => {
    const body = await runWith([], 'volunteer');
    expect(body.hierarchy_tier).toBe('volunteer');
  });

  it('defaults to staff tier when employment_type is null (no staff_profiles row)', async () => {
    const body = await runWith([], null);
    expect(body.hierarchy_tier).toBe('staff');
  });

  it('handles the staff_profiles embed as an array (PostgREST/typing gotcha — see profileTitle in _areas.ts)', async () => {
    const body = await runWith([], 'clergy', /* embedAsArray */ true);
    expect(body.hierarchy_tier).toBe('clergy');
  });

  it('is_master_admin still keys off admin.manage_settings specifically, distinct from has_workos_access', async () => {
    // A Senior-Pastor-only account (workos.access without
    // admin.manage_settings) must not be reported as master admin.
    const body = await runWith(['workos.access'], 'staff');
    expect(body.has_workos_access).toBe(true);
    expect(body.is_master_admin).toBe(false);
  });
});
