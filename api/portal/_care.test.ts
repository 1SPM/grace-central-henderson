/**
 * Route test for POST /api/portal/care — proves the crisis notification
 * path is called for a crisis-flagged submission, and that a thrown
 * error from it never fails the member's submission (the response is
 * still 201 with the care_requests row created).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_PERSON } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('../_lib/crisisNotify.js', () => ({ notifyCrisisStaff: vi.fn() }));

function makeReq(body: unknown) {
  return { method: 'POST', headers: { authorization: 'Bearer valid-token' }, body } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.CLERK_SECRET_KEY = 'test-secret-key';
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  const { verifyToken } = await import('@clerk/backend');
  (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    sub: FIXTURE_PERSON.clerk_user_id,
    app_metadata: { church_id: FIXTURE_CHURCH_ID },
  });
});

function crisisSubmissionBody() {
  return {
    category: 'crisis',
    message: 'I need help right away',
    preferred_contact_method: 'phone',
    requests_human_followup: true,
    visibility: 'private_pastoral_care',
  };
}

describe('POST /api/portal/care — crisis notification', () => {
  it('calls notifyCrisisStaff for a crisis-flagged submission', async () => {
    const handler = (await import('./_care.js')).default;
    const { notifyCrisisStaff } = await import('../_lib/crisisNotify.js');
    (notifyCrisisStaff as ReturnType<typeof vi.fn>).mockResolvedValue({ recipients: 1, emailsSent: 1, smsSent: 0 });

    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: FIXTURE_PERSON.id, portal_enabled: true } }),
        care_requests: () => ({ data: { id: 'care-1', category: 'crisis', priority: 'crisis' } }),
        platform_events: () => ({ data: { id: 'fixture-platform-event-id' } }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq(crisisSubmissionBody()), res);

    expect(notifyCrisisStaff).toHaveBeenCalledTimes(1);
    expect(notifyCrisisStaff).toHaveBeenCalledWith(expect.anything(), FIXTURE_CHURCH_ID, expect.any(String));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('a thrown notifyCrisisStaff error never fails the submission', async () => {
    const handler = (await import('./_care.js')).default;
    const { notifyCrisisStaff } = await import('../_lib/crisisNotify.js');
    (notifyCrisisStaff as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('resend down'));

    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: FIXTURE_PERSON.id, portal_enabled: true } }),
        care_requests: () => ({ data: { id: 'care-1', category: 'crisis', priority: 'crisis' } }),
        platform_events: () => ({ data: { id: 'fixture-platform-event-id' } }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(makeReq(crisisSubmissionBody()), res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body).toBeDefined();
  });

  it('does not call notifyCrisisStaff for a non-crisis submission', async () => {
    const handler = (await import('./_care.js')).default;
    const { notifyCrisisStaff } = await import('../_lib/crisisNotify.js');

    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: { id: FIXTURE_PERSON.id, portal_enabled: true } }),
        care_requests: () => ({ data: { id: 'care-2', category: 'general', priority: 'medium' } }),
        platform_events: () => ({ data: { id: 'fixture-platform-event-id' } }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const res = makeRes();
    await handler(
      makeReq({
        category: 'general',
        message: 'Just checking in',
        preferred_contact_method: 'email',
        requests_human_followup: false,
        visibility: 'private_pastoral_care',
      }),
      res,
    );

    expect(notifyCrisisStaff).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
