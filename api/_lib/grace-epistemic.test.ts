/**
 * Unit tests for the Epistemic Decision Resolver (ADR-018). Deterministic —
 * pure logic over the action catalog, capability resolver, and a real or
 * synthetic roster, never a model call.
 */
import { describe, it, expect } from 'vitest';
import type { StaffActor } from './authz.js';
import {
  resolvePrecedence,
  modeForEvidenceState,
  resolveActionReadiness,
  detectNameCollisions,
  buildEpistemicContext,
  safeExplanationFor,
  REQUIRED_ACTION_PARAMETERS,
  EVIDENCE_STATE_PRECEDENCE,
  type EvidenceState,
} from './grace-epistemic.js';

function actor(permissions: string[]): StaffActor {
  return {
    kind: 'staff', userId: 'u1', clerkUserId: 'c1', churchId: 'church-1',
    accountStatus: 'active', role: 'staff', permissions: new Set(permissions), personId: null,
  };
}

describe('resolvePrecedence — a weaker state never overrides a stronger one', () => {
  it('PROHIBITED wins over everything else, in any order', () => {
    expect(resolvePrecedence(['SUFFICIENT', 'PROHIBITED', 'MISSING_REQUIRED'])).toBe('PROHIBITED');
    expect(resolvePrecedence(['AMBIGUOUS', 'PROHIBITED'])).toBe('PROHIBITED');
  });

  it('CONFLICTING wins over AMBIGUOUS, which wins over MISSING_REQUIRED', () => {
    expect(resolvePrecedence(['MISSING_REQUIRED', 'AMBIGUOUS', 'CONFLICTING'])).toBe('CONFLICTING');
    expect(resolvePrecedence(['MISSING_REQUIRED', 'AMBIGUOUS'])).toBe('AMBIGUOUS');
  });

  it('SUFFICIENT only wins when nothing else is present', () => {
    expect(resolvePrecedence(['SUFFICIENT'])).toBe('SUFFICIENT');
    expect(resolvePrecedence([])).toBe('SUFFICIENT');
    expect(resolvePrecedence(['SUFFICIENT', 'PARTIAL'])).toBe('PARTIAL');
  });

  it('the precedence table itself lists every evidence state exactly once', () => {
    const all: EvidenceState[] = ['PROHIBITED', 'CONFLICTING', 'AMBIGUOUS', 'MISSING_REQUIRED', 'STALE_OR_UNCLEAR', 'UNSUPPORTED', 'PARTIAL', 'SUFFICIENT'];
    expect(new Set(EVIDENCE_STATE_PRECEDENCE).size).toBe(EVIDENCE_STATE_PRECEDENCE.length);
    expect([...EVIDENCE_STATE_PRECEDENCE].sort()).toEqual([...all].sort());
  });
});

describe('modeForEvidenceState', () => {
  it('maps PROHIBITED and UNSUPPORTED to DECLINE, never a softer mode', () => {
    expect(modeForEvidenceState('PROHIBITED')).toBe('DECLINE');
    expect(modeForEvidenceState('UNSUPPORTED')).toBe('DECLINE');
  });
  it('maps AMBIGUOUS, CONFLICTING, and MISSING_REQUIRED to ASK', () => {
    expect(modeForEvidenceState('AMBIGUOUS')).toBe('ASK');
    expect(modeForEvidenceState('CONFLICTING')).toBe('ASK');
    expect(modeForEvidenceState('MISSING_REQUIRED')).toBe('ASK');
  });
  it('maps PARTIAL and STALE_OR_UNCLEAR to ANSWER_WITH_QUALIFICATION, not a bare ANSWER', () => {
    expect(modeForEvidenceState('PARTIAL')).toBe('ANSWER_WITH_QUALIFICATION');
    expect(modeForEvidenceState('STALE_OR_UNCLEAR')).toBe('ANSWER_WITH_QUALIFICATION');
  });
});

describe('resolveActionReadiness — composes ADR-017 capability, never re-derives it', () => {
  it('an unrecognized action resolves DECLINE/UNSUPPORTED, not ASK', () => {
    const r = resolveActionReadiness('transfer_funds', actor(['*']), {});
    expect(r.mode).toBe('DECLINE');
    expect(r.evidenceState).toBe('UNSUPPORTED');
  });

  it('a real action without permission resolves DECLINE, not a false ASK for missing params', () => {
    const r = resolveActionReadiness('send_email', actor([]), { personName: 'Mary', subject: 'x', body: 'y' });
    expect(r.mode).toBe('DECLINE');
    expect(r.reasonCode).toBe('ACTOR_NOT_AUTHORIZED');
  });

  it('entity ambiguity ASKs before parameter/approval checks even run', () => {
    const r = resolveActionReadiness('delete_person', actor(['people.manage']), { personName: 'John' }, { entityAmbiguous: true });
    expect(r.mode).toBe('ASK');
    expect(r.evidenceState).toBe('AMBIGUOUS');
    expect(r.reasonCode).toBe('MULTIPLE_ENTITY_MATCHES');
  });

  it('an unresolved authoritative conflict ASKs rather than proceeding', () => {
    const r = resolveActionReadiness('update_person_status', actor(['people.manage']), { personName: 'John Smith', status: 'member' }, { unresolvedConflict: true });
    expect(r.mode).toBe('ASK');
    expect(r.evidenceState).toBe('CONFLICTING');
  });

  it('missing a required parameter ASKs and names exactly what is missing', () => {
    const r = resolveActionReadiness('add_event', actor(['events.manage']), { title: 'Fall Festival' });
    expect(r.mode).toBe('ASK');
    expect(r.evidenceState).toBe('MISSING_REQUIRED');
    expect(r.missingRequirements).toContain('startDate');
    expect(r.missingRequirements).not.toContain('title');
  });

  it('a fully-qualified, approval-gated action resolves PROPOSE, never ACT, even with every parameter present', () => {
    const r = resolveActionReadiness('delete_person', actor(['people.manage']), { personName: 'John Smith' });
    expect(r.mode).toBe('PROPOSE');
    expect(r.actionExecutionAllowed).toBe(false);
    expect(r.reasonCode).toBe('APPROVAL_REQUIRED');
  });

  it('a fully-qualified, ungated action with every parameter present resolves ACT', () => {
    const r = resolveActionReadiness('add_task', actor(['tasks.manage']), { title: 'Follow up with the Nguyens' });
    expect(r.mode).toBe('ACT');
    expect(r.actionExecutionAllowed).toBe(true);
  });

  it('clarification is never substituted by routing to approval instead (item 10)', () => {
    // Ambiguous target, but the action itself would ALSO require approval —
    // the readiness result must still be ASK, never PROPOSE.
    const r = resolveActionReadiness('delete_person', actor(['people.manage']), {}, { entityAmbiguous: true });
    expect(r.mode).toBe('ASK');
    expect(r.mode).not.toBe('PROPOSE');
  });

  it('every action catalog entry has a required-parameters list defined (even if empty)', async () => {
    const { ACTION_CATALOG } = await import('./actionCatalog.js');
    for (const a of ACTION_CATALOG.filter((x) => x.surfaces.includes('chat'))) {
      expect(REQUIRED_ACTION_PARAMETERS[a.type], a.type).toBeDefined();
    }
  });
});

describe('detectNameCollisions — structural, from the real roster only', () => {
  it('detects a first-name collision', () => {
    const collisions = detectNameCollisions([
      { id: '1', firstName: 'John', lastName: 'Smith' },
      { id: '2', firstName: 'John', lastName: 'García' },
      { id: '3', firstName: 'Mary', lastName: 'Chen' },
    ]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].firstName).toBe('John');
    expect(collisions[0].matches).toHaveLength(2);
  });

  it('a unique first name produces no collision entry', () => {
    const collisions = detectNameCollisions([{ id: '1', firstName: 'John', lastName: 'Smith' }, { id: '2', firstName: 'Mary', lastName: 'Chen' }]);
    expect(collisions).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    const collisions = detectNameCollisions([{ id: '1', firstName: 'john', lastName: 'Smith' }, { id: '2', firstName: 'JOHN', lastName: 'García' }]);
    expect(collisions).toHaveLength(1);
  });

  it('handles an empty roster without throwing', () => {
    expect(detectNameCollisions([])).toEqual([]);
  });
});

describe('buildEpistemicContext', () => {
  it('lists a real collision by name when present', () => {
    const block = buildEpistemicContext([{ firstName: 'John', matches: [{ id: '1', fullName: 'John Smith' }, { id: '2', fullName: 'John García' }] }]);
    expect(block).toContain('John Smith');
    expect(block).toContain('John García');
  });

  it('states plainly that none were detected when the roster has no collisions', () => {
    const block = buildEpistemicContext([]);
    expect(block).toMatch(/none detected/i);
  });

  it('enumerates required parameters for every chat action', () => {
    const block = buildEpistemicContext([]);
    expect(block).toContain('add_event: requires title, startDate');
    expect(block).toContain('send_sms: requires personName, message');
  });

  it('carries the full response-mode vocabulary and the precedence/pressure-resistance rules', () => {
    const block = buildEpistemicContext([]);
    for (const mode of ['ANSWER', 'ANSWER_WITH_QUALIFICATION', 'ASK', 'DECLINE', 'PROPOSE', 'ACT']) {
      expect(block).toContain(mode);
    }
    expect(block).toMatch(/never changes what evidence you actually have/i);
    expect(block).toMatch(/do not ask a clarifying question that would only help complete it/i);
  });
});

describe('safeExplanationFor — no internal leakage', () => {
  it('every reason code maps to a non-empty explanation except NONE', () => {
    const codes: Array<Parameters<typeof safeExplanationFor>[0]> = [
      'SOURCE_SCOPE_MISMATCH', 'NO_AUTHORITATIVE_SOURCE', 'MULTIPLE_ENTITY_MATCHES', 'REQUIRED_PARAMETER_MISSING',
      'AUTHORITATIVE_CONFLICT', 'MEMORY_SUPERSEDED', 'FRESHNESS_UNKNOWN', 'INFERENCE_NOT_FACT', 'PROHIBITED_INFERENCE',
      'ACTOR_NOT_AUTHORIZED', 'APPROVAL_REQUIRED', 'CAPABILITY_NOT_AVAILABLE', 'TENANT_SCOPE_FAILURE',
    ];
    for (const c of codes) expect(safeExplanationFor(c).length, c).toBeGreaterThan(0);
    expect(safeExplanationFor('NONE')).toBe('');
  });

  it('no explanation leaks internal implementation detail', () => {
    const codes: Array<Parameters<typeof safeExplanationFor>[0]> = [
      'SOURCE_SCOPE_MISMATCH', 'NO_AUTHORITATIVE_SOURCE', 'MULTIPLE_ENTITY_MATCHES', 'REQUIRED_PARAMETER_MISSING',
      'AUTHORITATIVE_CONFLICT', 'MEMORY_SUPERSEDED', 'FRESHNESS_UNKNOWN', 'INFERENCE_NOT_FACT', 'PROHIBITED_INFERENCE',
      'ACTOR_NOT_AUTHORIZED', 'APPROVAL_REQUIRED', 'CAPABILITY_NOT_AVAILABLE', 'TENANT_SCOPE_FAILURE',
    ];
    const forbidden = /\bSUPABASE_|CLERK_|migration \d|fixture[-_]|\bRLS\b|\btenant_id\b|\bchurch_id\b|\breason code\b|\bREASON_CODE\b/i;
    for (const c of codes) expect(safeExplanationFor(c)).not.toMatch(forbidden);
  });
});
