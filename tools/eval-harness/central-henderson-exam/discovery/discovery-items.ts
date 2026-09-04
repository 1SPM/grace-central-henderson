/**
 * Central Henderson GRACE Discovery Instrument — core discovery items.
 *
 * Converts the qualification exam's empirical findings
 * (tools/eval-harness/central-henderson-exam/knowledge-gap-map.ts,
 * pilot-priority-ranking.ts) into structured questions for a real
 * discovery session with Central Henderson leadership. This file is the
 * source of truth for BOTH generated layers (internal technical spec,
 * Central-facing workshop guide) — see render-technical-spec.ts and
 * render-workshop-guide.ts.
 *
 * Hand-authored, not mechanically derived — same discipline as
 * knowledge-gap-map.ts/pilot-priority-ranking.ts. `relatedCaseIds` traces
 * every item back to a real qualification case; central-henderson-
 * discovery.test.ts asserts those ids actually exist.
 *
 * DOES NOT expand GRACE's intelligence architecture. Nothing here ingests
 * data, wires a new source into chat, or changes the Capability Baseline —
 * see item 11's lifecycle note at the bottom of this file.
 */
import type { IntelligenceLevel, KnowledgeDomain } from '../../types.js';

/**
 * A: Central needs to tell us/provide the information — knowledge is
 *    genuinely missing, not just inaccessible.
 * B: The product/system has the information, but Ask GRACE isn't wired to
 *    it — an engineering problem, not a Central question.
 * C: The information may exist, but who GRACE is allowed to expose it to
 *    hasn't been established — an authority/permission problem.
 * D: Supplying more data will not solve it — GRACE lacks the underlying
 *    capability (a new prompt/architecture surface, not a data gap).
 *
 * An item can carry more than one class when discovery might reveal
 * either (e.g. "A, cascading to B" — Central tells us the data exists,
 * which then becomes a wiring problem, not a data problem).
 */
export type GapAccessClass = 'A' | 'B' | 'C' | 'D';

export type DiscoveryPriority = 'needed_for_pilot' | 'valuable_after_pilot' | 'future_advanced_intelligence';

export type SourceType = 'document' | 'database_system' | 'policy' | 'staff_interview' | 'workflow_observation' | 'live_integration';

export type Sensitivity = 'public' | 'internal' | 'restricted' | 'confidential';

export type DataTemporality = 'static' | 'periodically_updated' | 'live_operational_state';

export interface DiscoveryItem {
  gapId: string;
  relatedCaseIds: string[];
  domain: KnowledgeDomain;
  priority: DiscoveryPriority;
  accessClass: GapAccessClass[];
  accessClassRationale: string;
  graceCurrentlyKnows: string;
  graceCannotCurrentlyKnow: string;
  centralQuestion: string;
  whyGraceNeedsIt: string;
  likelyAuthorizedRole: string;
  authoritativeSourceRequired: string;
  sourceType: SourceType;
  sensitivity: Sensitivity;
  permissionConsiderations: string;
  dataTemporality: DataTemporality;
  freshnessRequirement: string;
  capabilityUnlockedIfSupplied: string;
  intelligenceLevelPotentiallyUnlocked: IntelligenceLevel;
}

export const DISCOVERY_ITEMS: DiscoveryItem[] = [
  // ── Needed for pilot (4 from the ranking + 1 new, Henderson-specific-data) ──
  {
    gapId: 'dg-comms-consent-visibility',
    relatedCaseIds: ['com-know-zero-comms-visibility-finding', 'com-recommend-consent-blind-send-not-yet-testable'],
    domain: 'communications',
    priority: 'needed_for_pilot',
    accessClass: ['B'],
    accessClassRationale: 'The consents table exists, is RLS-protected, and already answers "has this person opted out" — GRACE simply never queries it before recommending or executing a send. Pure wiring, not a Central question.',
    graceCurrentlyKnows: 'How to send an email/SMS (audited, permissioned) once a staff member confirms who to send it to.',
    graceCannotCurrentlyKnow: 'Whether that person already received a similar message recently, or has opted out of communications entirely.',
    centralQuestion: 'When your team sends a text or email reminder today, who or what checks whether that person has opted out first?',
    whyGraceNeedsIt: 'Sending to an opted-out or already-messaged person is a real trust and compliance risk the pilot would be judged on.',
    likelyAuthorizedRole: 'Communications/admin staff who own the opt-out list today.',
    authoritativeSourceRequired: 'The consents table itself (already in Supabase) — this is a wiring decision, not a new source to acquire.',
    sourceType: 'database_system',
    sensitivity: 'internal',
    permissionConsiderations: 'consents already has tenant_isolation + member-self-access RLS (migration 033) — no new permission model needed, only a query GRACE currently never makes.',
    dataTemporality: 'live_operational_state',
    freshnessRequirement: 'Real-time — opt-out status must be current at send time, not cached.',
    capabilityUnlockedIfSupplied: 'A send recommendation/execution that\'s aware of consent status before it happens.',
    intelligenceLevelPotentiallyUnlocked: 'RECOMMEND',
  },
  {
    gapId: 'dg-ministry-real-activity-data',
    relatedCaseIds: ['min-know-hardcoded-demo-data-finding'],
    domain: 'ministry_discipleship',
    priority: 'needed_for_pilot',
    accessClass: ['B'],
    accessClassRationale: 'A real per-church query path (fetchCommunityPosts) already exists in the codebase; buildDataContext simply calls a zero-argument demo-data function instead. Wiring, not a missing source.',
    graceCurrentlyKnows: 'Group names and member counts (real), but "posts this week"/"inactive member" numbers are the same fixed demo data for every church.',
    graceCannotCurrentlyKnow: 'Any real group-activity signal for Central Henderson specifically.',
    centralQuestion: 'Where does your team currently see whether a small group is active or struggling — attendance, check-ins, something else?',
    whyGraceNeedsIt: 'Confident, specific-sounding fabricated numbers are an active misinformation risk, not just an honest gap — worse than declining to answer.',
    likelyAuthorizedRole: 'Whoever owns small-group/discipleship ministry operationally.',
    authoritativeSourceRequired: 'Whatever system already tracks group engagement, if any — may turn out to be "nothing yet," which is itself a useful answer.',
    sourceType: 'database_system',
    sensitivity: 'internal',
    permissionConsiderations: 'None identified yet — depends on what system, if any, Central names.',
    dataTemporality: 'periodically_updated',
    freshnessRequirement: 'Weekly-ish is likely sufficient for "posts this week" framing — confirm with Central.',
    capabilityUnlockedIfSupplied: 'Real, church-specific ministry engagement answers instead of fabricated ones.',
    intelligenceLevelPotentiallyUnlocked: 'KNOW',
  },
  {
    gapId: 'dg-giving-persona-vocabulary-mismatch',
    relatedCaseIds: ['giv-know-persona-promises-data-not-present-finding', 'giv-adversarial-unsupported-campaign-or-fund-question'],
    domain: 'giving_finance',
    priority: 'needed_for_pilot',
    accessClass: ['A'],
    accessClassRationale: 'GRACE is coached to discuss pledges/campaigns/designated funds fluently, but no such data exists anywhere in the product for ANY church — we don\'t yet know if Central even has these as distinct concepts, or where that data would live if they do.',
    graceCurrentlyKnows: 'Month-to-date and rolling-30-day giving totals, and top-5 donor names/amounts.',
    graceCannotCurrentlyKnow: 'Anything about pledges, capital campaigns, designated/restricted funds, or the benevolence fund specifically.',
    centralQuestion: 'Do you run pledge drives, capital campaigns, or designated funds separate from general giving? If so, where does that information live today?',
    whyGraceNeedsIt: 'Financial hallucination in front of a pastor or donor is the highest-severity risk in the whole exam — today GRACE correctly declines because there\'s nothing to leak, but the standing prompt-level temptation remains.',
    likelyAuthorizedRole: 'Finance/giving staff, likely whoever manages the giving platform.',
    authoritativeSourceRequired: 'Whatever system tracks pledges/campaigns, if Central has them — genuinely may not exist as a distinct system.',
    sourceType: 'staff_interview',
    sensitivity: 'restricted',
    permissionConsiderations: 'Giving data is already `restricted`-labeled (migration 032) — any new campaign/pledge source should inherit at least that sensitivity.',
    dataTemporality: 'periodically_updated',
    freshnessRequirement: 'Campaign progress is likely daily/weekly-relevant during an active campaign, static otherwise.',
    capabilityUnlockedIfSupplied: 'Either real campaign/pledge answers, or a confirmed decision to narrow the persona\'s vocabulary to match what actually exists.',
    intelligenceLevelPotentiallyUnlocked: 'KNOW',
  },
  {
    gapId: 'dg-prayer-staleness-signal',
    relatedCaseIds: ['pc-know-active-prayers-lack-date-context-finding'],
    domain: 'pastoral_care',
    priority: 'needed_for_pilot',
    accessClass: ['B'],
    accessClassRationale: 'The date already exists on every prayer_requests row — it simply isn\'t rendered into the "Active prayers" line GRACE sees. Pure wiring.',
    graceCurrentlyKnows: 'The content of unanswered, non-private prayer requests (full text, since TD-068).',
    graceCannotCurrentlyKnow: 'How old any given prayer request is — a request from yesterday and one from seven months ago look identical.',
    centralQuestion: 'How often does a prayer request stay open for months without being marked answered? Would it matter if GRACE brought up something old as if it were current?',
    whyGraceNeedsIt: 'Treating a stale, possibly-resolved concern as current in a real pastoral conversation could land badly — this is a small fix with real downside if skipped.',
    likelyAuthorizedRole: 'Pastoral care staff who manage the prayer-request workflow.',
    authoritativeSourceRequired: 'None needed — the data already exists; this is a discovery question to confirm the RISK matters before prioritizing the fix, not a source-acquisition question.',
    sourceType: 'staff_interview',
    sensitivity: 'confidential',
    permissionConsiderations: 'Prayer content is already care.view/care.manage-gated at the RLS layer for sensitive visibility tiers — this specific fix doesn\'t change who sees what, only whether staleness is signaled.',
    dataTemporality: 'live_operational_state',
    freshnessRequirement: 'Real-time — staleness is inherently a live, moving signal.',
    capabilityUnlockedIfSupplied: 'GRACE can correctly hedge or flag a stale prayer request instead of treating it as fresh.',
    intelligenceLevelPotentiallyUnlocked: 'KNOW',
  },
  {
    gapId: 'dg-henderson-specific-financial-attendance-data',
    relatedCaseIds: ['chx-know-authoritative-seed-retrieval', 'chx-remember-legal-tax-status-caveat-preserved'],
    domain: 'church_identity',
    priority: 'needed_for_pilot',
    accessClass: ['A'],
    accessClassRationale: 'The only source we hold (FY2024 audited statements) is explicitly consolidated Central Christian Church and Affiliates data, not Henderson-specific — by design, no authorized Henderson-specific financial/attendance/debt source exists in the system today. This is the clearest possible "A" — the knowledge genuinely isn\'t anywhere until Central supplies it.',
    graceCurrentlyKnows: 'Consolidated-entity mission/vision/strategy/identity facts, correctly source-attributed, and the explicit boundary that consolidated figures are not Henderson-specific.',
    graceCannotCurrentlyKnow: 'Any Henderson-specific revenue, expense, debt, attendance, or budget figure — and correctly declines rather than substituting the consolidated numbers.',
    centralQuestion: 'What\'s the right authoritative source for Henderson-specific financial and attendance figures, and who\'s authorized to approve using it in GRACE?',
    whyGraceNeedsIt: 'This is the exact distinction the whole church-knowledge feature was built around — closing it (or explicitly deciding not to, for now) is foundational to whether GRACE can answer basic "how are we doing" questions at all.',
    likelyAuthorizedRole: 'Whoever holds Henderson-campus-specific financial reporting authority — likely different from whoever approved the FY2024 consolidated document.',
    authoritativeSourceRequired: 'A Henderson-specific financial/attendance report or system, explicitly scoped and approved for this use.',
    sourceType: 'document',
    sensitivity: 'restricted',
    permissionConsiderations: 'Whatever source is named will need its own scope-boundary guardrail row (matching the existing grace_knowledge pattern) before any figure from it reaches a prompt.',
    dataTemporality: 'periodically_updated',
    freshnessRequirement: 'Likely monthly/quarterly, matching normal financial reporting cadence — confirm with Central.',
    capabilityUnlockedIfSupplied: 'Henderson-specific financial/attendance answers, replacing today\'s correct-but-limited "I don\'t have an authorized source" response.',
    intelligenceLevelPotentiallyUnlocked: 'KNOW',
  },

  // ── Valuable after pilot ──
  {
    gapId: 'dg-households-not-exposed',
    relatedCaseIds: ['ph-know-households-not-exposed-finding'],
    domain: 'people_households',
    priority: 'valuable_after_pilot',
    accessClass: ['B'],
    accessClassRationale: 'A real households/household_members table already exists in the schema (migration 031) — Ask GRACE simply never queries it. Wiring, not a missing source.',
    graceCurrentlyKnows: 'Individual person records — status, name, tags.',
    graceCannotCurrentlyKnow: 'Family/household groupings — "the Smith household" has no structured answer today.',
    centralQuestion: 'How do you currently group family members together in your records, if at all?',
    whyGraceNeedsIt: 'Family-context questions are natural for staff to ask; declining is safe but a real usability gap.',
    likelyAuthorizedRole: 'Whoever manages the member database day-to-day.',
    authoritativeSourceRequired: 'The households table itself — this is a wiring decision, plus a PII-exposure review before surfacing it (household data is more sensitive than aggregate counts).',
    sourceType: 'database_system',
    sensitivity: 'internal',
    permissionConsiderations: 'Needs a PII-exposure review before wiring in, not just a query change — household composition is more sensitive than an aggregate count.',
    dataTemporality: 'periodically_updated',
    freshnessRequirement: 'Low — households change infrequently.',
    capabilityUnlockedIfSupplied: 'Family-context-aware answers ("who else is in this household").',
    intelligenceLevelPotentiallyUnlocked: 'KNOW',
  },
  {
    gapId: 'dg-workos-decision-queue-visibility',
    relatedCaseIds: ['stf-know-decision-queue-visibility-mischaracterized-finding'],
    domain: 'staff_work',
    priority: 'valuable_after_pilot',
    accessClass: ['B'],
    accessClassRationale: 'Work Orders and the Decision Queue are real, existing product data — GRACE\'s only visibility into automation is an unrelated agent-observation count. A genuinely new design surface to wire in (larger than a simple query), but still fundamentally "data exists, GRACE isn\'t wired to it," not a missing source.',
    graceCurrentlyKnows: 'Open task titles and counts; a deterministic (non-model) overdue-tasks shortcut with real due dates.',
    graceCannotCurrentlyKnow: 'Anything about the Work Order or Decision Queue backlog — not even an opaque count.',
    centralQuestion: 'When something needs a pastor\'s approval today, how does staff currently track what\'s waiting?',
    whyGraceNeedsIt: '"What\'s waiting for approval" is a plausible, high-value staff question with no honest answer today.',
    likelyAuthorizedRole: 'Whoever manages Work Orders / the approvals workflow operationally.',
    authoritativeSourceRequired: 'The existing agent_actions/approvals tables — a wiring and design decision, not new source acquisition.',
    sourceType: 'database_system',
    sensitivity: 'internal',
    permissionConsiderations: 'Decision Queue content spans multiple domains (whatever the pending action concerns) — visibility rules would need to respect the same permission the underlying action requires.',
    dataTemporality: 'live_operational_state',
    freshnessRequirement: 'Real-time — a stale "what\'s pending" answer is actively misleading.',
    capabilityUnlockedIfSupplied: 'GRACE can answer "what\'s waiting for approval" truthfully.',
    intelligenceLevelPotentiallyUnlocked: 'KNOW',
  },
  {
    gapId: 'dg-permission-sensitivity-enforcement',
    relatedCaseIds: [],
    domain: 'governance_security_authority',
    priority: 'valuable_after_pilot',
    accessClass: ['D'],
    accessClassRationale: 'permissions.sensitivity is seeded with real, differentiated values, but no runtime code path reads it — this is a missing enforcement MECHANISM, not missing data. Supplying more information from Central won\'t resolve it; it needs an engineering/product decision (enforce the label, or formally deprecate the column).',
    graceCurrentlyKnows: 'N/A — this is an internal RBAC-completeness question, not member-facing.',
    graceCannotCurrentlyKnow: 'N/A — the gap is in enforcement, not knowledge.',
    centralQuestion: '(Not a Central question — internal engineering decision. Included here only for completeness of the domain-10 discovery pass.)',
    whyGraceNeedsIt: 'Low urgency — the coarser permission-key checks that actually gate access are unaffected by this label being unread.',
    likelyAuthorizedRole: 'N/A',
    authoritativeSourceRequired: 'N/A',
    sourceType: 'policy',
    sensitivity: 'internal',
    permissionConsiderations: 'A product decision, not a discovery question: either enforce permissions.sensitivity somewhere real, or deprecate it so it stops implying protection it doesn\'t provide.',
    dataTemporality: 'static',
    freshnessRequirement: 'N/A',
    capabilityUnlockedIfSupplied: 'N/A — this is an engineering task, not a discovery-unlockable capability.',
    intelligenceLevelPotentiallyUnlocked: 'CONNECT',
  },
  {
    gapId: 'dg-events-past-history-and-campaign-link',
    relatedCaseIds: ['evt-remember-no-past-event-history-finding', 'evt-connect-event-and-giving-campaign-cross-reference'],
    domain: 'events_calendar',
    priority: 'valuable_after_pilot',
    accessClass: ['A'],
    accessClassRationale: 'Whether past-event history or an event-to-campaign link matters at all is genuinely unknown until Central tells us — may reveal a B (data exists, not wired) or a D (no such concept exists in their operations) once asked.',
    graceCurrentlyKnows: 'Upcoming events within the next 7 days: title and date, privacy-excluded.',
    graceCannotCurrentlyKnow: 'Anything about past events, or any link between a specific event and a giving campaign.',
    centralQuestion: 'Do you ever look back at how a past event went, or connect a specific event (like a fundraiser) to a giving campaign?',
    whyGraceNeedsIt: 'Lower urgency than the pilot-critical items — mostly a coverage/completeness question for domain 6.',
    likelyAuthorizedRole: 'Events/ministry staff who plan and review events.',
    authoritativeSourceRequired: 'Whatever system, if any, tracks past-event outcomes or campaign linkage.',
    sourceType: 'staff_interview',
    sensitivity: 'internal',
    permissionConsiderations: 'None identified yet.',
    dataTemporality: 'periodically_updated',
    freshnessRequirement: 'Low — historical review is not time-sensitive.',
    capabilityUnlockedIfSupplied: 'Past-event and event-to-campaign answers, if Central actually wants them.',
    intelligenceLevelPotentiallyUnlocked: 'REMEMBER',
  },

  // ── Future advanced intelligence ──
  {
    gapId: 'dg-general-certainty-hedging-contract',
    relatedCaseIds: ['ph-know-no-general-anti-inference-guardrail-finding'],
    domain: 'church_identity',
    priority: 'future_advanced_intelligence',
    accessClass: ['D'],
    accessClassRationale: 'No amount of Central-supplied data fixes this — it\'s a missing prompt/gateway-level contract for expressing confidence or uncertainty, a new design surface, not a data gap.',
    graceCurrentlyKnows: 'N/A — this is a cross-cutting capability gap, not a domain-specific one.',
    graceCannotCurrentlyKnow: 'N/A',
    centralQuestion: '(Not a Central question — a GRACE engineering/design gap, included for completeness.)',
    whyGraceNeedsIt: 'Disproportionately valuable despite being bucketed here on effort — would improve every domain at once.',
    likelyAuthorizedRole: 'N/A',
    authoritativeSourceRequired: 'N/A',
    sourceType: 'policy',
    sensitivity: 'internal',
    permissionConsiderations: 'N/A',
    dataTemporality: 'static',
    freshnessRequirement: 'N/A',
    capabilityUnlockedIfSupplied: 'N/A — requires a new architecture surface, not discovery.',
    intelligenceLevelPotentiallyUnlocked: 'INTERPRET',
  },
  {
    gapId: 'dg-general-clarifying-question-contract',
    relatedCaseIds: [],
    domain: 'pastoral_care',
    priority: 'future_advanced_intelligence',
    accessClass: ['D'],
    accessClassRationale: 'Same shape as the certainty contract above — only detectCrisisLanguage() exists, deliberately narrow. A new design surface, not a data gap.',
    graceCurrentlyKnows: 'N/A',
    graceCannotCurrentlyKnow: 'N/A',
    centralQuestion: '(Not a Central question — a GRACE engineering/design gap, included for completeness.)',
    whyGraceNeedsIt: 'Valuable everywhere ambiguous requests occur, but a genuinely new capability to design.',
    likelyAuthorizedRole: 'N/A',
    authoritativeSourceRequired: 'N/A',
    sourceType: 'policy',
    sensitivity: 'internal',
    permissionConsiderations: 'N/A',
    dataTemporality: 'static',
    freshnessRequirement: 'N/A',
    capabilityUnlockedIfSupplied: 'N/A — requires a new architecture surface, not discovery.',
    intelligenceLevelPotentiallyUnlocked: 'INTERPRET',
  },
  {
    gapId: 'dg-sunday-worship-data-pipelines',
    relatedCaseIds: ['wor-know-only-static-service-times-finding', 'wor-know-no-volunteer-schedule-grounding-finding'],
    domain: 'sunday_worship',
    priority: 'future_advanced_intelligence',
    accessClass: ['A'],
    accessClassRationale: 'Whether Central even tracks service plans/volunteer scheduling in any structured way is unknown — likely reveals either "no such system exists yet" (a genuinely new product surface) or a real source we haven\'t asked about.',
    graceCurrentlyKnows: 'Static service times only (day/time/name).',
    graceCannotCurrentlyKnow: 'Service plans, setlists, preaching-series data, or who\'s volunteering on a given Sunday.',
    centralQuestion: 'How do you currently plan and schedule Sunday volunteers — a spreadsheet, a dedicated tool, something else?',
    whyGraceNeedsIt: 'Currently correctly refuses (nothing to hallucinate from) — low urgency, but a real capability gap if Central wants this eventually.',
    likelyAuthorizedRole: 'Worship/production staff who plan Sunday services.',
    authoritativeSourceRequired: 'Whatever system Central actually uses, if any.',
    sourceType: 'workflow_observation',
    sensitivity: 'internal',
    permissionConsiderations: 'None identified yet.',
    dataTemporality: 'periodically_updated',
    freshnessRequirement: 'Weekly, matching the service-planning cadence.',
    capabilityUnlockedIfSupplied: 'Real answers about who\'s serving and what\'s planned for an upcoming service.',
    intelligenceLevelPotentiallyUnlocked: 'KNOW',
  },
  {
    gapId: 'dg-anticipate-capability',
    relatedCaseIds: [],
    domain: 'church_identity',
    priority: 'future_advanced_intelligence',
    accessClass: ['D'],
    accessClassRationale: 'No proactive/scheduled injection path into chat exists anywhere — the largest single build in the whole map, explicitly out of scope for the pilot.',
    graceCurrentlyKnows: 'N/A',
    graceCannotCurrentlyKnow: 'N/A',
    centralQuestion: '(Not a Central question — architecture does not exist yet, included for completeness.)',
    whyGraceNeedsIt: 'N/A for the pilot.',
    likelyAuthorizedRole: 'N/A',
    authoritativeSourceRequired: 'N/A',
    sourceType: 'policy',
    sensitivity: 'internal',
    permissionConsiderations: 'N/A',
    dataTemporality: 'static',
    freshnessRequirement: 'N/A',
    capabilityUnlockedIfSupplied: 'N/A — requires a new architecture surface, not discovery.',
    intelligenceLevelPotentiallyUnlocked: 'ANTICIPATE',
  },

  // ── Cross-cutting authority item, named explicitly in the request ──
  {
    gapId: 'dg-giving-care-authority-unresolved',
    relatedCaseIds: ['pc-know-prayer-visibility-policies-exist-as-documented', 'pc-know-prayer-visibility-enforcement-live-db-boundary'],
    domain: 'pastoral_care',
    priority: 'needed_for_pilot',
    accessClass: ['B', 'C'],
    accessClassRationale: 'Giving and care data are real, RLS-protected, permission-gated at the database layer (care.view/care.manage, giving_financial.*) — but whether Ask GRACE itself should ever surface any of it in conversation, to whom, and under what conditions, is a product/authority decision that has never been made. Both the wiring (B) and the authority decision (C) are unresolved.',
    graceCurrentlyKnows: 'Aggregate giving totals and top donors (not care-specific); prayer content only at the visibility tier GRACE\'s own service-role query already resolves.',
    graceCannotCurrentlyKnow: 'Whether a given staff member, asking GRACE specifically, should see MORE or LESS than what GRACE currently surfaces by default — no per-conversation authority check exists beyond the coarse catalog permission.',
    centralQuestion: 'Who at Central should be able to ask GRACE about an individual\'s giving history or care situation, versus just seeing aggregate numbers?',
    whyGraceNeedsIt: 'Giving and pastoral care are the two most sensitive domains in the whole exam — an unresolved authority question here is the highest-stakes open item.',
    likelyAuthorizedRole: 'Senior pastoral leadership — this is a policy decision, not an operational one.',
    authoritativeSourceRequired: 'An explicit authority/permission policy decision from Central Henderson leadership, not a data source.',
    sourceType: 'policy',
    sensitivity: 'confidential',
    permissionConsiderations: 'This IS the permission consideration — see item 6\'s Authority & Sensitivity Map for the structured version of this question.',
    dataTemporality: 'static',
    freshnessRequirement: 'N/A — this is a policy decision, not a data feed.',
    capabilityUnlockedIfSupplied: 'A resolved, explicit authority boundary for giving/care conversation access — a prerequisite for any future work on either domain, not a capability itself.',
    intelligenceLevelPotentiallyUnlocked: 'INTERPRET',
  },
];

/**
 * The intended lifecycle (item 11) — document this explicitly, everywhere
 * this data is rendered: a workshop answer alone must NEVER automatically
 * move a capability to PROVEN. Only a subsequently implemented and passing
 * qualification fixture can do that.
 *
 *   Qualification test → Knowledge gap → Discovery question →
 *   Authorized source → GRACE integration/knowledge → Qualification
 *   retest → Capability becomes PROVEN
 */
export const DISCOVERY_TO_QUALIFICATION_LIFECYCLE = [
  '1. Qualification test (tools/eval-harness/central-henderson-exam/) finds a gap.',
  '2. The gap is recorded in knowledge-gap-map.ts and, if actionable, becomes a DiscoveryItem here.',
  '3. A discovery question is asked of Central Henderson leadership (this instrument).',
  '4. Central supplies (or declines to supply) an authorized source.',
  '5. GRACE is integrated with that source — a real, separate engineering task, not part of this instrument.',
  '6. The qualification exam is RE-RUN against the new integration.',
  '7. ONLY a passing qualification case moves the relevant cell to PROVEN in the Capability Baseline — a workshop answer alone never does.',
];
