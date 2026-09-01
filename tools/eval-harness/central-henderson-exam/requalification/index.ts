/**
 * Post-Discovery Implementation & Requalification Engine — entry point.
 *
 * Registries below hold REAL post-workshop artifacts. They start empty
 * (except the two canonical seeds noted) because the Central Henderson
 * workshop has not occurred — empty is the correct state. Populating any
 * of them requires verified workshop evidence flowing through the gates
 * in intake-rules.ts, never assumption.
 */
import type {
  DiscoveryChange,
  ImplementationPacket,
  RequalificationResult,
  BaselineChangeProposal,
  ReadinessDelta,
  SourceAdmission,
} from './types.js';

export * from './types.js';
export * from './intake-rules.js';
export * from './impact-map.js';
export * from './pilot-capability-manifest.js';

/** Empty until real workshop findings pass intake. */
export const DISCOVERY_CHANGES: DiscoveryChange[] = [];

/** Empty until changes reach READY_FOR_IMPLEMENTATION. */
export const IMPLEMENTATION_PACKETS: ImplementationPacket[] = [];

/** Empty until requalification runs happen. */
export const REQUALIFICATION_RESULTS: RequalificationResult[] = [];

/** Empty until a qualified change proposes a baseline move. */
export const BASELINE_CHANGE_PROPOSALS: BaselineChangeProposal[] = [];

/** Empty until an implementation produces new gate evidence. */
export const READINESS_DELTAS: ReadinessDelta[] = [];

/**
 * The single canonical source admission — the FY2024 consolidated
 * financial statements, already approved via ADR-015/migration 076. It
 * exists here as the worked example of the admission gate (why scope
 * matters: consolidated truth must never silently become Henderson-
 * specific truth), not as new ingestion.
 */
export const SOURCE_ADMISSIONS: SourceAdmission[] = [
  {
    admissionId: 'adm-fy2024-consolidated',
    sourceId: 'src-fy2024-consolidated-financials',
    tier: 'approved_grace_source',
    provenance: 'Audited FY2024 financial statements, Central Christian Church and Affiliates (consolidated entity); hand-reviewed extraction.',
    ownership: 'Consolidated entity — NOT Central Henderson campus specifically.',
    scope: 'Historical, consolidated-entity; explicitly not Henderson-specific.',
    authority: 'Approved via ADR-015; ingested by migration 076 with scope-boundary guardrail rows.',
    freshness: 'Static (one fiscal year; never refreshed).',
    sensitivity: 'restricted',
    permittedUses: [
      'Consolidated-entity identity/mission/strategy/ownership-path facts, source-attributed.',
      'Basis for the always-injected scope-boundary guardrails.',
    ],
    prohibitedUses: [
      'Any Henderson-specific financial/attendance/debt figure.',
      'Any individual member giving/care data.',
    ],
    verification: 'Verified: ADR-015 review + migration 076 seed + exam cases chx-* passing.',
    admitted: true,
  },
];
