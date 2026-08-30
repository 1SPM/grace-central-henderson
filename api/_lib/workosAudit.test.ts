/**
 * Unit tests for audit-row creation on the WorkOS routes.
 */
import { describe, it, expect, vi } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { recordAudit } from './workosAudit.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

describe('recordAudit — audit creation', () => {
  it('writes an audit_logs row carrying actor, action, resource, and correlation id', async () => {
    const insertSpy = vi.fn(() => ({ data: { id: 'audit-1' }, error: null }));
    const supabase = createMockSupabase({ tables: { audit_logs: insertSpy } });

    await recordAudit(supabase as never, {
      churchId: FIXTURE_CHURCH_ID,
      actorUserId: FIXTURE_STAFF_USER.id,
      actorClerkId: FIXTURE_STAFF_USER.clerk_id,
      action: 'create',
      entityType: 'work_order',
      entityId: 'wo-1',
      after: { title: 'Sunday setup checklist' },
      correlationId: 'corr-1',
      route: '/api/work-orders',
      method: 'POST',
    });

    expect(supabase.from).toHaveBeenCalledWith('audit_logs');
    const insertCall = (supabase.from('audit_logs').insert as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(insertCall).toMatchObject({
      church_id: FIXTURE_CHURCH_ID,
      actor_user_id: FIXTURE_STAFF_USER.id,
      action: 'create',
      entity_type: 'work_order',
      entity_id: 'wo-1',
      correlation_id: 'corr-1',
    });
  });

  it('allows a null actor_user_id for member-self-service actions (no users row exists)', async () => {
    const supabase = createMockSupabase({ tables: { audit_logs: () => ({ data: { id: 'audit-2' } }) } });

    await recordAudit(supabase as never, {
      churchId: FIXTURE_CHURCH_ID,
      actorUserId: null,
      actorClerkId: 'user_test_member_0001',
      action: 'update',
      entityType: 'consent',
      entityId: 'consent-1',
      sourceApp: 'member_portal',
      reason: 'member self-service',
    });

    const insertCall = (supabase.from('audit_logs').insert as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(insertCall).toMatchObject({ actor_user_id: null, source_app: 'member_portal', reason: 'member self-service' });
  });

  // Still does not throw (a committed mutation must not be retried into a
  // duplicate), but it no longer returns void and swallows: the outcome is
  // reported so a caller that cares can surface it.
  it('logs and reports, without throwing, when the insert fails', async () => {
    const supabase = createMockSupabase({
      tables: {
        audit_logs: () => ({ data: null, error: { message: 'db unreachable' } }),
        security_events: () => ({ data: null }),
      },
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      recordAudit(supabase as never, {
        churchId: FIXTURE_CHURCH_ID,
        actorUserId: FIXTURE_STAFF_USER.id,
        action: 'create',
        entityType: 'work_order',
      }),
    ).resolves.toMatchObject({ ok: false });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

/**
 * Failure behaviour. recordAudit used to swallow insert errors and return
 * void, so a mutation could commit with no audit row and nothing anywhere
 * would say so. It still does not throw — by the time it runs the mutation
 * has usually already committed, and failing the request would trade a
 * missing audit row for a duplicated side effect on retry — but the
 * failure is now reported to the caller and escalated to a different
 * append-only table.
 */
describe('recordAudit — failure handling', () => {
  const INPUT = {
    churchId: FIXTURE_CHURCH_ID,
    actorUserId: FIXTURE_STAFF_USER.id,
    actorClerkId: FIXTURE_STAFF_USER.clerk_id,
    action: 'update',
    entityType: 'work_order',
    entityId: 'wo-1',
    route: '/api/approvals',
  };

  function failingAudit(message = 'insert blew up') {
    return createMockSupabase({
      tables: {
        audit_logs: () => ({ error: { message } }),
        security_events: () => ({ data: null }),
      },
    });
  }

  it('reports success when the row is written', async () => {
    const supabase = createMockSupabase({ tables: { audit_logs: () => ({ data: { id: 'a1' }, error: null }) } });

    const result = await recordAudit(supabase as never, INPUT);

    expect(result).toEqual({ ok: true });
    expect(supabase.__calls.filter(c => c.table === 'security_events')).toHaveLength(0);
  });

  it('reports failure to the caller instead of swallowing it', async () => {
    const result = await recordAudit(failingAudit() as never, INPUT);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('insert blew up');
  });

  it('escalates a failed audit write to security_events', async () => {
    // A different table on purpose: if the failure is specific to
    // audit_logs, the fact that it happened still lands somewhere durable.
    const supabase = failingAudit();
    await recordAudit(supabase as never, INPUT);

    const events = supabase.__calls.filter(c => c.table === 'security_events' && c.op === 'insert');
    expect(events).toHaveLength(1);
    const event = events[0].payload as Record<string, unknown>;
    expect(event.event_type).toBe('audit.write_failed');
    expect(event.severity).toBe('critical');
    expect((event.detail as Record<string, unknown>).entity_type).toBe('work_order');
  });

  it('keeps the raw Postgres message out of the PII-free detail', async () => {
    // Postgres errors can quote offending row values, e.g.
    // "(email)=(someone@example.com)". security_events.detail is PII-free
    // by contract, so the message belongs in the log, not the row.
    const leaky = 'duplicate key violates constraint DETAIL: Key (email)=(someone@example.com) already exists.';
    const supabase = failingAudit(leaky);

    await recordAudit(supabase as never, INPUT);

    const event = supabase.__calls.find(c => c.table === 'security_events' && c.op === 'insert')!.payload;
    expect(JSON.stringify(event)).not.toContain('someone@example.com');
  });

  it('never throws, so a committed mutation is not retried into a duplicate', async () => {
    await expect(recordAudit(failingAudit() as never, INPUT)).resolves.toMatchObject({ ok: false });
  });

  it('recordAuditOrThrow throws for callers that must refuse to proceed unaudited', async () => {
    const { recordAuditOrThrow } = await import('./workosAudit.js');
    await expect(recordAuditOrThrow(failingAudit() as never, INPUT)).rejects.toThrow(/audit write failed/);
    const ok = createMockSupabase({ tables: { audit_logs: () => ({ data: { id: 'a1' }, error: null }) } });
    await expect(recordAuditOrThrow(ok as never, INPUT)).resolves.toBeUndefined();
  });
});
