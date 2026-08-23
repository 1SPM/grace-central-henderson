/**
 * Append-only FK cascade smoke test — the empirical proof that migration
 * 054_append_only_fk_cascade_fix.sql actually lets a person be deleted.
 *
 * THE BUG IT GUARDS
 * `member_activity_events.person_id`, `ledger_entries.related_person_id`,
 * and `platform_events.actor_person_id` are all
 * `REFERENCES people(id) ON DELETE SET NULL`. Postgres implements SET NULL
 * as an internal UPDATE on the referencing row — and each of those tables
 * also carries a BEFORE DELETE OR UPDATE trigger that raises to enforce
 * append-only-ness. The FK's own cascade therefore tripped the table's own
 * guard, so `DELETE FROM people WHERE id = …` failed with
 * "member_activity_events is append-only" for ANY member who had activity,
 * giving, or event history.
 *
 * That silently broke two shipped things: `deletePerson()` in
 * src/hooks/useSupabaseData.ts, and the GDPR/CCPA erasure path that
 * `data_subject_requests` (migration 033) exists to drive. Migration 054
 * narrowly permits exactly the UPDATE shape an FK cascade produces and
 * nothing else.
 *
 * Nothing in the test suite covered this, which is how the migration came
 * to be applied to production but never committed. This test is the guard.
 *
 * REQUIRED ENV (skips, and therefore passes, without them):
 *   SUPABASE_TEST_URL
 *   SUPABASE_TEST_SERVICE_ROLE_KEY   # service role: RLS is bypassed, but
 *                                    # triggers still fire — which is the
 *                                    # thing under test
 *   SUPABASE_TEST_TENANT_A_ID        # church UUID to write the fixture into
 *
 * SAFETY
 * Refuses to run against the known production project ref. Point it at a
 * staging project only.
 *
 * RESIDUE — deliberate, not a leak
 * The three child rows this test writes CANNOT be deleted afterwards: that
 * is the whole point of an append-only table, and 054 does not (and must
 * not) relax DELETE. They are tagged `metadata.__smoke_test` /
 * `payload.__smoke_test` so they are easy to identify — note the marker
 * cannot live in `member_activity_events.event_type`, which is CHECK-
 * constrained to a fixed vocabulary. The `people` row IS removed — by the
 * very DELETE under test.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_TEST_URL;
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const CHURCH = process.env.SUPABASE_TEST_TENANT_A_ID;

/** Never let this fixture run against the live project. */
const PRODUCTION_PROJECT_REF = 'asphekfvpiancyltzdxp';
const IS_PRODUCTION = Boolean(URL && URL.includes(PRODUCTION_PROJECT_REF));

const HAS_ENV = Boolean(URL && SERVICE_KEY && CHURCH) && !IS_PRODUCTION;
const it_ = HAS_ENV ? it : it.skip;

const MARKER = { __smoke_test: 'append-only-cascade' } as const;

let db: SupabaseClient;
let personId: string;
let activityId: string;
let ledgerId: string;
let eventId: string;

describe('append-only FK cascade (migration 054)', () => {
  beforeAll(async () => {
    if (IS_PRODUCTION) {
      throw new Error(
        'SUPABASE_TEST_URL points at the production project. This test writes ' +
        'undeletable append-only rows — point it at staging.',
      );
    }
    if (!HAS_ENV) return;

    db = createClient(URL!, SERVICE_KEY!, { auth: { persistSession: false } });

    const stamp = new Date().toISOString();

    const { data: person, error: personErr } = await db
      .from('people')
      .insert({
        church_id: CHURCH,
        first_name: 'Cascade',
        last_name: `Smoke ${Date.now()}`,
        status: 'member',
      })
      .select('id')
      .single();
    if (personErr) throw new Error(`fixture person insert failed: ${personErr.message}`);
    personId = person!.id as string;

    const [activity, ledger, event] = await Promise.all([
      db.from('member_activity_events').insert({
        church_id: CHURCH, person_id: personId,
        // `member_activity_events.event_type` has a CHECK constraint with a
        // fixed vocabulary — an invented value is rejected before the trigger
        // is ever reached. The smoke marker lives in metadata instead.
        event_type: 'login', metadata: MARKER,
      }).select('id, metadata, event_type, created_at').single(),
      db.from('ledger_entries').insert({
        church_id: CHURCH, related_person_id: personId,
        source: 'manual', source_event_id: `smoke-cascade-${personId}`,
        kind: 'adjustment', direction: 'credit', amount_micro_usd: 1,
        occurred_at: stamp, metadata: MARKER,
      }).select('id, amount_micro_usd, metadata').single(),
      db.from('platform_events').insert({
        church_id: CHURCH, actor_person_id: personId,
        event_type: 'smoke_test.cascade', source_app: 'system', payload: MARKER,
      }).select('id, payload, event_type').single(),
    ]);

    for (const [label, r] of [['activity', activity], ['ledger', ledger], ['event', event]] as const) {
      if (r.error) throw new Error(`fixture ${label} insert failed: ${r.error.message}`);
    }
    activityId = activity.data!.id as string;
    ledgerId = ledger.data!.id as string;
    eventId = event.data!.id as string;
  });

  it_('deletes a person who has append-only history — the regression 054 fixes', async () => {
    const { error } = await db.from('people').delete().eq('id', personId);

    // Before 054 this failed with: "member_activity_events is append-only".
    expect(error, error ? `person delete blocked: ${error.message}` : undefined).toBeNull();

    const { data: stillThere } = await db.from('people').select('id').eq('id', personId).maybeSingle();
    expect(stillThere).toBeNull();
  });

  it_('keeps the history, with only the person reference nulled', async () => {
    // The record must survive the person — that is what append-only is for.
    const [{ data: activity }, { data: ledger }, { data: event }] = await Promise.all([
      db.from('member_activity_events').select('id, person_id, event_type, metadata').eq('id', activityId).single(),
      db.from('ledger_entries').select('id, related_person_id, amount_micro_usd, kind, metadata').eq('id', ledgerId).single(),
      db.from('platform_events').select('id, actor_person_id, event_type, payload').eq('id', eventId).single(),
    ]);

    expect(activity?.person_id).toBeNull();
    expect(activity?.event_type).toBe('login');
    expect(activity?.metadata).toEqual(MARKER);

    expect(ledger?.related_person_id).toBeNull();
    expect(ledger?.amount_micro_usd).toBe(1);
    expect(ledger?.kind).toBe('adjustment');

    expect(event?.actor_person_id).toBeNull();
    expect(event?.event_type).toBe('smoke_test.cascade');
    expect(event?.payload).toEqual(MARKER);
  });

  it_('still blocks a direct UPDATE — 054 narrowed the guard, it did not remove it', async () => {
    // An UPDATE that changes anything other than the FK going NOT NULL -> NULL
    // must still raise. This is the property that keeps the ledger trustworthy.
    const { error } = await db
      .from('ledger_entries')
      .update({ amount_micro_usd: 999_999 })
      .eq('id', ledgerId);

    expect(error, 'a direct UPDATE on an append-only table must raise').not.toBeNull();
    expect(error?.message).toMatch(/append-only/i);

    const { data: unchanged } = await db
      .from('ledger_entries').select('amount_micro_usd').eq('id', ledgerId).single();
    expect(unchanged?.amount_micro_usd).toBe(1);
  });

  it_('still blocks a direct DELETE on append-only rows', async () => {
    const { error } = await db.from('member_activity_events').delete().eq('id', activityId);

    expect(error, 'a direct DELETE on an append-only table must raise').not.toBeNull();
    expect(error?.message).toMatch(/append-only/i);

    const { data: survivor } = await db
      .from('member_activity_events').select('id').eq('id', activityId).maybeSingle();
    expect(survivor?.id).toBe(activityId);
  });

  it_('refuses a hand-written null of the FK that also changes another column', async () => {
    // The exemption is shaped precisely to an FK cascade: FK -> NULL and
    // *nothing else* different. Nulling the FK while also editing the row
    // must still raise, or 054 would be a hole rather than a fix.
    const { error } = await db
      .from('platform_events')
      .update({ actor_person_id: null, event_type: 'smoke_test.tampered' })
      .eq('id', eventId);

    expect(error, 'FK-null plus another edit must still raise').not.toBeNull();
    expect(error?.message).toMatch(/append-only/i);
  });
});
