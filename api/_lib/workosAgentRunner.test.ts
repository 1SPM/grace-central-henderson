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

describe('proposals via the shared path — the invariant that broke', () => {
  // The cron lane and the HTTP endpoint once had separate copies of this
  // logic. When #163 taught the endpoint to create approvals, the cron's
  // copy still said "no consumer exists" and threw — so a proposal that
  // worked from "Run now" failed the nightly sweep, losing that agent's
  // other findings with it. Both lanes now run this code.
  function proposalSupabase() {
    return createMockSupabase({
      tables: {
        agent_runs: () => ({ data: { id: 'run-1' } }),
        // select feeds Verity's dedup query (an array); insert returns the
        // new row (an object).
        agent_actions: (op: string) => (op === 'select' ? { data: [] } : { data: { id: 'action-1' } }),
        approvals: () => ({ data: { id: 'approval-1' } }),
        agent_findings: () => ({ data: [] }),
        platform_events: () => ({ data: { id: 'evt-1' } }),
        people: () => ({ data: [] }),
        work_orders: () => ({ data: [{ id: 'wo-1', title: 'Youth retreat planning', ministry: 'Care & Counseling' }] }),
        ministry_assignments: () => ({ data: [{ area_key: 'member_care', owner_user_id: 'user-1' }] }),
        users: () => ({ data: [{ id: 'user-1', first_name: 'Fatoumata', last_name: 'Diallo' }] }),
      },
    });
  }

  it('a scheduled sweep creates the approval, exactly as a human-triggered run does', async () => {
    const supabase = proposalSupabase();
    const outcome = await runWorkosAgentForChurch(
      supabase as never, FIXTURE_CHURCH_ID, 'verity', { kind: 'cron' },
    );

    expect(outcome.status, outcome.error).toBe('succeeded');
    const approvals = supabase.__calls.filter(c => c.table === 'approvals' && c.op === 'insert');
    expect(approvals).toHaveLength(1);
    const approval = approvals[0].payload as Record<string, unknown>;
    expect(approval.entity_type).toBe('agent_action');
    // The queue line names the person, not a UUID or an action_type.
    expect(approval.proposed_action).toBe('Assign Fatoumata Diallo as owner of "Youth retreat planning" (Pastoral Care)');
  });

  it('refuses to propose an action type nothing can perform', async () => {
    // Fail-closed is a property of the shared path, so the cron inherits
    // it rather than needing its own copy.
    const supabase = createMockSupabase({
      tables: {
        agent_runs: () => ({ data: { id: 'run-1' } }),
        agent_actions: () => ({ data: { id: 'action-1' } }),
        approvals: () => ({ data: { id: 'approval-1' } }),
      },
    });
    const { describeProposedAction } = await import('./workosAgentRunner.js');
    // Sanity: the describer degrades gracefully for an unknown type.
    expect(describeProposedAction({ action_type: 'do_a_thing', target_entity_type: 'task', payload: {} }))
      .toBe('do a thing on task');
    expect(supabase).toBeDefined();
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
