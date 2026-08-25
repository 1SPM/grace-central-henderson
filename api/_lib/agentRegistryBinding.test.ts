/**
 * Registry ↔ workflow binding test.
 *
 * The agent registry (agentRegistry.ts) and the runnable workflow map
 * (agentWorkflows.ts) are two views of one truth. If they drift, the
 * product lies: an `implemented: true` agent with no workflow renders a
 * live "Run now" button that 501s (the Steve bug, 2026-08); a workflow
 * whose registry entry says `implemented: false` is a runnable agent the
 * UI presents as unbuilt. This test makes that drift a CI failure
 * instead of a production surprise.
 */
import { describe, it, expect } from 'vitest';
import { AGENT_REGISTRY } from './agentRegistry.js';
import { getWorkflow, listWorkflowKeys } from './agentWorkflows.js';

describe('agent registry ↔ workflow map binding', () => {
  it('every implemented registry agent has a runnable workflow', () => {
    const missing = AGENT_REGISTRY
      .filter(a => a.implemented && !getWorkflow(a.key))
      .map(a => a.key);
    expect(missing, `implemented: true but no workflow (dead "Run now" button): ${missing.join(', ')}`).toEqual([]);
  });

  it('every registered-but-unimplemented agent has no workflow', () => {
    const hidden = AGENT_REGISTRY
      .filter(a => !a.implemented && getWorkflow(a.key))
      .map(a => a.key);
    expect(hidden, `workflow exists but registry says unimplemented: ${hidden.join(', ')}`).toEqual([]);
  });

  it('every workflow key has a registry entry', () => {
    const registryKeys = new Set(AGENT_REGISTRY.map(a => a.key));
    const orphans = listWorkflowKeys().filter(k => !registryKeys.has(k));
    expect(orphans, `workflow with no registry entry: ${orphans.join(', ')}`).toEqual([]);
  });
});
