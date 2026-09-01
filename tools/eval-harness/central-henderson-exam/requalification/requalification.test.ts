import { describe, it, expect } from 'vitest';
import { ALL_EXAM_CASES } from '../index.js';
import { DISCOVERY_ITEMS } from '../discovery/discovery-items.js';
import { CENTRAL_HENDERSON_SOURCE_REGISTER } from '../discovery/source-register.js';
import {
  DISCOVERY_CHANGES,
  IMPLEMENTATION_PACKETS,
  REQUALIFICATION_RESULTS,
  BASELINE_CHANGE_PROPOSALS,
  READINESS_DELTAS,
  SOURCE_ADMISSIONS,
} from './index.js';
import {
  classifyIntake,
  requiresEscalation,
  canGroupChanges,
  canProposeProven,
  sourceAdmissible,
  type ProvenProposalInputs,
} from './intake-rules.js';
import { affectedDomainsFor, buildRequalificationPlan } from './impact-map.js';
import { PILOT_CAPABILITY_MANIFEST } from './pilot-capability-manifest.js';
import type { DiscoveryChange } from './types.js';

const EXAM_CASE_IDS = new Set(ALL_EXAM_CASES.map((c) => c.id));
const GAP_IDS = new Set(DISCOVERY_ITEMS.map((i) => i.gapId));
const SOURCE_IDS = new Set(CENTRAL_HENDERSON_SOURCE_REGISTER.map((s) => s.sourceId));

/** A fully-evidenced, non-dangerous synthetic change for rule exercises. */
function validChange(over: Partial<DiscoveryChange> = {}): DiscoveryChange {
  return {
    changeId: 'chg-test-1',
    domain: 'ministry_discipleship',
    gapId: 'dg-ministry-real-activity-data',
    relatedCaseIds: ['min-know-hardcoded-demo-data-finding'],
    decisionLogId: 'DL-001',
    sourceIds: ['src-pending-groups'],
    sourceAuthority: 'authoritative',
    scope: 'church_wide',
    sensitivity: 'internal',
    permissionImplications: 'no new visibility beyond existing group membership access',
    requestedCapability: 'real group-activity numbers instead of demo data',
    currentCapabilityState: 'hardcoded demo data reaches the prompt',
    targetIntelligenceLevel: 'KNOW',
    changeType: 'data_exposure',
    implementationBoundary: 'buildDataContext group-activity line only',
    qualificationRequired: ['rerun min-know-hardcoded-demo-data-finding expecting resolution'],
    safetyCritical: false,
    escalationApproved: null,
    evidence: {
      decisionEvidence: 'DL-001',
      sourceEvidence: 'src-pending-groups verified',
      scopeEvidence: 'church-wide, confirmed in workshop',
      authorityEvidence: 'groups lead authorized',
      permissionEvidence: 'existing access model unchanged',
      qualificationTarget: 'no fabricated engagement number can reach a reply',
    },
    status: 'NEEDS_EVIDENCE',
    ...over,
  };
}

describe('requalification engine — empty pre-workshop state', () => {
  it('all post-workshop registries start empty (no hypothetical findings)', () => {
    expect(DISCOVERY_CHANGES).toEqual([]);
    expect(IMPLEMENTATION_PACKETS).toEqual([]);
    expect(REQUALIFICATION_RESULTS).toEqual([]);
    expect(BASELINE_CHANGE_PROPOSALS).toEqual([]);
    expect(READINESS_DELTAS).toEqual([]);
  });

  it('the single seeded source admission is the FY2024 canonical example, fully admissible', () => {
    expect(SOURCE_ADMISSIONS).toHaveLength(1);
    const fy = SOURCE_ADMISSIONS[0];
    expect(fy.sourceId).toBe('src-fy2024-consolidated-financials');
    expect(SOURCE_IDS.has(fy.sourceId)).toBe(true);
    expect(sourceAdmissible(fy).admissible).toBe(true);
    expect(fy.prohibitedUses.join(' ')).toMatch(/Henderson-specific/);
  });
});

describe('intake classification (evidence gates)', () => {
  it('a fully-evidenced non-dangerous change classifies READY_FOR_IMPLEMENTATION', () => {
    expect(classifyIntake(validChange()).status).toBe('READY_FOR_IMPLEMENTATION');
  });

  it('missing Decision Log entry → NEEDS_DECISION (a request alone is never enough)', () => {
    const c = validChange({ evidence: { ...validChange().evidence, decisionEvidence: null } });
    expect(classifyIntake(c).status).toBe('NEEDS_DECISION');
  });

  it('missing source/scope/authority/permission/target evidence → NEEDS_EVIDENCE', () => {
    for (const gate of ['sourceEvidence', 'scopeEvidence', 'authorityEvidence', 'permissionEvidence', 'qualificationTarget'] as const) {
      const c = validChange({ evidence: { ...validChange().evidence, [gate]: null } });
      expect(classifyIntake(c).status, gate).toBe('NEEDS_EVIDENCE');
    }
  });

  it('architecture_capability always classifies ENGINEERING_PREREQUISITE regardless of evidence', () => {
    expect(classifyIntake(validChange({ changeType: 'architecture_capability' })).status).toBe('ENGINEERING_PREREQUISITE');
  });

  it('sourceAuthority none_required waives only the source gate', () => {
    const c = validChange({ sourceAuthority: 'none_required', evidence: { ...validChange().evidence, sourceEvidence: null } });
    expect(classifyIntake(c).status).toBe('READY_FOR_IMPLEMENTATION');
  });
});

describe('dangerous-change escalation', () => {
  it('structural triggers: permission_authority, action, and confidential sensitivity always escalate', () => {
    expect(requiresEscalation(validChange({ changeType: 'permission_authority' }))).toBe(true);
    expect(requiresEscalation(validChange({ changeType: 'action' }))).toBe(true);
    expect(requiresEscalation(validChange({ sensitivity: 'confidential' }))).toBe(true);
  });

  it('a dangerous change cannot classify READY without approved escalation — and can with it', () => {
    const dangerous = validChange({ changeType: 'permission_authority' });
    expect(classifyIntake(dangerous).status).toBe('NEEDS_DECISION');
    expect(classifyIntake({ ...dangerous, escalationApproved: true }).status).toBe('READY_FOR_IMPLEMENTATION');
  });

  it('prose describing tenant/donor/memory-authority concerns triggers escalation even for an "ordinary" changeType', () => {
    const sneaky = validChange({ requestedCapability: 'expose individual giving history in chat' });
    expect(requiresEscalation(sneaky)).toBe(true);
  });
});

describe('one-gap-at-a-time grouping', () => {
  it('identical source/permission/surface, independently qualifiable, non-safety → groupable', () => {
    expect(canGroupChanges(validChange(), validChange({ changeId: 'chg-test-2' })).allowed).toBe(true);
  });

  it('differing sources, boundaries, surfaces, or any safety-critical member → split', () => {
    const base = validChange();
    expect(canGroupChanges(base, validChange({ sourceIds: ['src-pending-giving'] })).allowed).toBe(false);
    expect(canGroupChanges(base, validChange({ permissionImplications: 'different' })).allowed).toBe(false);
    expect(canGroupChanges(base, validChange({ implementationBoundary: 'different surface' })).allowed).toBe(false);
    expect(canGroupChanges(base, validChange({ safetyCritical: true })).allowed).toBe(false);
    expect(canGroupChanges(base, validChange({ qualificationRequired: [] })).allowed).toBe(false);
  });
});

describe('qualification-before-baseline (canProposeProven)', () => {
  const good: ProvenProposalInputs = {
    implementationComplete: true,
    deterministicCasesPass: true,
    safetyCriticalCasesPass: true,
    proofBoundaryCorrect: true,
    liveEvidenceRequired: false,
    liveEvidencePasses: false,
    noAuthorityOrSourceRegression: true,
    explicitlyReviewed: true,
    isArchitecturalFinding: false,
    requiresLiveJudgment: false,
    liveJudgmentQualified: false,
    qualificationEvidence: ['some-passing-case'],
  };

  it('allows a fully-evidenced, reviewed proposal', () => {
    expect(canProposeProven(good).allowed).toBe(true);
  });

  it('PROVEN cannot be produced without qualification evidence', () => {
    expect(canProposeProven({ ...good, qualificationEvidence: [] }).allowed).toBe(false);
  });

  it('safety-critical failure blocks approval', () => {
    expect(canProposeProven({ ...good, safetyCriticalCasesPass: false }).allowed).toBe(false);
  });

  it('an architectural finding can never become capability proof', () => {
    expect(canProposeProven({ ...good, isArchitecturalFinding: true }).allowed).toBe(false);
  });

  it('a live-judgment-required level with only advisory/NOT_RUN evidence cannot become deterministic proof', () => {
    expect(canProposeProven({ ...good, requiresLiveJudgment: true, liveJudgmentQualified: false }).allowed).toBe(false);
  });

  it('wrong proof boundary (mock claimed as live enforcement) blocks approval', () => {
    expect(canProposeProven({ ...good, proofBoundaryCorrect: false }).allowed).toBe(false);
  });

  it('the baseline never mutates automatically — unreviewed proposals are refused', () => {
    expect(canProposeProven({ ...good, explicitlyReviewed: false }).allowed).toBe(false);
  });

  it('implementation alone is not capability', () => {
    expect(canProposeProven({ ...good, deterministicCasesPass: false }).allowed).toBe(false);
  });
});

describe('source admission gate', () => {
  it('rejects every tier below approved_grace_source', () => {
    for (const tier of ['workshop_statement', 'observed_workflow', 'provided_source', 'verified_authoritative_source'] as const) {
      expect(sourceAdmissible({ ...SOURCE_ADMISSIONS[0], tier }).admissible).toBe(false);
    }
  });

  it('rejects an approved-tier admission with missing criteria or no prohibited uses', () => {
    expect(sourceAdmissible({ ...SOURCE_ADMISSIONS[0], provenance: null }).admissible).toBe(false);
    expect(sourceAdmissible({ ...SOURCE_ADMISSIONS[0], prohibitedUses: [] }).admissible).toBe(false);
  });
});

describe('requalification impact analysis', () => {
  it('governance is always an affected domain, for any change', () => {
    expect(affectedDomainsFor(validChange())).toContain('governance_security_authority');
    expect(affectedDomainsFor(validChange({ changeType: 'workflow', domain: 'events_calendar' }))).toContain('governance_security_authority');
  });

  it('a giving data-exposure change pulls in people, pastoral care, and governance', () => {
    const affected = affectedDomainsFor(validChange({ changeType: 'data_exposure', domain: 'giving_finance' }));
    for (const d of ['giving_finance', 'people_households', 'pastoral_care', 'governance_security_authority']) {
      expect(affected).toContain(d);
    }
  });

  it('a household exposure change pulls in communications; a new action always re-tests governance', () => {
    expect(affectedDomainsFor(validChange({ changeType: 'data_exposure', domain: 'people_households' }))).toContain('communications');
    expect(affectedDomainsFor(validChange({ changeType: 'action', domain: 'staff_work' }))).toContain('governance_security_authority');
  });

  it('buildRequalificationPlan derives non-empty direct + safety sets from the real exam, not the whole suite', () => {
    const plan = buildRequalificationPlan(validChange({ changeType: 'data_exposure', domain: 'giving_finance' }), ALL_EXAM_CASES);
    expect(plan.directCaseIds.length).toBeGreaterThan(0);
    expect(plan.safetyRegressionCaseIds.length).toBeGreaterThan(0);
    for (const id of [...plan.directCaseIds, ...plan.safetyRegressionCaseIds, ...plan.crossDomainRegressionCaseIds]) {
      expect(EXAM_CASE_IDS.has(id)).toBe(true);
    }
    const planned = new Set([...plan.directCaseIds, ...plan.safetyRegressionCaseIds, ...plan.crossDomainRegressionCaseIds]);
    expect(planned.size).toBeLessThan(ALL_EXAM_CASES.length);
  });

  it('live_db-boundary cases in affected domains force explicit live-evidence requirements', () => {
    const plan = buildRequalificationPlan(validChange({ changeType: 'data_exposure', domain: 'pastoral_care', gapId: 'dg-prayer-staleness-signal' }), ALL_EXAM_CASES);
    expect(plan.liveIntegrationEvidenceRequired.join(' ')).toMatch(/live/i);
  });

  it('synthetic change fixtures reference real gap and source ids (traceability holds even in tests)', () => {
    expect(GAP_IDS.has(validChange().gapId)).toBe(true);
    expect(SOURCE_IDS.has(validChange().sourceIds[0])).toBe(true);
  });
});

describe('pilot capability manifest — seeded only from PROVEN evidence', () => {
  it('every entry cites real, deterministic, non-finding exam cases', () => {
    for (const entry of PILOT_CAPABILITY_MANIFEST) {
      expect(entry.status).toBe('PROVEN');
      expect(entry.qualificationEvidence.length).toBeGreaterThan(0);
      for (const caseId of entry.qualificationEvidence) {
        const c = ALL_EXAM_CASES.find((x) => x.id === caseId);
        expect(c, caseId).toBeDefined();
        expect(c!.isArchitecturalFinding ?? false, `${caseId} is a finding — cannot back a capability claim`).toBe(false);
        expect(c!.requiresLiveJudgment ?? false, `${caseId} is live-judgment — cannot back a deterministic PROVEN claim`).toBe(false);
      }
    }
  });

  it('every entry declares the same proof boundary as its primary qualification case', () => {
    for (const entry of PILOT_CAPABILITY_MANIFEST) {
      const primary = ALL_EXAM_CASES.find((x) => x.id === entry.qualificationEvidence[0])!;
      expect(entry.proofBoundary, entry.capabilityId).toBe(primary.proofBoundary);
    }
  });

  it('no entry is released beyond QUALIFIED — pilot approval is a separate decision', () => {
    for (const entry of PILOT_CAPABILITY_MANIFEST) {
      expect(entry.releaseState).toBe('QUALIFIED');
    }
  });

  it('every cited source resolves to the Source Register', () => {
    for (const entry of PILOT_CAPABILITY_MANIFEST) {
      for (const s of entry.authoritativeSources) expect(SOURCE_IDS.has(s), s).toBe(true);
    }
  });

  it('no CONNECT, INTERPRET, RECOMMEND, or ANTICIPATE claims exist — intelligence-level discipline holds', () => {
    for (const entry of PILOT_CAPABILITY_MANIFEST) {
      expect(['KNOW', 'REMEMBER', 'ACT']).toContain(entry.level);
    }
  });
});
