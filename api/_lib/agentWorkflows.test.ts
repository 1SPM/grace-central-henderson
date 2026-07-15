/**
 * Unit tests for the real, recorded agent workflows (agent-run test).
 * Confirms findings are derived from the rows a mock Supabase client
 * returns — not randomized, not simulated.
 */
import { describe, it, expect } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { getWorkflow } from './agentWorkflows.js';
import { FIXTURE_CHURCH_ID } from '../../tests/fixtures/shared-platform.js';

describe('getWorkflow("grace") — WorkOS Orchestrator', () => {
  it('reports zero findings and a calm summary when nothing needs attention', async () => {
    const supabase = createMockSupabase({
      tables: {
        tasks: () => ({ data: [] }),
        work_orders: () => ({ data: [] }),
        approvals: () => ({ data: [] }),
      },
    });
    const workflow = getWorkflow('grace')!;
    const result = await workflow(supabase as never, FIXTURE_CHURCH_ID);

    expect(result.findings).toHaveLength(0);
    expect(result.summary).toMatch(/no overdue tasks/i);
  });

  it('surfaces overdue tasks, blocked Work Orders, and stale approvals as findings — real rows, not fabricated', async () => {
    const supabase = createMockSupabase({
      tables: {
        tasks: () => ({ data: [{ id: 't1', title: 'Follow up with visitor', due_date: '2026-07-01' }] }),
        work_orders: () => ({ data: [{ id: 'wo1', title: 'Youth retreat planning' }] }),
        approvals: () => ({ data: [{ id: 'a1', proposed_action: 'Send fall newsletter', requested_at: '2026-07-01T00:00:00.000Z' }] }),
      },
    });
    const workflow = getWorkflow('grace')!;
    const result = await workflow(supabase as never, FIXTURE_CHURCH_ID);

    expect(result.findings).toHaveLength(3);
    expect(result.findings.map(f => f.action_type)).toEqual(
      expect.arrayContaining(['flag_overdue_task', 'flag_blocked_work_order', 'flag_stale_approval']),
    );
    expect(result.summary).toContain('1 overdue task');
    expect(result.summary).toContain('1 blocked Work Order');
  });
});

describe('getWorkflow("verity") — Quality Review', () => {
  it('flags members with no contact info and Work Orders with no owner', async () => {
    const supabase = createMockSupabase({
      tables: {
        people: () => ({ data: [{ id: 'p1', first_name: 'Jordan', last_name: 'Rivera' }] }),
        work_orders: () => ({ data: [{ id: 'wo1', title: 'Impact Card pilot' }] }),
      },
    });
    const workflow = getWorkflow('verity')!;
    const result = await workflow(supabase as never, FIXTURE_CHURCH_ID);

    expect(result.findings).toHaveLength(2);
    expect(result.summary).toContain('no email or phone on file');
    expect(result.summary).toContain('no owner assigned');
  });
});

describe('getWorkflow("sentinel") — Privacy and Compliance', () => {
  it('flags data-subject requests pending over 7 days', async () => {
    const supabase = createMockSupabase({
      tables: {
        data_subject_requests: () => ({ data: [{ id: 'dsr1', request_type: 'data_export', requested_at: '2026-06-01T00:00:00.000Z' }] }),
      },
    });
    const workflow = getWorkflow('sentinel')!;
    const result = await workflow(supabase as never, FIXTURE_CHURCH_ID);

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].action_type).toBe('flag_stale_data_subject_request');
    expect(result.summary).toContain('pending over 7 days');
  });

  it('reports no findings when there is nothing stale', async () => {
    const supabase = createMockSupabase({ tables: { data_subject_requests: () => ({ data: [] }) } });
    const workflow = getWorkflow('sentinel')!;
    const result = await workflow(supabase as never, FIXTURE_CHURCH_ID);

    expect(result.findings).toHaveLength(0);
    expect(result.summary).toMatch(/no overdue data-subject requests/i);
  });
});

describe('getWorkflow — unimplemented agents', () => {
  it('returns undefined for an agent with no real workflow (never fabricates one)', () => {
    expect(getWorkflow('shepherd')).toBeUndefined();
    expect(getWorkflow('herald')).toBeUndefined();
  });
});
