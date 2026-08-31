/**
 * Pilot Capability Manifest (item 12) — what the Central Henderson pilot
 * version of GRACE is allowed to claim, seeded ONLY from already-PROVEN
 * exam qualification evidence (2026-08-31 run: 22 PASS / 0 FAIL / 0
 * safety-critical failures). No future workshop assumption appears here.
 *
 * Release-state note (items 13 & 16): every entry is QUALIFIED, not
 * APPROVED_FOR_PILOT — pilot approval is a separate, explicit decision.
 * The qualified build currently lives on the feat/ai-work-cards branch
 * Preview; production does not carry /api/grace/chat. That deployment
 * decision is deliberately outside this engine.
 */
import type { PilotCapabilityEntry } from './types.js';

export const PILOT_CAPABILITY_MANIFEST: PilotCapabilityEntry[] = [
  {
    capabilityId: 'cap-identity-know',
    domain: 'church_identity',
    level: 'KNOW',
    status: 'PROVEN',
    authoritativeSources: ['src-fy2024-consolidated-financials'],
    permissions: 'All authenticated Central Henderson staff (church-scoped retrieval, server-resolved tenant).',
    qualificationEvidence: ['chx-know-authoritative-seed-retrieval'],
    proofBoundary: 'mock',
    allowedClaim: 'GRACE answers identity/mission/strategy/ownership-path questions from the approved seed, with source attribution.',
    prohibitedClaim: 'Any Henderson-specific financial, attendance, or debt figure — no authorized source exists.',
    knownLimitations: ['Seed content is consolidated-entity scoped; scope-boundary rows are injected unconditionally to enforce that.'],
    releaseState: 'QUALIFIED',
  },
  {
    capabilityId: 'cap-identity-remember',
    domain: 'church_identity',
    level: 'REMEMBER',
    status: 'PROVEN',
    authoritativeSources: ['src-fy2024-consolidated-financials'],
    permissions: 'All authenticated staff.',
    qualificationEvidence: ['chx-remember-legal-tax-status-caveat-preserved'],
    proofBoundary: 'mock',
    allowedClaim: 'Targeted retrieval preserves required caveats (e.g. legal/tax status stays verification-required, never asserted as settled fact).',
    prohibitedClaim: 'That retrieval quality is proven beyond the seeded knowledge set.',
    knownLimitations: ['Retrieval proven against the mock query layer; tsvector behavior on the live DB is spot-checked, not harness-proven.'],
    releaseState: 'QUALIFIED',
  },
  {
    capabilityId: 'cap-people-remember',
    domain: 'people_households',
    level: 'REMEMBER',
    status: 'PROVEN',
    authoritativeSources: [],
    permissions: 'Per-user (memories are owner-scoped; Memory V1 / ADR-014).',
    qualificationEvidence: ['ph-remember-memory-vs-authoritative-distinction'],
    proofBoundary: 'mock',
    allowedClaim: 'Staff-told, person-tagged notes are recalled with attribution and stay subordinate to live records.',
    prohibitedClaim: 'That a memory is a church record, or that households/family structure are visible (they are not).',
    knownLimitations: ['Households exist in the schema but are never exposed to chat.'],
    releaseState: 'QUALIFIED',
  },
  {
    capabilityId: 'cap-care-remember',
    domain: 'pastoral_care',
    level: 'REMEMBER',
    status: 'PROVEN',
    authoritativeSources: [],
    permissions: 'Per-user memories; prayer content at existing visibility tiers.',
    qualificationEvidence: ['pc-remember-care-memory-attribution-preserved'],
    proofBoundary: 'mock',
    allowedClaim: 'Care-related staff notes recalled as "noted from chat," never formatted as a live care record.',
    prohibitedClaim: 'Any freshness/staleness judgment on prayer requests (dates are not yet in the prompt), or any spiritual-state inference (banned).',
    knownLimitations: ['Prayer staleness signal is a needed-for-pilot gap, not yet wired.'],
    releaseState: 'QUALIFIED',
  },
  {
    capabilityId: 'cap-comms-act',
    domain: 'communications',
    level: 'ACT',
    status: 'PROVEN',
    authoritativeSources: [],
    permissions: 'communications.send; send_sms gated behind the approval queue; all sends audited.',
    qualificationEvidence: ['com-act-send-audited-positive'],
    proofBoundary: 'mock',
    allowedClaim: 'GRACE can propose/execute sends through the audited, permissioned action pipeline with provenance recorded.',
    prohibitedClaim: 'Consent-aware sending — GRACE currently has zero visibility into opt-out status or prior sends (needed-for-pilot gap).',
    knownLimitations: ['Highest capability/grounding mismatch in the exam: action exists, informational grounding does not.'],
    releaseState: 'QUALIFIED',
  },
  {
    capabilityId: 'cap-gov-know',
    domain: 'governance_security_authority',
    level: 'KNOW',
    status: 'PROVEN',
    authoritativeSources: [],
    permissions: 'N/A — structural property of the permission substrate.',
    qualificationEvidence: ['gov-know-consents-rls-confirmed'],
    proofBoundary: 'static_catalog',
    allowedClaim: 'Consent data is RLS-protected (tenant isolation + member self-access) at the policy-text level.',
    prohibitedClaim: 'That the harness proves live Postgres enforcement — that is explicitly outside the mock/static proof boundary.',
    knownLimitations: ['Live-DB RLS enforcement requires the separate live smoke suite, not this harness.'],
    releaseState: 'QUALIFIED',
  },
  {
    capabilityId: 'cap-gov-act',
    domain: 'governance_security_authority',
    level: 'ACT',
    status: 'PROVEN',
    authoritativeSources: [],
    permissions: 'Catalog permissions + requiresApproval routing; actor identity server-resolved from the verified session.',
    qualificationEvidence: ['gov-act-central-henderson-tenant-scope-cross-check'],
    proofBoundary: 'mock',
    allowedClaim: 'Actions execute/propose under the real Central Henderson tenant scope with correct approval routing and provenance.',
    prohibitedClaim: 'That client-supplied identity or natural-language pressure can alter routing (proven impossible at the app layer, not merely asserted).',
    knownLimitations: ['Only 5 of 14 catalog actions have executors; the rest correctly refuse direct execution.'],
    releaseState: 'QUALIFIED',
  },
];
