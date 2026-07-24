/**
 * Unit tests for platform event emission (portal event creation).
 */
import { describe, it, expect } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { emitPlatformEvent } from './platformEvents.js';
import { FIXTURE_CHURCH_ID, FIXTURE_PERSON } from '../../tests/fixtures/shared-platform.js';

describe('emitPlatformEvent', () => {
  it('writes a platform_events row with the given event type and payload', async () => {
    const supabase = createMockSupabase({
      tables: {
        platform_events: (op, payload) => ({ data: { id: 'evt-1', ...((payload as { insert?: unknown })) } }),
      },
    });

    const result = await emitPlatformEvent(supabase as never, {
      churchId: FIXTURE_CHURCH_ID,
      eventType: 'care.request.submitted',
      sourceApp: 'member_portal',
      actorPersonId: FIXTURE_PERSON.id,
      subjectType: 'care_request',
      subjectId: 'care-1',
      payload: { category: 'general' },
    });

    expect(result.id).toBe('evt-1');
    expect(result.correlationId).toBeTruthy();
    expect(supabase.from).toHaveBeenCalledWith('platform_events');
  });

  it('generates a correlation id when none is supplied', async () => {
    const supabase = createMockSupabase({
      tables: { platform_events: () => ({ data: { id: 'evt-2' } }) },
    });

    const a = await emitPlatformEvent(supabase as never, {
      churchId: FIXTURE_CHURCH_ID,
      eventType: 'work_order.created',
      sourceApp: 'admin_dashboard',
    });
    const b = await emitPlatformEvent(supabase as never, {
      churchId: FIXTURE_CHURCH_ID,
      eventType: 'work_order.created',
      sourceApp: 'admin_dashboard',
    });

    expect(a.correlationId).not.toBe(b.correlationId);
  });

  it('reuses a supplied correlation id (so an audit row and an event can be tied together)', async () => {
    const supabase = createMockSupabase({
      tables: { platform_events: () => ({ data: { id: 'evt-3' } }) },
    });

    const result = await emitPlatformEvent(supabase as never, {
      churchId: FIXTURE_CHURCH_ID,
      eventType: 'approval.decided',
      sourceApp: 'admin_dashboard',
      correlationId: 'fixed-correlation-id',
    });

    expect(result.correlationId).toBe('fixed-correlation-id');
  });

  it('does not throw when the insert fails — returns a null id instead', async () => {
    const supabase = createMockSupabase({
      tables: { platform_events: () => ({ data: null, error: { message: 'boom' } }) },
    });

    const result = await emitPlatformEvent(supabase as never, {
      churchId: FIXTURE_CHURCH_ID,
      eventType: 'work_order.created',
      sourceApp: 'system',
    });

    expect(result.id).toBeNull();
  });
});
