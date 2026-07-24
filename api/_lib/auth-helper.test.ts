import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest } from '@vercel/node';

const { verifyToken } = vi.hoisted(() => ({ verifyToken: vi.fn() }));
vi.mock('@clerk/backend', () => ({ verifyToken }));

process.env.CLERK_SECRET_KEY = 'sk_test_dummy';

const { requireClerkAuth } = await import('./auth-helper.js');

function reqWithBearer(): VercelRequest {
  return { headers: { authorization: 'Bearer token' } } as unknown as VercelRequest;
}

describe('requireClerkAuth role resolution', () => {
  beforeEach(() => {
    verifyToken.mockReset();
  });

  it('prefers app_metadata.role over the flat "authenticated" claim from the supabase JWT template', async () => {
    // Real payload shape observed from Clerk's Third-Party Auth "supabase"
    // template: it stamps a required top-level role: "authenticated" (the
    // Postgres role for RLS) alongside the real app role under app_metadata.
    verifyToken.mockResolvedValue({
      sub: 'user_1',
      role: 'authenticated',
      app_metadata: { role: 'admin', church_id: 'church-1' },
    });

    const result = await requireClerkAuth(reqWithBearer());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.role).toBe('admin');
  });

  it('still honors a flat role claim when it is not the reserved "authenticated" value', async () => {
    verifyToken.mockResolvedValue({
      sub: 'user_1',
      role: 'staff',
      church_id: 'church-1',
    });

    const result = await requireClerkAuth(reqWithBearer());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.role).toBe('staff');
  });

  it('resolves to an empty role when neither claim is usable', async () => {
    verifyToken.mockResolvedValue({
      sub: 'user_1',
      role: 'authenticated',
      church_id: 'church-1',
    });

    const result = await requireClerkAuth(reqWithBearer());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.role).toBe('');
  });
});
