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

  it('logs and does not throw when the insert fails', async () => {
    const supabase = createMockSupabase({
      tables: { audit_logs: () => ({ data: null, error: { message: 'db unreachable' } }) },
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      recordAudit(supabase as never, {
        churchId: FIXTURE_CHURCH_ID,
        actorUserId: FIXTURE_STAFF_USER.id,
        action: 'create',
        entityType: 'work_order',
      }),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
