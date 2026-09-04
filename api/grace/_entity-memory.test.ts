/**
 * Pre-landing review fixes for the entity-memory route (E-1/E-2/E-3).
 *
 * Proof boundary: mocked Supabase, so these assert the route's own logic —
 * which permission it consults, what it puts in the reply, how it resolves a
 * name. They prove nothing about RLS.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

const CHURCH = '11111111-1111-4111-8111-111111111111';

const ROSTER = [
  { id: 'p1', first_name: 'Sarah', last_name: 'Mitchell', status: 'visitor', first_visit: '2026-01-05T00:00:00Z', join_date: null, household_id: null },
  { id: 'p2', first_name: 'Sarah', last_name: 'Chen', status: 'leader', first_visit: null, join_date: '2024-03-01T00:00:00Z', household_id: null },
  { id: 'p3', first_name: 'Bill', last_name: 'Hoffman', status: 'member', first_visit: null, join_date: null, household_id: null },
];

function makeRes() {
  const jsonBodies: unknown[] = [];
  const statuses: number[] = [];
  const res: Record<string, unknown> = {
    setHeader: vi.fn(), removeHeader: vi.fn(), write: vi.fn(), end: vi.fn(), send: vi.fn(),
  };
  res.status = (c: number) => { statuses.push(c); return res; };
  res.json = (b: unknown) => { jsonBodies.push(b); return res; };
  return { res: res as never, jsonBodies, statuses };
}

async function callRoute(name: string, permissionKeys: string[], tasks: unknown[] = []) {
  const inserted: unknown[] = [];
  const securityEvents: unknown[] = [];
  vi.resetModules();
  process.env.CLERK_SECRET_KEY = 'test';
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
  const supabase = createMockSupabase({
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active', person_id: null } }),
      user_roles: () => ({ data: [{ role_id: 'r1' }] }),
      role_permissions: () => ({ data: permissionKeys.map(key => ({ permissions: { key } })) }),
      people: () => ({ data: ROSTER }),
      interactions: () => ({ data: [] }),
      tasks: () => ({ data: tasks }),
      group_memberships: () => ({ data: [] }),
      household_members: () => ({ data: [] }),
      grace_conversations: (op) => op === 'select' ? { data: null } : { data: { id: 'conv-1' } },
      grace_messages: (op, payload) => { if (op === 'insert') inserted.push(payload); return { data: null }; },
      security_events: (op, payload) => { if (op === 'insert') securityEvents.push(payload); return { data: null }; },
      rate_limits: () => ({ data: null }),
    },
  });
  vi.doMock('@clerk/backend', () => ({
    verifyToken: vi.fn().mockResolvedValue({ sub: FIXTURE_STAFF_USER.clerk_id, app_metadata: { church_id: CHURCH } }),
  }));
  vi.doMock('@supabase/supabase-js', () => ({ createClient: vi.fn().mockReturnValue(supabase) }));
  const handler = (await import('./_entity-memory.js')).default;
  const { res, jsonBodies, statuses } = makeRes();
  const req = { method: 'POST', headers: { authorization: 'Bearer t' }, body: { name }, query: {} } as never;
  await handler(req, res);
  return { body: jsonBodies.at(-1) as { status?: string; reply?: string }, status: statuses.at(-1), inserted, securityEvents };
}

beforeEach(() => vi.resetModules());

describe('entity-memory — E-3: ambiguity uses the same matcher as the action path', () => {
  it('a bare first name matching two people ASKS, and names them', async () => {
    const { body } = await callRoute('Sarah', ['people.view']);
    expect(body.status).toBe('ambiguous');
    expect(body.reply).toContain('Sarah Mitchell');
    expect(body.reply).toContain('Sarah Chen');
    // The pre-fix implementation returned "couldn't find a current record".
    expect(body.reply).not.toContain("couldn't find");
  });

  it('a full name still resolves to exactly that person', async () => {
    const { body } = await callRoute('Sarah Chen', ['people.view']);
    expect(body.status).toBe('found');
    expect(body.reply).toContain('Sarah Chen');
    expect(body.reply).not.toContain('Sarah Mitchell');
  });

  it('a name nobody matches is still an honest not-found', async () => {
    const { body } = await callRoute('Nobody Here', ['people.view']);
    expect(body.status).toBe('not_found');
  });
});

describe('entity-memory — E-1: tags never reach the reply', () => {
  it('does not disclose tags, and its no-financial assurance is therefore true', async () => {
    const { body } = await callRoute('Bill Hoffman', ['people.view']);
    expect(body.status).toBe('found');
    expect(body.reply).not.toContain('Tags');
    expect(body.reply).not.toContain('major-donor');
    expect(body.reply).toContain('excludes private pastoral, health, financial, and prayer details');
  });
});

describe('entity-memory — E-2: tasks are gated by tasks.view', () => {
  const TASK = [{ title: 'Follow up after visit', due_date: '2026-09-10T00:00:00Z', priority: 'high' }];

  it('a holder of tasks.view sees open tasks', async () => {
    const { body } = await callRoute('Bill Hoffman', ['people.view', 'tasks.view'], TASK);
    expect(body.reply).toContain('Follow up after visit');
  });

  it('work_orders.view alone no longer unlocks them', async () => {
    const { body } = await callRoute('Bill Hoffman', ['people.view', 'work_orders.view'], TASK);
    expect(body.reply).not.toContain('Follow up after visit');
  });
});

describe('entity-memory — authorization', () => {
  it('refuses a caller without people.view', async () => {
    const { status, body } = await callRoute('Bill Hoffman', []);
    expect(status).toBe(403);
    expect((body as { error?: string }).error).toBe('permission_required');
  });
});

describe('entity-memory — E-4: households are not returned while unqualified', () => {
  it('never mentions a household, matching the capability block injected into every prompt', async () => {
    const { body } = await callRoute('Bill Hoffman', ['people.view', 'households.view']);
    expect(body.status).toBe('found');
    // capability-manifest.ts cap-household is `unavailable`. GRACE must not
    // deny the capability in one turn and exercise it in the next.
    expect(body.reply).not.toContain('Household');
  });
});

describe('entity-memory — E-5: a deterministic answer is still a persisted turn', () => {
  it('writes both sides of the turn to grace_messages', async () => {
    const { inserted } = await callRoute('Bill Hoffman', ['people.view']);
    const rows = inserted.flat() as Array<{ role: string; content: string }>;
    expect(rows.map(r => r.role)).toEqual(['user', 'assistant']);
    expect(rows[0].content).toContain('Bill Hoffman');
    expect(rows[1].content).toContain('Bill Hoffman');
  });

  it('persists the ambiguous turn too, so the follow-up has a referent', async () => {
    const { body, inserted } = await callRoute('Sarah', ['people.view']);
    expect(body.status).toBe('ambiguous');
    const rows = inserted.flat() as Array<{ role: string }>;
    expect(rows.map(r => r.role)).toEqual(['user', 'assistant']);
  });
});

describe('entity-memory — E-6: the read is limited and recorded', () => {
  it('logs the access to security_events, with the person id and never the summary', async () => {
    const { securityEvents } = await callRoute('Bill Hoffman', ['people.view']);
    const rows = securityEvents.flat() as Array<{ event_type: string; severity: string; detail: Record<string, unknown> }>;
    const viewed = rows.find(r => r.event_type === 'grace.person_record_viewed');
    expect(viewed, 'no access event recorded').toBeTruthy();
    expect(viewed!.severity).toBe('info');
    expect(viewed!.detail.person_id).toBe('p3');
    // The record's contents must not be duplicated into the security log.
    expect(JSON.stringify(viewed!.detail)).not.toContain('Status:');
  });
});

describe('entity-memory — E-7: a miss is not an answer', () => {
  it('does NOT persist a not_found turn, so the caller can fall through to the model', async () => {
    const { body, inserted } = await callRoute('our giving this month', ['people.view']);
    expect(body.status).toBe('not_found');
    expect(inserted.flat(), 'a dead end was written into history').toHaveLength(0);
  });

  it('still persists a found turn', async () => {
    const { inserted } = await callRoute('Bill Hoffman', ['people.view']);
    expect(inserted.flat()).toHaveLength(2);
  });
});
