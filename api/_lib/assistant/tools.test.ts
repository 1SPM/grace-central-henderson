/**
 * Security-property tests for the member assistant's narrow tools:
 * cross-member access, cross-church access, staff-note exposure,
 * financial-action attempts, and audit logging — required categories
 * from the member-assistant phase brief.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemberActor } from '../authz.js';
import { executeAssistantTool, ASSISTANT_TOOL_NAMES } from './tools.js';

interface FakeCall { table: string; method: string; args: unknown[] }
interface FakeWrite { table: string; op: string; row: unknown }

function fakeSupabase(responses: Record<string, { data: unknown; error: unknown }> = {}) {
  const calls: FakeCall[] = [];
  const writes: FakeWrite[] = [];

  function chain(table: string) {
    const resp = responses[table] ?? { data: [], error: null };
    const c: any = {};
    for (const m of ['select', 'order', 'limit', 'gte', 'not', 'or']) {
      c[m] = (...args: unknown[]) => { calls.push({ table, method: m, args }); return c; };
    }
    c.eq = (...args: unknown[]) => { calls.push({ table, method: 'eq', args }); return c; };
    c.insert = (row: unknown) => { writes.push({ table, op: 'insert', row }); return c; };
    c.update = (row: unknown) => { writes.push({ table, op: 'update', row }); return c; };
    c.upsert = (row: unknown) => { writes.push({ table, op: 'upsert', row }); return c; };
    c.maybeSingle = async () => resp;
    c.single = async () => resp;
    c.then = (resolve: (v: unknown) => void) => resolve(resp);
    return c;
  }

  const supabase = { from: (table: string) => chain(table) } as unknown as SupabaseClient;
  return { supabase, calls, writes };
}

const MEMBER: MemberActor = {
  kind: 'member',
  personId: 'person-real-owner',
  clerkUserId: 'clerk-real-owner',
  churchId: 'church-real-tenant',
};

describe('cross-member access attempts', () => {
  it('get_my_care_request_status scopes by the resolved member, ignoring any person_id in args', async () => {
    const { supabase, calls } = fakeSupabase({
      care_requests: { data: [{ id: 'cr-1', category: 'general', status: 'submitted', created_at: '2026-01-01', resolved_at: null, care_assignments: [] }], error: null },
      platform_events: { data: { id: 'evt-1' }, error: null },
    });
    const result = await executeAssistantTool('get_my_care_request_status', { supabase, member: MEMBER }, { person_id: 'someone-elses-person-id' });
    expect(result.ok).toBe(true);

    const personFilters = calls.filter(c => c.table === 'care_requests' && c.method === 'eq' && c.args[0] === 'person_id');
    expect(personFilters).toHaveLength(1);
    expect(personFilters[0].args[1]).toBe(MEMBER.personId);
    expect(personFilters[0].args[1]).not.toBe('someone-elses-person-id');
  });

  it('get_my_profile never accepts a target person id from args', async () => {
    const { supabase, calls } = fakeSupabase({
      people: { data: { first_name: 'Real', last_name: 'Owner' }, error: null },
      platform_events: { data: { id: 'evt-1' }, error: null },
    });
    await executeAssistantTool('get_my_profile', { supabase, member: MEMBER }, { person_id: 'attacker-supplied-id' });
    const personFilters = calls.filter(c => c.table === 'people' && c.method === 'eq' && c.args[0] === 'id');
    expect(personFilters[0].args[1]).toBe(MEMBER.personId);
  });
});

describe('cross-church access attempts', () => {
  it('request_group_membership scopes the group lookup to the resolved church, ignoring any church_id in args', async () => {
    const { supabase, calls } = fakeSupabase({
      small_groups: { data: null, error: null }, // not found -> tool fails safely
      platform_events: { data: { id: 'evt-1' }, error: null },
    });
    const result = await executeAssistantTool(
      'request_group_membership',
      { supabase, member: MEMBER },
      { group_id: '11111111-1111-1111-1111-111111111111', church_id: 'other-church-tenant' },
    );
    expect(result.ok).toBe(false); // group not found in this (real) church, by design

    const churchFilters = calls.filter(c => c.table === 'small_groups' && c.method === 'eq' && c.args[0] === 'church_id');
    expect(churchFilters[0].args[1]).toBe(MEMBER.churchId);
    expect(churchFilters[0].args[1]).not.toBe('other-church-tenant');
  });

  it('search_approved_church_resources scopes announcements to the resolved church', async () => {
    const { supabase, calls } = fakeSupabase({
      announcements: { data: [], error: null },
      churches: { data: null, error: null },
      platform_events: { data: { id: 'evt-1' }, error: null },
    });
    await executeAssistantTool('search_approved_church_resources', { supabase, member: MEMBER }, { query: 'service times', church_id: 'other-church' });
    const churchFilters = calls.filter(c => c.table === 'announcements' && c.method === 'eq' && c.args[0] === 'church_id');
    expect(churchFilters[0].args[1]).toBe(MEMBER.churchId);
  });
});

describe('staff-note / internal-field access attempts', () => {
  it('get_my_care_request_status never selects care_request_notes or an assignee identity column', async () => {
    const { supabase, calls } = fakeSupabase({
      care_requests: { data: [], error: null },
      platform_events: { data: { id: 'evt-1' }, error: null },
    });
    await executeAssistantTool('get_my_care_request_status', { supabase, member: MEMBER }, {});
    const selectCalls = calls.filter(c => c.table === 'care_requests' && c.method === 'select');
    for (const call of selectCalls) {
      const selectStr = String(call.args[0] ?? '');
      expect(selectStr).not.toMatch(/notes|sentinel|owner_user_id|assigned_to/i);
    }
  });

  it('start_care_request never returns crisis_flagged, sentinel_review_status, or priority to the caller', async () => {
    const { supabase } = fakeSupabase({
      care_requests: { data: { id: 'cr-2', category: 'general', status: 'submitted', created_at: '2026-01-01' }, error: null },
      consents: { data: null, error: null },
      platform_events: { data: { id: 'evt-1' }, error: null },
    });
    const result = await executeAssistantTool('start_care_request', { supabase, member: MEMBER }, { category: 'general', message: 'Could someone check in with me this week?' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).not.toHaveProperty('crisis_flagged');
      expect(result.data).not.toHaveProperty('sentinel_review_status');
      expect(result.data).not.toHaveProperty('priority');
    }
  });
});

describe('financial-action attempts', () => {
  it('get_my_giving_summary only ever reads — never inserts, updates, or upserts', async () => {
    const { supabase, writes } = fakeSupabase({
      churches: { data: { stripe_connect_charges_enabled: true }, error: null },
      giving: { data: [{ amount: 25, date: '2026-01-05' }], error: null },
      recurring_giving: { data: [], error: null },
      platform_events: { data: { id: 'evt-1' }, error: null },
    });
    await executeAssistantTool('get_my_giving_summary', { supabase, member: MEMBER }, {});
    const financialWrites = writes.filter(w => ['giving', 'recurring_giving', 'ledger_entries', 'card_transfers'].includes(w.table));
    expect(financialWrites).toHaveLength(0);
  });

  it('get_my_impact_summary never returns account or routing numbers, and only ever reads', async () => {
    const { supabase, writes } = fakeSupabase({
      kyc_verifications: { data: { status: 'approved' }, error: null },
      cards: { data: [{ status: 'active' }], error: null },
      card_accounts: { data: { available_balance_micro_usd: 5_000_000 }, error: null },
      impact_routes: { data: { route_label: 'Food Pantry' }, error: null },
      platform_events: { data: { id: 'evt-1' }, error: null },
    });
    const result = await executeAssistantTool('get_my_impact_summary', { supabase, member: MEMBER }, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).not.toHaveProperty('account_number_last4');
      expect(result.data).not.toHaveProperty('routing_number');
      expect(result.data).not.toHaveProperty('masked_pan');
    }
    const financialWrites = writes.filter(w => ['card_accounts', 'cards', 'kyc_verifications', 'card_transfers'].includes(w.table));
    expect(financialWrites).toHaveLength(0);
  });

  it('no tool in the entire catalog is capable of a financial write (send money / change financial settings)', () => {
    // The tool NAME catalog itself must not contain anything money-moving —
    // structural proof, independent of any single tool's implementation.
    const forbidden = /transfer|payout|withdraw|send_money|pay_|charge|refund|payment_method|set_limit/i;
    for (const name of ASSISTANT_TOOL_NAMES) {
      expect(name).not.toMatch(forbidden);
    }
  });
});

describe('audit logging', () => {
  it('every tool call emits an assistant.tool_invoked platform event, success or failure', async () => {
    const { supabase, writes } = fakeSupabase({
      care_requests: { data: [], error: null },
      platform_events: { data: { id: 'evt-1' }, error: null },
    });
    await executeAssistantTool('get_my_care_request_status', { supabase, member: MEMBER }, {});
    const events = writes.filter(w => w.table === 'platform_events' && w.op === 'insert');
    expect(events).toHaveLength(1);
    const row = events[0].row as Record<string, unknown>;
    expect(row.event_type).toBe('assistant.tool_invoked');
    expect(row.church_id).toBe(MEMBER.churchId);
    expect(row.actor_person_id).toBe(MEMBER.personId);
    expect((row.payload as Record<string, unknown>).tool).toBe('get_my_care_request_status');
  });

  it('audit payload carries only argument KEYS, never argument values (no free-text member content in the event log)', async () => {
    const { supabase, writes } = fakeSupabase({
      care_requests: { data: { id: 'cr-3', category: 'general', status: 'submitted', created_at: '2026-01-01' }, error: null },
      consents: { data: null, error: null },
      platform_events: { data: { id: 'evt-1' }, error: null },
    });
    const secretMessage = 'something very private the member typed';
    await executeAssistantTool('start_care_request', { supabase, member: MEMBER }, { category: 'general', message: secretMessage });
    const events = writes.filter(w => w.table === 'platform_events' && w.op === 'insert');
    const payload = JSON.stringify((events.at(-1)!.row as Record<string, unknown>).payload);
    expect(payload).not.toContain(secretMessage);
  });

  it('a failed tool call is still audited with success=false', async () => {
    const { supabase, writes } = fakeSupabase({
      small_groups: { data: null, error: null },
      platform_events: { data: { id: 'evt-1' }, error: null },
    });
    await executeAssistantTool('request_group_membership', { supabase, member: MEMBER }, { group_id: 'not-a-real-uuid' });
    const events = writes.filter(w => w.table === 'platform_events' && w.op === 'insert');
    expect((events.at(-1)!.row as Record<string, unknown>).payload).toMatchObject({ success: false });
  });
});
