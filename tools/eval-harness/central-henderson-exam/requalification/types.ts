/**
 * Post-Discovery Implementation & Requalification Engine — schemas
 * (Prompt 8). Formalizes the Implementation → Requalification half of the
 * lifecycle:
 *
 *   Qualification → Gap → Discovery → Authorized Source/Decision →
 *   Implementation → Requalification → Proven Capability
 *
 * Built BEFORE the Central Henderson workshop: every registry that would
 * hold real workshop findings starts EMPTY (see index.ts) — empty is the
 * correct state, not a placeholder to fill with assumptions. The rules in
 * intake-rules.ts / impact-map.ts are the mechanism; the data arrives only
 * from verified workshop evidence.
 */
import type { IntelligenceLevel, KnowledgeDomain } from '../../types.js';

// ── Discovery Change Intake (item 2) ───────────────────────────────────

export type ChangeType =
  | 'knowledge_configuration'
  | 'data_exposure'
  | 'integration'
  | 'permission_authority'
  | 'action'
  | 'workflow'
  | 'evaluation_only'
  | 'architecture_capability';

export type IntakeStatus =
  | 'READY_FOR_IMPLEMENTATION'
  | 'NEEDS_EVIDENCE'
  | 'NEEDS_DECISION'
  | 'ENGINEERING_PREREQUISITE'
  | 'DEFERRED'
  | 'REJECTED';

/**
 * Evidence gates (item 3). null = evidence missing. A change cannot be
 * READY_FOR_IMPLEMENTATION while any required gate is null — enforced by
 * classifyIntake(), not by author discipline.
 */
export interface EvidenceGates {
  /** Approved Decision Log entry id (DL-…). */
  decisionEvidence: string | null;
  /** Verified authoritative source id(s), where the change consumes a source. */
  sourceEvidence: string | null;
  /** Church-wide / Henderson-specific / historical / other — established, not assumed. */
  scopeEvidence: string | null;
  /** Who authorized GRACE to use/expose/change this. */
  authorityEvidence: string | null;
  /** Relevant visibility/action restrictions understood and recorded. */
  permissionEvidence: string | null;
  /** Exactly what passing behavior will look like (the qualification target). */
  qualificationTarget: string | null;
}

export interface DiscoveryChange {
  changeId: string;
  domain: KnowledgeDomain;
  gapId: string;
  relatedCaseIds: string[];
  decisionLogId: string | null;
  sourceIds: string[];
  sourceAuthority: 'authoritative' | 'supplementary' | 'none_required';
  scope: 'church_wide' | 'henderson_specific' | 'historical' | 'other';
  sensitivity: 'public' | 'internal' | 'restricted' | 'confidential';
  permissionImplications: string;
  requestedCapability: string;
  currentCapabilityState: string;
  targetIntelligenceLevel: IntelligenceLevel;
  changeType: ChangeType;
  implementationBoundary: string;
  qualificationRequired: string[];
  safetyCritical: boolean;
  /** Dangerous-change escalation (item 10): null = review not yet done. */
  escalationApproved: boolean | null;
  evidence: EvidenceGates;
  status: IntakeStatus;
}

// ── Source-to-GRACE admission (item 4) ─────────────────────────────────

export type SourceEvidenceTier =
  | 'workshop_statement'
  | 'observed_workflow'
  | 'provided_source'
  | 'verified_authoritative_source'
  | 'approved_grace_source';

export interface SourceAdmission {
  admissionId: string;
  /** Must resolve to a Source Register sourceId. */
  sourceId: string;
  tier: SourceEvidenceTier;
  provenance: string | null;
  ownership: string | null;
  scope: string | null;
  authority: string | null;
  freshness: string | null;
  sensitivity: string | null;
  permittedUses: string[];
  prohibitedUses: string[];
  verification: string | null;
  /** Only sourceAdmissible() may justify true — never set by hand-wave. */
  admitted: boolean;
}

// ── Bounded implementation packet (item 5) ─────────────────────────────

export interface ImplementationPacket {
  packetId: string;
  changeId: string;
  problem: string;
  evidence: string;
  currentBehavior: string;
  targetBehavior: string;
  nonGoals: string[];
  sourceBoundary: string;
  permissionBoundary: string;
  implementationSurface: string;
  qualificationCases: string[];
  regressionCases: string[];
  rollbackCondition: string;
}

// ── Requalification (items 7–8) ────────────────────────────────────────

export interface RequalificationPlan {
  planId: string;
  changeId: string;
  directCaseIds: string[];
  safetyRegressionCaseIds: string[];
  crossDomainRegressionCaseIds: string[];
  liveIntegrationEvidenceRequired: string[];
}

export interface RequalificationResult {
  planId: string;
  runDate: string;
  passedCaseIds: string[];
  failedCaseIds: string[];
  notRunCaseIds: string[];
  liveEvidenceOutcome: string | null;
  outcome: 'PASS' | 'FAIL' | 'INCOMPLETE';
}

export interface BaselineChangeProposal {
  proposalId: string;
  changeId: string;
  domain: KnowledgeDomain;
  level: IntelligenceLevel;
  fromStatus: string;
  toStatus: 'PROVEN' | 'PARTIAL' | 'NOT_YET_PROVEN' | 'FUTURE';
  qualificationEvidence: string[];
  reviewedBy: string | null;
  approved: boolean;
}

// ── Pilot Capability Manifest (item 12) & release states (item 13) ─────

export type ReleaseState =
  | 'IMPLEMENTED'
  | 'QUALIFIED'
  | 'APPROVED_FOR_PILOT'
  | 'PILOT_ACTIVE'
  | 'SUSPENDED'
  | 'RETIRED';

export interface PilotCapabilityEntry {
  capabilityId: string;
  domain: KnowledgeDomain;
  level: IntelligenceLevel;
  status: 'PROVEN';
  authoritativeSources: string[];
  permissions: string;
  qualificationEvidence: string[];
  proofBoundary: 'mock' | 'live_db' | 'static_catalog';
  allowedClaim: string;
  prohibitedClaim: string;
  knownLimitations: string[];
  releaseState: ReleaseState;
}

// ── Pilot Readiness delta (item 11) ────────────────────────────────────

export interface ReadinessDelta {
  deltaId: string;
  gateId: string;
  changeId: string;
  previousStatus: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  newEvidence: string;
  proposedStatus: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  reviewerDecision: 'accepted' | 'rejected' | null;
}
