/**
 * Self-signup tenant resolution, name handling, and demo-persona claiming.
 *
 * The first two exist because both tenants' portals are served from one host:
 * before this, finishing Clerk sign-up on the Faithful portal created a person
 * in the real Central Henderson tenant, under the name "New Member".
 *
 * The third is the trap that opens as soon as real people sign up into a demo
 * tenant: its ~189 unclaimed personas carry seeded giving, attendance and care
 * history, and the auto-claim matched on email alone.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const FAITHFUL = '22222222-2222-2222-2222-222222222222';
const CENTRAL = '11111111-1111-1111-1111-111111111111';
const SHARED_HOST = 'grace-members.vercel.app';

const updateUserMetadata = vi.fn();
let insertedPerson: Record<string, unknown> | null = null;
let updatedPerson: Record<string, unknown> | null = null;
let unclaimedRow: Record<string, unknown> | null = null;
let attachFilters: Record<string, unknown> = {};
let attachedDraft: Record<string, unknown> | null = null;
let consentRows: Record<string, unknown>[] = [];
let emitted: string[] = [];

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    users: {
      getUser: vi.fn().mockResolvedValue({
        firstName: null, lastName: null,
        primaryEmailAddressId: 'e1',
        emailAddresses: [{ id: 'e1', emailAddress: 'someone@example.com' }],
        publicMetadata: {},
      }),
      updateUserMetadata,
    },
  }),
}));

vi.mock('../_lib/auth-helper.js', () => ({
  verifyClerkSessionOnly: vi.fn().mockResolvedValue({ ok: true, clerkUserId: 'user_test' }),
}));

vi.mock('../_lib/rateLimit/limiter.js', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(false),
  clientIp: () => '203.0.113.9',
}));

vi.mock('../_lib/platformEvents.js', () => ({
  emitPlatformEvent: vi.fn(async (_c: unknown, e: { eventType: string }) => { emitted.push(e.eventType); }),
}));

// The route makes TWO people lookups that both end in .maybeSingle():
//   1. "is this Clerk user already linked?"  -> .eq('clerk_user_id', id)
//   2. "is there an unclaimed row for this email?" -> .is('clerk_user_id', null)
// The mock has to tell them apart, or setting unclaimedRow makes the route
// short-circuit as already-linked and never reach the claim logic at all.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      // The story attach is a single conditional UPDATE; the test asserts on
      // the filters it was given, because those ARE the security properties.
      if (table === 'visitor_story_drafts') {
        const b: Record<string, unknown> = {};
        const record = (k: string) => (v1: unknown, v2?: unknown) => {
          attachFilters[k] = v2 === undefined ? v1 : { col: v1, val: v2 };
          return b;
        };
        Object.assign(b, {
          update: (payload: Record<string, unknown>) => { attachFilters.update = payload; return b; },
          eq: (col: string, val: unknown) => { attachFilters[`eq:${col}`] = val; return b; },
          is: (col: string, val: unknown) => { attachFilters[`is:${col}`] = val; return b; },
          gt: (col: string, val: unknown) => { attachFilters[`gt:${col}`] = val; return b; },
          select: record('select'),
          maybeSingle: vi.fn(async () => ({ data: attachedDraft, error: null })),
        });
        return b;
      }
      if (table === 'consents' || table === 'communication_preferences') {
        const b: Record<string, unknown> = {};
        const chain = () => b;
        Object.assign(b, {
          upsert: (rows: unknown) => { if (table === 'consents') consentRows = Array.isArray(rows) ? rows as Record<string, unknown>[] : [rows as Record<string, unknown>]; return b; },
          select: chain, eq: chain,
          then: (resolve: (v: unknown) => unknown) => resolve({ data: consentRows, error: null }),
        });
        return b;
      }
      return (() => {
      const builder: Record<string, unknown> = {};
      let isUnclaimedLookup = false;
      const chain = () => builder;
      Object.assign(builder, {
        select: chain, eq: chain, ilike: chain, limit: chain,
        is: (col: string, val: unknown) => {
          if (col === 'clerk_user_id' && val === null) isUnclaimedLookup = true;
          return builder;
        },
        maybeSingle: vi.fn(async () => ({
          data: isUnclaimedLookup ? unclaimedRow : null,
          error: null,
        })),
        single: vi.fn(async () => ({ data: { id: 'person_new' }, error: null })),
        insert: (payload: Record<string, unknown>) => { insertedPerson = payload; return builder; },
        update: (payload: Record<string, unknown>) => { updatedPerson = payload; return builder; },
      });
      return builder;
      })();
    },
  }),
}));

function makeReq(body: unknown, host = SHARED_HOST): VercelRequest {
  return { method: 'POST', headers: { host }, body } as unknown as VercelRequest;
}
function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}
async function callHandler(body: unknown, host = SHARED_HOST) {
  const { default: handler } = await import('./_self-signup.js');
  const res = makeRes();
  await handler(makeReq(body, host), res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  insertedPerson = null; updatedPerson = null; unclaimedRow = null;
  attachFilters = {}; consentRows = []; emitted = [];
  attachedDraft = { id: 'draft_1', consent_followup: true, consent_money_sections: false };
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.CLERK_SECRET_KEY = 'clerk-key';
});

describe('tenant resolution', () => {
  it('creates a FAITHFUL person when the faithful slug is sent on the shared host', async () => {
    await callHandler({ tenant: 'faithful' });
    expect(insertedPerson?.church_id).toBe(FAITHFUL);
  });

  it('creates a CENTRAL person when no slug is sent — unchanged legacy behaviour', async () => {
    await callHandler(undefined);
    expect(insertedPerson?.church_id).toBe(CENTRAL);
  });

  it('refuses to let a slug move a signup into a real tenant it does not own', async () => {
    await callHandler({ tenant: 'central-henderson' }, 'grace-crm-two.vercel.app');
    expect(insertedPerson?.church_id).toBe(FAITHFUL);
  });

  it('rejects a malformed slug rather than silently ignoring it', async () => {
    const res = await callHandler({ tenant: 'Faithful; DROP' });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('preferred name', () => {
  it('uses the walkthrough name instead of the "New Member" placeholder', async () => {
    await callHandler({ tenant: 'faithful', preferred_name: 'Maya Thompson' });
    expect(insertedPerson?.first_name).toBe('Maya Thompson');
    expect(insertedPerson?.last_name).toBe('');
  });

  it('keeps the placeholder when no name was captured', async () => {
    await callHandler({ tenant: 'faithful' });
    expect(insertedPerson?.first_name).toBe('New');
    expect(insertedPerson?.last_name).toBe('Member');
  });

  it('rejects an over-long name', async () => {
    const res = await callHandler({ tenant: 'faithful', preferred_name: 'x'.repeat(81) });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('tags the row so pilot signups stay separable from seeded demo data', async () => {
    await callHandler({ tenant: 'faithful' });
    expect(insertedPerson?.tags).toContain('portal-signup');
  });
});

describe('demo persona auto-claim guard', () => {
  it('REFUSES to claim a seeded demo persona and inserts a fresh person instead', async () => {
    unclaimedRow = { id: 'seeded_maya', tags: ['demo'], self_registered: false };
    await callHandler({ tenant: 'faithful' });
    expect(updatedPerson).toBeNull();
    expect(insertedPerson?.church_id).toBe(FAITHFUL);
  });

  it('claims a real prior connect-card interaction', async () => {
    unclaimedRow = { id: 'visitor_row', tags: ['connect-card', 'source:Friend'], self_registered: false };
    await callHandler({ tenant: 'faithful' });
    expect(updatedPerson).toMatchObject({ clerk_user_id: 'user_test', portal_enabled: true });
    expect(insertedPerson).toBeNull();
  });

  it('claims freely in a real tenant, where unclaimed rows are real records', async () => {
    unclaimedRow = { id: 'staff_entered', tags: [], self_registered: false };
    await callHandler(undefined);
    expect(updatedPerson).not.toBeNull();
    expect(insertedPerson).toBeNull();
  });
});


describe('story attach', () => {
  const withStory = {
    tenant: 'faithful',
    story_draft_id: '11111111-2222-3333-4444-555555555555',
    story_attach_nonce: 'n'.repeat(43),
  };

  it('attaches the draft to the new person', async () => {
    await callHandler(withStory);
    expect(attachFilters.update).toMatchObject({ person_id: 'person_new' });
    expect(attachFilters['eq:id']).toBe(withStory.story_draft_id);
  });

  it('scopes the attach by church — a draft id from another tenant cannot be claimed here', async () => {
    await callHandler(withStory);
    expect(attachFilters['eq:church_id']).toBe(FAITHFUL);
  });

  it('is single-use: requires claimed_at to still be null', async () => {
    await callHandler(withStory);
    expect(attachFilters['is:claimed_at']).toBeNull();
  });

  it('requires the HASHED nonce, never the raw value', async () => {
    await callHandler(withStory);
    expect(attachFilters['eq:attach_nonce_sha256']).toMatch(/^[0-9a-f]{64}$/);
    expect(attachFilters['eq:attach_nonce_sha256']).not.toBe(withStory.story_attach_nonce);
  });

  it('requires the nonce to be unexpired', async () => {
    await callHandler(withStory);
    expect(Date.parse(String(attachFilters['gt:attach_expires_at']))).toBeGreaterThan(0);
  });

  it('clears the nonce so it cannot be replayed', async () => {
    await callHandler(withStory);
    expect(attachFilters.update).toMatchObject({ attach_nonce_sha256: null, attach_expires_at: null });
  });

  it('rejects a malformed nonce before touching the database', async () => {
    const res = await callHandler({ ...withStory, story_attach_nonce: 'short' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(attachFilters.update).toBeUndefined();
  });

  it('rejects a malformed draft id', async () => {
    const res = await callHandler({ ...withStory, story_draft_id: 'not-a-uuid' });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('does not attach when only one of the two values is supplied', async () => {
    await callHandler({ tenant: 'faithful', story_draft_id: withStory.story_draft_id });
    expect(attachFilters.update).toBeUndefined();
  });

  it('STILL CREATES THE ACCOUNT when the attach finds no matching draft', async () => {
    // A research record must never be the reason someone cannot sign up.
    attachedDraft = null;
    const res = await callHandler(withStory);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(insertedPerson?.church_id).toBe(FAITHFUL);
    expect(emitted).toContain('story.attach_failed');
  });

  it('writes consents, recording declines explicitly rather than omitting them', async () => {
    attachedDraft = { id: 'draft_1', consent_followup: false, consent_money_sections: false };
    await callHandler(withStory);
    const byType = Object.fromEntries(consentRows.map(r => [r.consent_type, r.status]));
    expect(byType.pastoral_contact).toBe('denied');
    expect(byType.email).toBe('denied');
    expect(byType.impact_card_communications).toBe('denied');
  });

  it('grants follow-up consent when the member opted in', async () => {
    attachedDraft = { id: 'draft_1', consent_followup: true, consent_money_sections: true };
    await callHandler(withStory);
    const byType = Object.fromEntries(consentRows.map(r => [r.consent_type, r.status]));
    expect(byType.pastoral_contact).toBe('granted');
    expect(byType.impact_card_communications).toBe('granted');
  });

  it('keeps a new pilot participant out of the church directory by default', async () => {
    await callHandler(withStory);
    const byType = Object.fromEntries(consentRows.map(r => [r.consent_type, r.status]));
    expect(byType.directory_visibility).toBe('denied');
  });

  it('emits story.draft_claimed on success', async () => {
    await callHandler(withStory);
    expect(emitted).toContain('story.draft_claimed');
  });
});
