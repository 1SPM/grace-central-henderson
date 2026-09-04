/**
 * Central Henderson GRACE Source Register (item 9) — the beginning of
 * Central's GRACE data map. Seeded with exactly ONE real, verified
 * entry: the FY2024 consolidated financial statements already ingested
 * via migration 076 (ADR-015). Its scope restrictions are restated here
 * verbatim, not loosened. Every other row is a PENDING placeholder,
 * derived from systems-of-record.ts's 16 categories — nothing new is
 * ingested by this file; it only registers what discovery still needs
 * to resolve.
 */
import type { KnowledgeDomain } from '../../types.js';
import { SYSTEMS_OF_RECORD_QUESTIONS } from './systems-of-record.js';

export type SourceAuthority = 'authoritative' | 'supplementary';
export type SourceScope = 'church_wide' | 'campus_specific' | 'other';
export type SourceCurrency = 'current' | 'historical';
export type VerificationStatus = 'verified' | 'pending_discovery';

export interface SourceRegisterEntry {
  sourceId: string;
  domain: KnowledgeDomain;
  sourceName: string;
  owner: string;
  authority: SourceAuthority;
  scope: SourceScope;
  currency: SourceCurrency;
  sensitivity: string;
  updateFrequency: string;
  accessMechanism: string;
  permittedGraceUses: string[];
  prohibitedGraceUses: string[];
  verificationStatus: VerificationStatus;
}

export const CENTRAL_HENDERSON_SOURCE_REGISTER: SourceRegisterEntry[] = [
  // The one verified, historical/supplementary example — per item 9's
  // explicit instruction, this scope restriction is restated, not
  // loosened, and no new figures are added here or anywhere else in
  // this discovery instrument.
  {
    sourceId: 'src-fy2024-consolidated-financials',
    domain: 'church_identity',
    sourceName: 'Central Christian Church and Affiliates — consolidated FY2024 audited financial statements',
    owner: 'Central Christian Church and Affiliates (consolidated entity), not Central Henderson campus specifically',
    authority: 'supplementary',
    scope: 'other',
    currency: 'historical',
    sensitivity: 'restricted',
    updateFrequency: 'static (one fiscal year, not refreshed)',
    accessMechanism: 'Ingested via supabase/migrations/076_grace_knowledge.sql into grace_knowledge, category=identity/mission/strategy/ownership_path/scope_boundary',
    permittedGraceUses: [
      'Consolidated-entity identity, mission, vision, four-part strategy, and ownership-path facts, always source-attributed.',
      'As the basis for the scope_boundary guardrail rows that prevent Henderson-specific figures from being fabricated.',
    ],
    prohibitedGraceUses: [
      'Any Henderson-specific revenue, expense, debt, attendance, or budget figure — this source is explicitly consolidated, not campus-specific, per ADR-015.',
      'Any individual member giving/care data — out of scope for this source entirely.',
    ],
    verificationStatus: 'verified',
  },

  // Pending-discovery placeholders, one per systems-of-record category —
  // no source has been confirmed yet; these rows exist so the register's
  // shape is visible before the workshop, not to imply an answer.
  ...SYSTEMS_OF_RECORD_QUESTIONS.map((q): SourceRegisterEntry => ({
    sourceId: `src-pending-${q.categoryId.replace(/^sor-/, '')}`,
    domain: q.domain,
    sourceName: `(pending discovery — ${q.category})`,
    owner: '(pending discovery)',
    authority: 'authoritative',
    scope: 'church_wide',
    currency: 'current',
    sensitivity: '(pending discovery)',
    updateFrequency: '(pending discovery)',
    accessMechanism: '(pending discovery)',
    permittedGraceUses: [],
    prohibitedGraceUses: [],
    verificationStatus: 'pending_discovery',
  })),
];
