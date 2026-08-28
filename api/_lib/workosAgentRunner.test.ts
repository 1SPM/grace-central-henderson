/**
 * The shared WorkOS agent run path.
 *
 * Two callers drive this — a human clicking "Run now" and the nightly
 * cron — so the properties worth pinning are the ones that must hold
 * identically for both: a real run row either way, isolation between
 * agents, and the fail-closed posture on approval-requiring findings.
 */
import { describe, it, expect } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID } from '../../tests/fixtures/shared-platform.js';
import {
  implementedAgentKeys,
  runWorkosAgentForChurch,
  runAllWorkosAgentsForChurch,
} from './workosAgentRunner.js';
import { AGENT_REGISTRY } from './agentRegistry.js';
import { getWorkflow } from './agentWorkflows.js';

function emptyScanSupabase() {
  return createMockSupabase({
    tables: {
      agent_runs: () => ({ data: { id: 'run-1' } }),
      agent_actions: () => ({ data: null }),
      agent_findings: () => ({ data: [] }),
      platform_events: () => ({ data: { id: 'evt-1' } }),
      // Every workflow's own reads come back empty — this suite is about
      // the run mechanics, not what any individual scanner finds.
      tasks: () => ({ data: [] }),
      work_orders: () => ({ data: [] }),
      approvals: () => ({ data: [] }),
      people: () => ({ data: [] }),
      care_requests: () => ({ data: [] }),
      data_subject_requests: () => ({ data: [] }),
      ledger_entries: () => ({ data: [] }),
    },
  });
}

describe('implementedAgentKeys', () => {
  it('is exactly the registry agents that have a runnable workflow', () => {
    const keys = implementedAgentKeys();
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(getWorkflow(key), `${key} should have a workflow`).toBeDefined();
      expect(AGENT_REGISTRY.find(a => a.key === key)?.implemented).toBe(true);
    }
    // Never schedules an agent the registry calls unbuilt.
    const unbuilt = AGENT_REGISTRY.filter(a => !a.implemented).map(a => a.key);
    for (const key of unbuilt) expect(keys).not.toContain(key);
  });
});

describe('runWorkosAgentForChurch', () => {
  it('records a real run row and reports the summary', async () => {
    const supabase = emptyScanSupabase();
    const outcome = await runWorkosAgentForChurch(
      supabase as never, FIXTURE_CHURCH_ID, 'verity', { kind: 'cron' },
    );

    expect(outcome.status).toBe('succeeded');
    expect(outcome.runId).toBe('run-1');
    const inserts = supabase.__calls.filter(c => c.table === 'agent_runs' && c.op === 'insert');
    expect(inserts).toHaveLength(1);
    expect((inserts[0].payload as Record<string, unknown>).agent_key).toBe('verity');
  });

  it('attributes a cron sweep distinctly from a person clicking Run now', async () => {
    const cronRun = emptyScanSupabase();
    await runWorkosAgentForChurch(cronRun as never, FIXTURE_CHURCH_ID, 'verity', { kind: 'cron' });
    const cronInput = (cronRun.__calls.find(c => c.table === 'agent_runs' && c.op === 'insert')!
      .payload as Record<string, Record<string, unknown>>).input;
    expect(cronInput.triggered_by).toBe('cron');

    const userRun = emptyScanSupabase();
    await runWorkosAgentForChurch(userRun as never, FIXTURE_CHURCH_ID, 'verity', { kind: 'user', userId: 'user-7' });
    const userInput = (userRun.__calls.find(c => c.table === 'agent_runs' && c.op === 'insert')!
      .payload as Record<string, Record<string, unknown>>).input;
    expect(userInput.triggered_by).toBe('user-7');
  });

  it('refuses an agent with no workflow without writing a run row', async () => {
    const supabase = emptyScanSupabase();
    const outcome = await runWorkosAgentForChurch(
      supabase as never, FIXTURE_CHURCH_ID, 'herald', { kind: 'cron' },
    );

    expect(outcome).toEqual({ agentKey: 'herald', runId: null, status: 'failed', error: 'agent_not_implemented' });
    expect(supabase.__calls.filter(c => c.table === 'agent_runs' && c.op === 'insert')).toHaveLength(0);
  });

  it('marks the run failed and returns the reason when the workflow throws', async () => {
    const supabase = createMockSupabase({
      tables: {
        agent_runs: () => ({ data: { id: 'run-1' } }),
        // A scanner read that blows up mid-workflow.
        tasks: () => { throw new Error('boom'); },
        work_orders: () => ({ data: [] }),
        approvals: () => ({ data: [] }),
      },
    });

    const outcome = await runWorkosAgentForChurch(
      supabase as never, FIXTURE_CHURCH_ID, 'grace', { kind: 'cron' },
    );

    expect(outcome.status).toBe('failed');
    const updates = supabase.__calls.filter(c => c.table === 'agent_runs' && c.op === 'update');
    expect(updates).toHaveLength(1);
    expect((updates[0].payload as Record<string, unknown>).status).toBe('failed');
  });
});

describe('runAllWorkosAgentsForChurch', () => {
  it('runs every implemented agent and returns one outcome each', async () => {
    const supabase = emptyScanSupabase();
    const outcomes = await runAllWorkosAgentsForChurch(supabase as never, FIXTURE_CHURCH_ID, { kind: 'cron' });

    expect(outcomes.map(o => o.agentKey).sort()).toEqual(implementedAgentKeys().sort());
    expect(outcomes.every(o => o.status === 'succeeded')).toBe(true);
  });

  it('one agent failing does not abort the rest of the sweep', async () => {
    // `tasks` only feeds the orchestrator; every other scanner reads
    // elsewhere, so exactly one agent should fail and the rest complete.
    const supabase = createMockSupabase({
      tables: {
        agent_runs: () => ({ data: { id: 'run-1' } }),
        agent_actions: () => ({ data: null }),
        agent_findings: () => ({ data: [] }),
        platform_events: () => ({ data: { id: 'evt-1' } }),
        tasks: () => { throw new Error('boom'); },
        work_orders: () => ({ data: [] }),
        approvals: () => ({ data: [] }),
        people: () => ({ data: [] }),
        care_requests: () => ({ data: [] }),
        data_subject_requests: () => ({ data: [] }),
        ledger_entries: () => ({ data: [] }),
      },
    });

    const outcomes = await runAllWorkosAgentsForChurch(supabase as never, FIXTURE_CHURCH_ID, { kind: 'cron' });

    expect(outcomes).toHaveLength(implementedAgentKeys().length);
    expect(outcomes.filter(o => o.status === 'failed')).toHaveLength(1);
    expect(outcomes.filter(o => o.status === 'succeeded').length).toBeGreaterThan(0);
  });
});
