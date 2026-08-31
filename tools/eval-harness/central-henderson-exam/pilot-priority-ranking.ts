/**
 * Central Henderson Pilot Priority Ranking — hand-authored throughout,
 * per the exam's own requirement 5. pilotValue and riskIfWrong are product
 * judgments (would a pastor actually notice/care; how bad is it if GRACE
 * gets this wrong in front of a real user) that cannot be computed from
 * PASS/FAIL/PARTIAL data alone. dataAvailability and implementationEffort
 * are hand-authored too, for consistency — a half-mechanical object
 * invites exactly the kind of quiet drift this framework's own design
 * principles warn against.
 *
 * This ranking is the input to docs/CENTRAL_HENDERSON_DISCOVERY_WORKSHOP_GUIDE.md
 * — a facilitator's guide (internal-prep draft, not yet used with Central
 * Henderson) that turns these ranked gaps into discussion prompts for a
 * real session with their staff. If that session reprioritizes anything,
 * update this file to match and note their stated reason, not just
 * "per discussion." Nothing in this file changes any product behavior; it
 * only orders gaps already documented in knowledge-gap-map.ts.
 */
import type { KnowledgeDomain } from '../types.js';

export interface GapRankingItem {
  gap: string;
  domain: KnowledgeDomain;
  pilotValue: 'high' | 'medium' | 'low';
  riskIfWrong: 'high' | 'medium' | 'low';
  dataAvailability: 'available' | 'partial' | 'none';
  implementationEffort: 'small' | 'medium' | 'large';
  rationale: string;
  relatedCaseIds: string[];
}

export interface PilotPriorityRanking {
  neededForPilot: GapRankingItem[];
  valuableAfterPilot: GapRankingItem[];
  futureAdvancedIntelligence: GapRankingItem[];
}

export const CENTRAL_HENDERSON_PILOT_PRIORITY_RANKING: PilotPriorityRanking = {
  neededForPilot: [
    {
      gap: 'Communications sends have zero visibility into prior sends or consent/opt-out status',
      domain: 'communications',
      pilotValue: 'high', riskIfWrong: 'high', dataAvailability: 'available', implementationEffort: 'small',
      rationale: 'Comms actions are core "let GRACE do things" pilot demo material, and the consents table already exists and is RLS-protected — wiring a check before recommending a send is a small, contained change, not new infrastructure. Not fixed in this task (non-goal), but the shortest-effort, highest-risk item in the whole map.',
      relatedCaseIds: ['com-know-zero-comms-visibility-finding', 'com-recommend-consent-blind-send-not-yet-testable'],
    },
    {
      gap: 'Ministry/discipleship group-activity numbers are hardcoded demo data, indistinguishable from real data in the prompt',
      domain: 'ministry_discipleship',
      pilotValue: 'medium', riskIfWrong: 'high', dataAvailability: 'partial', implementationEffort: 'medium',
      rationale: 'This is active misinformation risk, not just an honest gap — a pastor could be told fabricated engagement numbers with full confidence. A real per-church data path (fetchCommunityPosts) already exists, unused; swapping it in is bounded work, not a new pipeline.',
      relatedCaseIds: ['min-know-hardcoded-demo-data-finding'],
    },
    {
      gap: 'Giving persona coaches fluent vocabulary (pledges, campaigns, funds) for data that does not exist anywhere in the prompt',
      domain: 'giving_finance',
      pilotValue: 'high', riskIfWrong: 'high', dataAvailability: 'none', implementationEffort: 'small',
      rationale: 'Financial hallucination in front of a pastor or donor is high-severity. Today\'s deterministic tests pass (no data exists to leak), but the persona instruction itself is the standing risk — a live model asked a fund/campaign question is coached toward fluent-sounding language it has no data to back. Removing or narrowing that specific instruction is small, contained prompt work.',
      relatedCaseIds: ['giv-know-persona-promises-data-not-present-finding', 'giv-adversarial-unsupported-campaign-or-fund-question'],
    },
    {
      gap: 'Active prayers have no date/staleness signal — a months-old and a fresh prayer are indistinguishable to the model',
      domain: 'pastoral_care',
      pilotValue: 'medium', riskIfWrong: 'medium', dataAvailability: 'available', implementationEffort: 'small',
      rationale: 'Pastoral care is high-sensitivity by nature; treating a resolved or stale concern as current in a real conversation could land badly. The date already exists on the row — surfacing it is a small addition to an existing line, not new data.',
      relatedCaseIds: ['pc-know-active-prayers-lack-date-context-finding'],
    },
  ],
  valuableAfterPilot: [
    {
      gap: 'Households (real groupings) are never exposed to Ask GRACE',
      domain: 'people_households',
      pilotValue: 'medium', riskIfWrong: 'low', dataAvailability: 'available', implementationEffort: 'medium',
      rationale: 'Genuinely useful (family-context questions are natural), but declining to answer is safe, not dangerous — no urgency to fix before a pilot. Real data exists; needs a new query plus a PII-exposure review before wiring in (household data is more sensitive than aggregate counts), matching the framework doc\'s own "Medium" sizing.',
      relatedCaseIds: ['ph-know-households-not-exposed-finding'],
    },
    {
      gap: 'Work Order / Decision Queue backlog has zero visibility to Ask GRACE (not even an opaque count)',
      domain: 'staff_work',
      pilotValue: 'medium', riskIfWrong: 'low', dataAvailability: 'partial', implementationEffort: 'large',
      rationale: 'A real, plausible staff question ("what\'s waiting for approval") with no honest answer today — but declining is safe. Wiring real Work Order/Decision Queue content into chat is a genuinely new design surface, not a quick fix, matching the framework doc\'s own "Medium/Large" sizing for this exact gap.',
      relatedCaseIds: ['stf-know-decision-queue-visibility-mischaracterized-finding'],
    },
    {
      gap: 'permissions.sensitivity is seeded with real, differentiated values but enforced nowhere at runtime',
      domain: 'governance_security_authority',
      pilotValue: 'low', riskIfWrong: 'low', dataAvailability: 'available', implementationEffort: 'medium',
      rationale: 'An internal RBAC-completeness gap, not member-facing — already documented as a finding (Fixture #007), not new to this exam. Low urgency: the coarser permission-key checks that actually gate access are unaffected by this label being unread.',
      relatedCaseIds: [],
    },
  ],
  futureAdvancedIntelligence: [
    {
      gap: 'No general certainty/hedging contract exists anywhere in the prompt/gateway',
      domain: 'church_identity',
      pilotValue: 'high', riskIfWrong: 'high', dataAvailability: 'none', implementationEffort: 'large',
      rationale: 'Disproportionately valuable despite landing in this bucket — it would improve every domain at once, not just one. Bucketed here purely on effort: a real hedging/confidence contract is a genuinely new prompt-design surface, not a quick fix, and doesn\'t currently exist in even a partial form to extend.',
      relatedCaseIds: ['ph-know-no-general-anti-inference-guardrail-finding'],
    },
    {
      gap: 'No general clarifying-question contract exists — only narrow, keyword-scoped crisis detection',
      domain: 'pastoral_care',
      pilotValue: 'medium', riskIfWrong: 'medium', dataAvailability: 'none', implementationEffort: 'large',
      rationale: 'Same shape as the certainty-contract gap above — valuable everywhere, but a new design surface, not an incremental fix.',
      relatedCaseIds: [],
    },
    {
      gap: 'Sunday/worship has no service-plan, setlist, or volunteer-scheduling data anywhere in the prompt',
      domain: 'sunday_worship',
      pilotValue: 'low', riskIfWrong: 'low', dataAvailability: 'none', implementationEffort: 'large',
      rationale: 'Currently correctly refuses (nothing to hallucinate from) — no urgency. A real fix needs new data pipelines (service plans, volunteer scheduling) that don\'t exist in any form today.',
      relatedCaseIds: ['wor-know-only-static-service-times-finding', 'wor-know-no-volunteer-schedule-grounding-finding'],
    },
    {
      gap: 'ANTICIPATE remains future capability across every domain — no proactive/scheduled injection path into chat exists',
      domain: 'church_identity',
      pilotValue: 'low', riskIfWrong: 'low', dataAvailability: 'none', implementationEffort: 'large',
      rationale: 'Explicitly out of scope for this task and the pilot generally — the largest single build in the whole map, matching the framework doc\'s own "Large" architectural-impact sizing.',
      relatedCaseIds: [],
    },
  ],
};
