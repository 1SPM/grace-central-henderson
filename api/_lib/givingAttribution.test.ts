/**
 * Regression tests for the giving-attribution guard (members-portal audit,
 * Phase 1). The vulnerability: api/giving/create-payment-intent and
 * create-subscription are deliberately anonymous public endpoints, and
 * used to accept a client-supplied person_id after checking only that the
 * id belonged to *some* member of the target church — not that it
 * belonged to the caller. An anonymous request could attribute a gift to
 * any person_id it could guess or scrape from a roster page.
 *
 * verifyGivingPersonId closes that: person_id is honoured only when the
 * caller's own Clerk session resolves to that exact person. Every failure
 * mode below must drop attribution (return null) rather than throw or
 * silently trust the caller — a verification hiccup should never block a
 * legitimate anonymous donor's payment, so the function degrades to "no
 * attribution", never to an error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));

const CHURCH_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_CHURCH_ID = '22222222-2222-2222-2222-222222222222';
const CALLER_CLERK_ID = 'user_caller';
const CALLER_PERSON_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_PERSON_ID = 'bbbbbbbb-0000-0000-0000-000000000002';

function reqWithBearer(token: string | undefined): import('@vercel/node').VercelRequest {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as unknown as import('@vercel/node').VercelRequest;
}

function supabaseWithPerson(personId: string | null) {
  return createMockSupabase({
    tables: {
      people: () => ({ data: personId ? { id: personId } : null, error: null }),
    },
  });
}

beforeEach(() => {
  process.env.CLERK_SECRET_KEY = 'test-secret-key';
});

describe('verifyGivingPersonId', () => {
  it('returns null immediately when no person_id was claimed (the public-donor path)', async () => {
    const { verifyGivingPersonId } = await import('./givingAttribution.js');
    const { verifyToken } = await import('@clerk/backend');
    const supabase = supabaseWithPerson(CALLER_PERSON_ID);

    const result = await verifyGivingPersonId(reqWithBearer(undefined), supabase as never, CHURCH_ID, null);

    expect(result).toBeNull();
    expect(verifyToken).not.toHaveBeenCalled(); // no wasted verification for anonymous donors
  });

  it('drops attribution when the caller sends no bearer token at all — the original spoofing case', async () => {
    const { verifyGivingPersonId } = await import('./givingAttribution.js');
    const supabase = supabaseWithPerson(CALLER_PERSON_ID);

    const result = await verifyGivingPersonId(reqWithBearer(undefined), supabase as never, CHURCH_ID, OTHER_PERSON_ID);

    expect(result).toBeNull();
  });

  it('drops attribution when the token is invalid or expired', async () => {
    const { verifyGivingPersonId } = await import('./givingAttribution.js');
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('invalid token'));
    const supabase = supabaseWithPerson(CALLER_PERSON_ID);

    const result = await verifyGivingPersonId(reqWithBearer('garbage'), supabase as never, CHURCH_ID, CALLER_PERSON_ID);

    expect(result).toBeNull();
  });

  it('drops attribution when the token belongs to a different church', async () => {
    const { verifyGivingPersonId } = await import('./givingAttribution.js');
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: CALLER_CLERK_ID,
      app_metadata: { church_id: OTHER_CHURCH_ID },
    });
    const supabase = supabaseWithPerson(CALLER_PERSON_ID);

    const result = await verifyGivingPersonId(reqWithBearer('valid'), supabase as never, CHURCH_ID, CALLER_PERSON_ID);

    expect(result).toBeNull();
  });

  it('drops attribution when an authenticated member claims a DIFFERENT member’s person_id — the exact attack this guard exists for', async () => {
    const { verifyGivingPersonId } = await import('./givingAttribution.js');
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: CALLER_CLERK_ID,
      app_metadata: { church_id: CHURCH_ID },
    });
    // The caller's own person row really does exist and belongs to this
    // church — they just aren't the person they're claiming to be.
    const supabase = supabaseWithPerson(CALLER_PERSON_ID);

    const result = await verifyGivingPersonId(reqWithBearer('valid'), supabase as never, CHURCH_ID, OTHER_PERSON_ID);

    expect(result).toBeNull();
  });

  it('drops attribution when the church has no matching person row for this Clerk user', async () => {
    const { verifyGivingPersonId } = await import('./givingAttribution.js');
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: CALLER_CLERK_ID,
      app_metadata: { church_id: CHURCH_ID },
    });
    const supabase = supabaseWithPerson(null);

    const result = await verifyGivingPersonId(reqWithBearer('valid'), supabase as never, CHURCH_ID, CALLER_PERSON_ID);

    expect(result).toBeNull();
  });

  it('verifies and returns the id when the caller genuinely is that person — the happy path', async () => {
    const { verifyGivingPersonId } = await import('./givingAttribution.js');
    const { verifyToken } = await import('@clerk/backend');
    (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: CALLER_CLERK_ID,
      app_metadata: { church_id: CHURCH_ID },
    });
    const supabase = supabaseWithPerson(CALLER_PERSON_ID);

    const result = await verifyGivingPersonId(reqWithBearer('valid'), supabase as never, CHURCH_ID, CALLER_PERSON_ID);

    expect(result).toBe(CALLER_PERSON_ID);
  });
});
