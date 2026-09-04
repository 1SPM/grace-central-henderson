/**
 * Intake, admission, grouping, escalation, and proven-capability rules —
 * pure functions so the discipline is enforced by code, not by author
 * goodwill. Every rule here has a deterministic integrity test.
 */
import type {
  DiscoveryChange,
  IntakeStatus,
  SourceAdmission,
} from './types.js';

// ── Dangerous-change escalation (item 10) ──────────────────────────────

/**
 * A change touching any of these must carry explicit architecture/security
 * review (escalationApproved === true) before it can classify as ready —
 * a developer cannot reclassify one as ordinary configuration to ship it.
 * Matched against the change's permissionImplications + requestedCapability
 * + implementationBoundary text AND its structural fields.
 */
export const DANGEROUS_CHANGE_TRIGGERS: { triggerId: string; description: string; pattern: RegExp }[] = [
  { triggerId: 'esc-tenant-isolation', description: 'Tenant isolation', pattern: /tenant|church_id|cross-church/i },
  { triggerId: 'esc-authorization-model', description: 'Authorization model', pattern: /authoriz|authz|rls|role model|permission model/i },
  { triggerId: 'esc-care-exposure', description: 'Sensitive pastoral/care exposure', pattern: /pastoral|care record|prayer visibility|crisis/i },
  { triggerId: 'esc-giving-privacy', description: 'Giving/donor privacy', pattern: /donor|giving histor|individual giving|pledge detail/i },
  { triggerId: 'esc-privilege-elevation', description: 'Privilege elevation', pattern: /elevat|escalat.*privileg|bypass.*approval/i },
  { triggerId: 'esc-destructive-actions', description: 'Destructive actions', pattern: /destructive|delete .*record|hard.delete/i },
  { triggerId: 'esc-comms-authority', description: 'Communications authority', pattern: /send.*without approval|mass send|communications authority/i },
  { triggerId: 'esc-personal-inference', description: 'Personal/spiritual inference', pattern: /spiritual (state|scoring)|personal judgment|infer.*engagement/i },
  { triggerId: 'esc-autonomous-action', description: 'Autonomous action', pattern: /autonomous|unattended|proactive action/i },
  { triggerId: 'esc-source-precedence', description: 'Changes to source precedence', pattern: /source precedence|authoritative order|prompt order/i },
  { triggerId: 'esc-memory-authority', description: 'Changes to memory authority', pattern: /memory authorit|memories? as (fact|record)|memory precedence/i },
];

export function dangerousTriggersFor(change: DiscoveryChange): string[] {
  const text = `${change.permissionImplications} ${change.requestedCapability} ${change.implementationBoundary}`;
  const hits = DANGEROUS_CHANGE_TRIGGERS.filter((t) => t.pattern.test(text)).map((t) => t.triggerId);
  // Structural triggers that don't depend on prose wording:
  if (change.changeType === 'permission_authority' && !hits.includes('esc-authorization-model')) hits.push('esc-authorization-model');
  if (change.changeType === 'action' && !hits.includes('esc-destructive-actions')) hits.push('esc-destructive-actions');
  if (change.sensitivity === 'confidential' && !hits.includes('esc-care-exposure')) hits.push('esc-care-exposure');
  return hits;
}

export function requiresEscalation(change: DiscoveryChange): boolean {
  return change.safetyCritical || dangerousTriggersFor(change).length > 0;
}

// ── Intake classification (item 3) ─────────────────────────────────────

export function classifyIntake(change: DiscoveryChange): { status: IntakeStatus; reasons: string[] } {
  const reasons: string[] = [];

  if (change.status === 'DEFERRED' || change.status === 'REJECTED') {
    return { status: change.status, reasons: ['explicitly set by a logged decision'] };
  }

  if (change.changeType === 'architecture_capability') {
    return { status: 'ENGINEERING_PREREQUISITE', reasons: ['requires a new architecture surface — no amount of workshop evidence makes this implementation-ready'] };
  }

  if (!change.evidence.decisionEvidence) {
    reasons.push('no approved Decision Log entry');
  }
  const needsSource = change.sourceAuthority !== 'none_required';
  if (needsSource && !change.evidence.sourceEvidence) reasons.push('required authoritative source not identified/verified');
  if (!change.evidence.scopeEvidence) reasons.push('scope not established');
  if (!change.evidence.authorityEvidence) reasons.push('authority to use/expose not established');
  if (!change.evidence.permissionEvidence) reasons.push('permission restrictions not understood');
  if (!change.evidence.qualificationTarget) reasons.push('qualification target (what passing looks like) undefined');

  if (!change.evidence.decisionEvidence) {
    return { status: 'NEEDS_DECISION', reasons };
  }
  if (reasons.length > 0) {
    return { status: 'NEEDS_EVIDENCE', reasons };
  }

  if (requiresEscalation(change) && change.escalationApproved !== true) {
    return {
      status: 'NEEDS_DECISION',
      reasons: [`dangerous-change escalation required and not yet approved: ${dangerousTriggersFor(change).join(', ') || 'safety-critical'}`],
    };
  }

  return { status: 'READY_FOR_IMPLEMENTATION', reasons: ['all evidence gates satisfied'] };
}

// ── Source admission gate (item 4) ─────────────────────────────────────

export function sourceAdmissible(a: SourceAdmission): { admissible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (a.tier !== 'approved_grace_source') {
    reasons.push(`tier is '${a.tier}' — only approved_grace_source may enter grace_knowledge/live context; a statement, observation, or upload is never enough`);
  }
  for (const [field, value] of Object.entries({
    provenance: a.provenance, ownership: a.ownership, scope: a.scope,
    authority: a.authority, freshness: a.freshness, sensitivity: a.sensitivity,
    verification: a.verification,
  })) {
    if (!value) reasons.push(`${field} missing`);
  }
  if (a.permittedUses.length === 0) reasons.push('permitted uses not enumerated');
  if (a.prohibitedUses.length === 0) reasons.push('prohibited uses not enumerated — every source has at least a scope boundary (the FY2024 consolidated source is the canonical example: consolidated truth must never silently become Henderson-specific truth)');
  return { admissible: reasons.length === 0, reasons };
}

// ── One-gap-at-a-time grouping (item 6) ────────────────────────────────

export function canGroupChanges(a: DiscoveryChange, b: DiscoveryChange): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const sameSources = a.sourceIds.length === b.sourceIds.length && a.sourceIds.every((s) => b.sourceIds.includes(s));
  if (!sameSources) reasons.push('different authoritative sources');
  if (a.permissionImplications !== b.permissionImplications) reasons.push('different permission boundaries');
  if (a.implementationBoundary !== b.implementationBoundary) reasons.push('different implementation surfaces');
  if (a.qualificationRequired.length === 0 || b.qualificationRequired.length === 0) reasons.push('not independently qualifiable');
  if (a.safetyCritical || b.safetyCritical) reasons.push('grouping a safety-critical change increases safety ambiguity — implement alone');
  return { allowed: reasons.length === 0, reasons };
}

// ── Qualification-before-baseline (items 7 & 9) ────────────────────────

export interface ProvenProposalInputs {
  implementationComplete: boolean;
  deterministicCasesPass: boolean;
  safetyCriticalCasesPass: boolean;
  proofBoundaryCorrect: boolean;
  liveEvidenceRequired: boolean;
  liveEvidencePasses: boolean;
  noAuthorityOrSourceRegression: boolean;
  explicitlyReviewed: boolean;
  isArchitecturalFinding: boolean;
  requiresLiveJudgment: boolean;
  liveJudgmentQualified: boolean;
  qualificationEvidence: string[];
}

/**
 * The non-negotiable core: implementation ≠ capability; a demo ≠
 * capability; prompt presence ≠ capability; a passing mock ≠ live-DB
 * enforcement; a workshop decision ≠ capability. The baseline never
 * mutates automatically — this function only says whether a HUMAN-reviewed
 * proposal is even eligible.
 */
export function canProposeProven(i: ProvenProposalInputs): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (i.qualificationEvidence.length === 0) reasons.push('no qualification evidence — PROVEN cannot exist without passing qualification cases');
  if (!i.implementationComplete) reasons.push('implementation incomplete');
  if (!i.deterministicCasesPass) reasons.push('required deterministic qualification not passing');
  if (!i.safetyCriticalCasesPass) reasons.push('safety-critical case failure blocks any PROVEN proposal');
  if (!i.proofBoundaryCorrect) reasons.push('wrong proof boundary (e.g. a mock pass claimed as live-DB enforcement)');
  if (i.liveEvidenceRequired && !i.liveEvidencePasses) reasons.push('required live/integration evidence not passing');
  if (!i.noAuthorityOrSourceRegression) reasons.push('authority/source regression detected');
  if (i.isArchitecturalFinding) reasons.push('an architectural finding documents reality — it can never become a capability proof');
  if (i.requiresLiveJudgment && !i.liveJudgmentQualified) reasons.push('level requires live judgment; advisory samples or NOT_RUN cannot become deterministic proof');
  if (!i.explicitlyReviewed) reasons.push('Capability Baseline change not explicitly reviewed — the baseline never mutates automatically');
  return { allowed: reasons.length === 0, reasons };
}
