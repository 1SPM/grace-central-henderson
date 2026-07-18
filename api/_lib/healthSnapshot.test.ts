/**
 * Tests for the IO wrapper around healthMetrics — proves the snapshot
 * write uses upsert-on-conflict (church_id, snapshot_date) so running
 * the nightly job twice in one day produces one row, not two (the
 * actual uniqueness is enforced by the health_snapshots UNIQUE
 * constraint from migration 048; this proves the code requests that
 * semantics correctly on every call, not just the first).
 */
import { describe, it, expect } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { snapshotHealthForChurch } from './healthSnapshot.js';

const CHURCH_ID = 'church-1';
const NOW = new Date('2026-07-18T12:00:00.000Z');

function fakeSupabase() {
  return createMockSupabase({
    tables: {
      people: () => ({ data: [] }),
      recurring_giving: () => ({ data: [] }),
      group_memberships: () => ({ data: [] }),
      care_requests: () => ({ data: [] }),
      member_activity_events: () => ({ data: [] }),
      health_snapshots: () => ({ data: null }),
    },
  });
}

describe('snapshotHealthForChurch', () => {
  it('upserts with onConflict church_id,snapshot_date on every call', async () => {
    const supabase = fakeSupabase();

    await snapshotHealthForChurch(supabase as never, CHURCH_ID, NOW);
    await snapshotHealthForChurch(supabase as never, CHURCH_ID, NOW);

    const upsertSpy = supabase.from('health_snapshots').upsert as unknown as { mock: { calls: unknown[][] } };
    expect(upsertSpy.mock.calls).toHaveLength(2);
    for (const call of upsertSpy.mock.calls) {
      const [payload, options] = call as [Record<string, unknown>, { onConflict: string }];
      expect(payload.church_id).toBe(CHURCH_ID);
      expect(payload.snapshot_date).toBe('2026-07-18');
      expect(options).toEqual({ onConflict: 'church_id,snapshot_date' });
    }
  });

  it('computes real metrics from the fetched rows before upserting', async () => {
    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: [{ id: 'p1', status: 'member', first_visit: null, portal_enabled: true, clerk_user_id: 'c1', first_name: 'A', last_name: 'B' }] }),
        recurring_giving: () => ({ data: [{ person_id: 'p1' }] }),
        group_memberships: () => ({ data: [] }),
        care_requests: () => ({ data: [] }),
        member_activity_events: () => ({ data: [] }),
        health_snapshots: () => ({ data: null }),
      },
    });

    const metrics = await snapshotHealthForChurch(supabase as never, CHURCH_ID, NOW);
    expect(metrics.recurring_coverage).toEqual(expect.objectContaining({ value: 100, source: 'computed' }));

    const upsertSpy = supabase.from('health_snapshots').upsert as unknown as { mock: { calls: unknown[][] } };
    const [payload] = upsertSpy.mock.calls[0] as [Record<string, unknown>];
    expect((payload.metrics as Record<string, unknown>).recurring_coverage).toEqual(
      expect.objectContaining({ value: 100 }),
    );
  });
});
