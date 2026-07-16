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

describe('getWorkflow("shepherd") — Member Care', () => {
  it('flags care requests still awaiting assignment or response', async () => {
    const supabase = createMockSupabase({
      tables: {
        care_requests: () => ({
          data: [
            { id: 'cr1', category: 'grief', priority: 'high', status: 'submitted', crisis_flagged: false, created_at: '2026-07-10T00:00:00.000Z' },
            { id: 'cr2', category: 'crisis', priority: 'crisis', status: 'triaged', crisis_flagged: true, created_at: '2026-07-11T00:00:00.000Z' },
          ],
        }),
      },
    });
    const workflow = getWorkflow('shepherd')!;
    const result = await workflow(supabase as never, FIXTURE_CHURCH_ID);

    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].action_type).toBe('flag_unassigned_care_request');
    expect(result.findings.every(f => !('summary' in f.payload))).toBe(true);
    expect(result.summary).toContain('2 care requests awaiting assignment or response');
    expect(result.summary).toContain('1 crisis-flagged');
  });

  it('reports no findings when nothing is awaiting assignment', async () => {
    const supabase = createMockSupabase({ tables: { care_requests: () => ({ data: [] }) } });
    const workflow = getWorkflow('shepherd')!;
    const result = await workflow(supabase as never, FIXTURE_CHURCH_ID);

    expect(result.findings).toHaveLength(0);
    expect(result.summary).toMatch(/no care requests awaiting/i);
  });
});

describe('getWorkflow("steward") — Financial Operations', () => {
  // Dates are relative to real "now" (matching how the workflow itself
  // computes "yesterday") rather than hardcoded calendar dates, so this
  // test stays correct no matter when it actually runs.
  const dayOffset = (daysAgo: number, hour = 12) => {
    const d = new Date(Date.now() - daysAgo * 86_400_000);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  it('flags a reconciliation anomaly from a real ledger spike', async () => {
    const steadyTrailingDays = [2, 3, 4, 5, 6, 7, 8].map(daysAgo => ({
      church_id: FIXTURE_CHURCH_ID,
      source: 'stripe',
      kind: 'donation',
      direction: 'credit' as const,
      amount_micro_usd: 100_000_000, // $100/day, steady
      occurred_at: dayOffset(daysAgo),
    }));
    const yesterdaySpike = {
      church_id: FIXTURE_CHURCH_ID,
      source: 'stripe',
      kind: 'donation',
      direction: 'credit' as const,
      amount_micro_usd: 1_000_000_000, // $1000 — 10x the trailing average
      occurred_at: dayOffset(1),
    };

    const supabase = createMockSupabase({
      tables: { ledger_entries: () => ({ data: [...steadyTrailingDays, yesterdaySpike] }) },
    });
    const workflow = getWorkflow('steward')!;
    const result = await workflow(supabase as never, FIXTURE_CHURCH_ID);

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].action_type).toBe('flag_reconciliation_anomaly');
    expect(result.summary).toMatch(/reconciliation anomal/i);
  });

  it('reports no anomalies when the ledger is empty', async () => {
    const supabase = createMockSupabase({ tables: { ledger_entries: () => ({ data: [] }) } });
    const workflow = getWorkflow('steward')!;
    const result = await workflow(supabase as never, FIXTURE_CHURCH_ID);

    expect(result.findings).toHaveLength(0);
    expect(result.summary).toMatch(/no reconciliation anomalies/i);
  });
});

describe('getWorkflow — unimplemented agents', () => {
  it('returns undefined for an agent with no real workflow (never fabricates one)', () => {
    expect(getWorkflow('herald')).toBeUndefined();
    expect(getWorkflow('welcome')).toBeUndefined();
  });
});
