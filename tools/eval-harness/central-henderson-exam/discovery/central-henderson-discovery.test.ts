import { describe, it, expect } from 'vitest';
import { ALL_EXAM_CASES } from '../index.js';
import { DISCOVERY_ITEMS } from './discovery-items.js';
import { SYSTEMS_OF_RECORD_QUESTIONS } from './systems-of-record.js';
import { AUTHORITY_SENSITIVITY_MAP } from './authority-sensitivity-map.js';
import { SHOW_US_DONT_TELL_US } from './show-us-dont-tell-us.js';
import { CENTRAL_HENDERSON_SOURCE_REGISTER } from './source-register.js';
import {
  buildKnowledgeMap,
  buildIntegrationBacklog,
  buildQualificationBacklog,
  buildPilotReadinessGaps,
} from './workshop-outputs.js';

const EXAM_CASE_IDS = new Set(ALL_EXAM_CASES.map((c) => c.id));
const DISCOVERY_GAP_IDS = new Set(DISCOVERY_ITEMS.map((i) => i.gapId));

describe('Central Henderson discovery instrument — integrity', () => {
  it('has no duplicate gapId across DISCOVERY_ITEMS', () => {
    const seen = new Set<string>();
    for (const item of DISCOVERY_ITEMS) {
      expect(seen.has(item.gapId)).toBe(false);
      seen.add(item.gapId);
    }
  });

  it('every DiscoveryItem.relatedCaseIds entry resolves to a real qualification exam case id', () => {
    const dangling: string[] = [];
    for (const item of DISCOVERY_ITEMS) {
      for (const caseId of item.relatedCaseIds) {
        if (!EXAM_CASE_IDS.has(caseId)) dangling.push(`${item.gapId} -> ${caseId}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('every DiscoveryItem carries at least one accessClass (A/B/C/D)', () => {
    for (const item of DISCOVERY_ITEMS) {
      expect(item.accessClass.length).toBeGreaterThan(0);
    }
  });

  it('every DiscoveryItem priority is one of the three named buckets', () => {
    const valid = new Set(['needed_for_pilot', 'valuable_after_pilot', 'future_advanced_intelligence']);
    for (const item of DISCOVERY_ITEMS) {
      expect(valid.has(item.priority)).toBe(true);
    }
  });

  it('covers all 10 knowledge domains across DISCOVERY_ITEMS', () => {
    const domains = new Set(DISCOVERY_ITEMS.map((i) => i.domain));
    expect(domains.size).toBe(10);
  });

  it('SensitiveAreaEntry.relatedGapIds resolve to real discovery gap ids', () => {
    const dangling: string[] = [];
    for (const area of AUTHORITY_SENSITIVITY_MAP) {
      for (const gapId of area.relatedGapIds) {
        if (!DISCOVERY_GAP_IDS.has(gapId)) dangling.push(`${area.areaId} -> ${gapId}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('ShowUsDemonstration.relatedGapIds resolve to real discovery gap ids', () => {
    const dangling: string[] = [];
    for (const demo of SHOW_US_DONT_TELL_US) {
      for (const gapId of demo.relatedGapIds) {
        if (!DISCOVERY_GAP_IDS.has(gapId)) dangling.push(`${demo.demoId} -> ${gapId}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it('SYSTEMS_OF_RECORD_QUESTIONS has 16 categories per item 5', () => {
    expect(SYSTEMS_OF_RECORD_QUESTIONS).toHaveLength(16);
  });

  it('AUTHORITY_SENSITIVITY_MAP has 7 sensitive areas per item 6', () => {
    expect(AUTHORITY_SENSITIVITY_MAP).toHaveLength(7);
  });

  it('SHOW_US_DONT_TELL_US has the 8 named workflow demonstrations per item 8', () => {
    expect(SHOW_US_DONT_TELL_US).toHaveLength(8);
  });

  it('source register seeds exactly one verified entry (FY2024) and the rest pending_discovery', () => {
    const verified = CENTRAL_HENDERSON_SOURCE_REGISTER.filter((s) => s.verificationStatus === 'verified');
    expect(verified).toHaveLength(1);
    expect(verified[0].sourceId).toBe('src-fy2024-consolidated-financials');
    const pending = CENTRAL_HENDERSON_SOURCE_REGISTER.filter((s) => s.verificationStatus === 'pending_discovery');
    expect(pending.length).toBe(SYSTEMS_OF_RECORD_QUESTIONS.length);
  });

  it('workshop output builders run without throwing and produce non-empty results', () => {
    expect(buildKnowledgeMap().length).toBeGreaterThan(0);
    expect(buildIntegrationBacklog().length).toBeGreaterThan(0);
    expect(buildQualificationBacklog().length).toBe(DISCOVERY_ITEMS.length);
    expect(buildPilotReadinessGaps().length).toBeGreaterThan(0);
  });

  it('needed-for-pilot items include the Henderson-specific-data item required by the closing framing note', () => {
    const neededIds = buildPilotReadinessGaps().map((i) => i.gapId);
    expect(neededIds).toContain('dg-henderson-specific-financial-attendance-data');
  });
});
