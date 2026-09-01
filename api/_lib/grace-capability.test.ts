/**
 * Unit tests for the Capability Claim Resolver and Capability Context
 * builder (ADR-017). These are deterministic — the resolver is pure logic
 * over the manifest + a server-resolved actor, never a model call.
 */
import { describe, it, expect } from 'vitest';
import type { StaffActor } from './authz.js';
import { resolveDataCapability, resolveActionCapability, isCapabilityMetaQuestion, buildCapabilityContext } from './grace-capability.js';
import { PILOT_CAPABILITY_MANIFEST, KNOWN_CAPABILITY_GAPS, PROHIBITED_CAPABILITIES, QUALIFIED_CHURCH_ID } from './capability-manifest.js';
// Test-only cross-check against the eval-harness's own (Prompt 8) manifest
// — production code (this file's non-test siblings) never imports from
// tools/eval-harness; a test file doing so for a drift check is fine.
import { PILOT_CAPABILITY_MANIFEST as EVAL_MANIFEST } from '../../tools/eval-harness/central-henderson-exam/requalification/pilot-capability-manifest.js';

const OTHER_CHURCH_ID = '22222222-2222-2222-2222-222222222222';

function actor(permissions: string[], churchId: string = QUALIFIED_CHURCH_ID): StaffActor {
  return {
    kind: 'staff', userId: 'u1', clerkUserId: 'c1', churchId,
    accountStatus: 'active', role: 'staff', permissions: new Set(permissions), personId: null,
  };
}

describe('resolveDataCapability', () => {
  it('a PROVEN, no-permission-required entry resolves qualified', () => {
    const r = resolveDataCapability('cap-identity-know', actor([]));
    expect(r.status).toBe('qualified');
  });

  it('a permission-gated entry resolves permission_required when the actor lacks it', () => {
    const r = resolveDataCapability('cap-comms-send-email', actor([]));
    expect(r.status).toBe('permission_required');
  });

  it('the same entry resolves qualified once the actor holds the permission', () => {
    const r = resolveDataCapability('cap-comms-send-email', actor(['communications.send']));
    expect(r.status).toBe('qualified');
  });

  it('an approval-required entry resolves approval_required even with full permission', () => {
    const r = resolveDataCapability('cap-comms-send-sms', actor(['communications.send']));
    expect(r.status).toBe('approval_required');
  });

  it('approval takes precedence over a missing permission (approval_required, not permission_required)', () => {
    const r = resolveDataCapability('cap-comms-send-sms', actor([]));
    expect(r.status).toBe('approval_required');
  });

  it('a known gap resolves its documented status, never qualified', () => {
    const r = resolveDataCapability('cap-household', actor(['people.manage']));
    expect(r.status).toBe('unavailable');
    expect(r.reason).toBe('not_yet_proven');
  });

  it('an unrecognized capability id resolves unknown, never fabricated', () => {
    const r = resolveDataCapability('cap-does-not-exist', actor([]));
    expect(r.status).toBe('unknown');
  });

  it('no actor (unauthenticated) never resolves qualified', () => {
    const r = resolveDataCapability('cap-identity-know', null);
    expect(r.status).not.toBe('qualified');
  });

  it('every manifest entry is reachable and every known gap is reachable', () => {
    for (const e of PILOT_CAPABILITY_MANIFEST) {
      expect(resolveDataCapability(e.capabilityId, actor([e.permissionKey ?? ''])).status).not.toBe('unknown');
    }
    for (const g of KNOWN_CAPABILITY_GAPS) {
      expect(resolveDataCapability(g.capabilityId, actor([])).status).not.toBe('unknown');
    }
  });
});

describe('resolveActionCapability', () => {
  it('a real, ungated chat action resolves qualified with permission', () => {
    const r = resolveActionCapability('add_event', actor(['events.manage']));
    expect(r.status).toBe('qualified');
  });

  it('the same action without permission resolves permission_required, not unavailable', () => {
    const r = resolveActionCapability('add_event', actor([]));
    expect(r.status).toBe('permission_required');
  });

  it('a gated action (delete_person) resolves approval_required even with permission', () => {
    const r = resolveActionCapability('delete_person', actor(['people.manage']));
    expect(r.status).toBe('approval_required');
  });

  it('a non-existent action type resolves unavailable, not permission_required (capability does not exist at all)', () => {
    const r = resolveActionCapability('transfer_funds', actor(['*']));
    expect(r.status).toBe('unavailable');
    expect(r.reason).toBe('not_a_recognized_capability');
  });

  it('an agent-only action (not on the chat surface) is not resolvable as a chat capability', () => {
    const r = resolveActionCapability('assign_work_order_owner', actor(['work_orders.manage']));
    expect(r.status).toBe('unavailable');
  });
});

describe('isCapabilityMetaQuestion — routing capability vs. data questions', () => {
  it('recognizes capability/meta phrasing', () => {
    for (const q of [
      'What can you do?',
      'What can you help me with?',
      'Can you see our giving data?',
      'Are you allowed to see that?',
      'Do you know our attendance?',
      'Why can\'t you tell me our revenue?',
      'Can you schedule volunteers?',
      'What do you remember about me?',
    ]) {
      expect(isCapabilityMetaQuestion(q), q).toBe(true);
    }
  });

  it('does NOT flag ordinary church-data requests as meta questions', () => {
    for (const q of [
      'What was giving last month?',
      'Add a task to call the Nguyens Friday.',
      'Who visited this week?',
      'Show me active prayer requests.',
      'What events are coming up?',
    ]) {
      expect(isCapabilityMetaQuestion(q), q).toBe(false);
    }
  });
});

describe('buildCapabilityContext — server-composed, actor-scoped', () => {
  it('is non-empty and includes at least one qualified capability for a broadly-permissioned actor', () => {
    const block = buildCapabilityContext(actor(['communications.send', 'people.manage', 'tasks.manage', 'care.manage', 'events.manage']));
    expect(block).toContain('YOUR CAPABILITY BOUNDARY');
    expect(block).toContain('QUALIFIED AND AUTHORIZED');
  });

  it('lists permission-dependent capabilities separately for a narrowly-permissioned actor', () => {
    const block = buildCapabilityContext(actor([]));
    expect(block).toContain('DOES NOT AUTHORIZE IT');
  });

  it('always includes the known-gaps section, regardless of actor', () => {
    const block = buildCapabilityContext(actor([]));
    expect(block).toContain('KNOWN GAPS');
    for (const g of KNOWN_CAPABILITY_GAPS) expect(block).toContain(g.userFacingLabel);
  });

  it('never mentions Sunday/worship volunteer scheduling or WorkOS visibility inside the QUALIFIED section', () => {
    const block = buildCapabilityContext(actor(['communications.send', 'people.manage', 'tasks.manage', 'care.manage', 'events.manage']));
    const qualifiedSection = block.split('YOU ARE QUALIFIED AND AUTHORIZED FOR')[1]?.split(/\n\n[A-Z]/)[0] ?? '';
    expect(qualifiedSection.toLowerCase()).not.toContain('volunteer');
    expect(qualifiedSection.toLowerCase()).not.toContain('decision queue');
  });

  it('carries an explicit non-override guardrail sentence', () => {
    const block = buildCapabilityContext(actor([]));
    expect(block).toMatch(/sole source of truth for capability questions/i);
    expect(block).toMatch(/access is decided by the server/i);
  });

  it('handles a null (unauthenticated) actor without throwing, and grants nothing qualified', () => {
    const block = buildCapabilityContext(null);
    expect(block).not.toContain('YOU ARE QUALIFIED AND AUTHORIZED FOR');
  });
});

describe('tenant isolation (item 14) — another church cannot receive Central Henderson\'s manifest', () => {
  it('a different, real church id resolves every manifest capability to unknown, never qualified', () => {
    for (const e of PILOT_CAPABILITY_MANIFEST) {
      const r = resolveDataCapability(e.capabilityId, actor(['communications.send'], OTHER_CHURCH_ID));
      expect(r.status, e.capabilityId).toBe('unknown');
    }
  });

  it('a forged/nonsense church id is treated exactly like any other non-qualified tenant, not trusted', () => {
    const r = resolveDataCapability('cap-identity-know', actor([], 'forged-church-id-not-a-real-uuid'));
    expect(r.status).toBe('unknown');
  });

  it('buildCapabilityContext for another church returns the generic no-evidence block, never the Henderson-specific one', () => {
    const central = buildCapabilityContext(actor(['communications.send', 'people.manage'], QUALIFIED_CHURCH_ID));
    const other = buildCapabilityContext(actor(['communications.send', 'people.manage'], OTHER_CHURCH_ID));
    expect(other).not.toContain('YOU ARE QUALIFIED AND AUTHORIZED FOR');
    expect(other).toContain('does not yet have qualified, church-specific capability evidence');
    expect(other).not.toBe(central);
  });

  it('the qualified church constant is a real, specific id, not a wildcard', () => {
    expect(QUALIFIED_CHURCH_ID).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('absolute prohibitions (item 16) — no evidence or permission can override', () => {
  it('every prohibited capability resolves prohibited regardless of actor permissions', () => {
    for (const p of PROHIBITED_CAPABILITIES) {
      const withEverything = resolveDataCapability(p.capabilityId, actor(['communications.send', 'people.manage', 'care.manage', 'admin.manage_settings']));
      expect(withEverything.status, p.capabilityId).toBe('prohibited');
    }
  });

  it('prohibition is checked before the tenant gate — even a non-Henderson actor gets the real refusal, not a generic unknown', () => {
    const r = resolveDataCapability(PROHIBITED_CAPABILITIES[0].capabilityId, actor([], OTHER_CHURCH_ID));
    expect(r.status).toBe('prohibited');
  });

  it('the safe refusal text never exposes internal implementation detail', () => {
    for (const p of PROHIBITED_CAPABILITIES) {
      expect(p.safeRefusal).not.toMatch(/RLS|migration|fixture|tenant_id|church_id|permission key/i);
    }
  });
});

describe('no internal-detail leakage in any user-facing capability text (item 13)', () => {
  const FORBIDDEN = /\benv(ironment)? ?var|SUPABASE_|CLERK_|ANTHROPIC_API_KEY|migration \d|fixture[-_]|RLS\b|tenant_id\b|\bchurch_id\b|system prompt/i;

  it('manifest allowed/prohibited/limitation strings are all safe', () => {
    for (const e of PILOT_CAPABILITY_MANIFEST) {
      expect(e.allowedClaim).not.toMatch(FORBIDDEN);
      expect(e.prohibitedClaim).not.toMatch(FORBIDDEN);
      expect(e.safeLimitationDescription).not.toMatch(FORBIDDEN);
    }
  });

  it('known-gap and prohibited-capability strings are all safe', () => {
    for (const g of KNOWN_CAPABILITY_GAPS) expect(g.safeLimitationDescription).not.toMatch(FORBIDDEN);
    for (const p of PROHIBITED_CAPABILITIES) expect(p.safeRefusal).not.toMatch(FORBIDDEN);
  });

  it('raw RBAC permission keys are never surfaced directly in the composed context — only friendly names', () => {
    const block = buildCapabilityContext(actor([]));
    expect(block).not.toContain('communications.send');
  });
});

describe('cross-check against the eval-harness Prompt 8 manifest — drift must be loud, not silent', () => {
  it('every (domain, level) PROVEN in the eval-harness manifest has a matching PROVEN entry here with the same qualification evidence', () => {
    for (const evalEntry of EVAL_MANIFEST) {
      const matches = PILOT_CAPABILITY_MANIFEST.filter((e) => e.domain === evalEntry.domain && e.level === evalEntry.level);
      expect(matches.length, `${evalEntry.domain}/${evalEntry.level} missing from api/_lib/capability-manifest.ts`).toBeGreaterThan(0);
      const evidenceUnion = new Set(matches.flatMap((m) => m.qualificationEvidence));
      for (const ev of evalEntry.qualificationEvidence) {
        expect(evidenceUnion.has(ev), `${evalEntry.domain}/${evalEntry.level} evidence '${ev}' not mirrored`).toBe(true);
      }
    }
  });

  it('this manifest never claims a (domain, level) the eval-harness manifest has not proven', () => {
    for (const entry of PILOT_CAPABILITY_MANIFEST) {
      const evalHas = EVAL_MANIFEST.some((e) => e.domain === entry.domain && e.level === entry.level);
      expect(evalHas, `${entry.capabilityId} (${entry.domain}/${entry.level}) has no corresponding PROVEN entry in the eval-harness manifest`).toBe(true);
    }
  });
});
