/**
 * Workshop outputs (item 10) — the six artifacts a completed discovery
 * session should let us produce. Mostly derived views over
 * discovery-items.ts / systems-of-record.ts / authority-sensitivity-map.ts
 * / source-register.ts, not new data — this file defines the SHAPE of
 * each output and how to build it from what a real session captures.
 *
 * These are still templates: every derivation below reflects the
 * discovery instrument's current (pre-workshop) state, not real Central
 * Henderson answers. Re-run after a real session to produce the filled
 * versions.
 */
import { DISCOVERY_ITEMS, type DiscoveryItem } from './discovery-items.js';
import { SYSTEMS_OF_RECORD_QUESTIONS } from './systems-of-record.js';
import { AUTHORITY_SENSITIVITY_MAP } from './authority-sensitivity-map.js';
import { CENTRAL_HENDERSON_SOURCE_REGISTER } from './source-register.js';

export interface KnowledgeMapEntry {
  domain: string;
  whatGraceKnowsToday: string;
  whatIsStillUnknown: string;
  gapIds: string[];
}

/** 1. Central Henderson Knowledge Map — what authoritative knowledge exists and where. */
export function buildKnowledgeMap(): KnowledgeMapEntry[] {
  const byDomain = new Map<string, DiscoveryItem[]>();
  for (const item of DISCOVERY_ITEMS) {
    const list = byDomain.get(item.domain) ?? [];
    list.push(item);
    byDomain.set(item.domain, list);
  }
  return Array.from(byDomain.entries()).map(([domain, items]) => ({
    domain,
    whatGraceKnowsToday: items.map((i) => i.graceCurrentlyKnows).join(' '),
    whatIsStillUnknown: items.map((i) => i.graceCannotCurrentlyKnow).join(' '),
    gapIds: items.map((i) => i.gapId),
  }));
}

/** 2. Central Henderson Source Register — re-exported as-is; see source-register.ts. */
export const sourceRegister = CENTRAL_HENDERSON_SOURCE_REGISTER;

/** 3. Central Henderson Authority Map — who can see, change, approve, authorize. */
export const authorityMap = AUTHORITY_SENSITIVITY_MAP;

export interface IntegrationBacklogEntry {
  gapId: string;
  domain: string;
  systemsGraceEventuallyNeeds: string;
  accessClass: string[];
}

/** 4. Central Henderson Integration Backlog — systems/data GRACE eventually needs access to. */
export function buildIntegrationBacklog(): IntegrationBacklogEntry[] {
  return DISCOVERY_ITEMS
    .filter((i) => i.accessClass.includes('B') || i.accessClass.includes('A'))
    .map((i) => ({
      gapId: i.gapId,
      domain: i.domain,
      systemsGraceEventuallyNeeds: i.authoritativeSourceRequired,
      accessClass: i.accessClass,
    }));
}

export interface QualificationBacklogEntry {
  gapId: string;
  relatedCaseIds: string[];
  domain: string;
  currentQualificationStatus: 'PARTIAL_OR_NOT_YET_PROVEN';
  becomesTestableAfter: string;
}

/**
 * 5. Central Henderson Qualification Backlog — which currently
 * PARTIAL/NOT YET PROVEN cells could become testable after onboarding.
 * A workshop answer alone never moves this to PROVEN — see
 * DISCOVERY_TO_QUALIFICATION_LIFECYCLE in discovery-items.ts. Only a
 * subsequently implemented and passing qualification fixture can.
 */
export function buildQualificationBacklog(): QualificationBacklogEntry[] {
  return DISCOVERY_ITEMS.map((i) => ({
    gapId: i.gapId,
    relatedCaseIds: i.relatedCaseIds,
    domain: i.domain,
    currentQualificationStatus: 'PARTIAL_OR_NOT_YET_PROVEN' as const,
    becomesTestableAfter: i.capabilityUnlockedIfSupplied,
  }));
}

/** 6. Pilot Readiness Gaps — what absolutely must be resolved before the pilot is credible. */
export function buildPilotReadinessGaps(): DiscoveryItem[] {
  return DISCOVERY_ITEMS.filter((i) => i.priority === 'needed_for_pilot');
}

export const systemsOfRecordQuestions = SYSTEMS_OF_RECORD_QUESTIONS;
