/**
 * Central Henderson Knowledge Gap Map — hand-authored, not mechanically
 * derived from case metadata. A case's PASS/FAIL alone can't produce
 * entries like "missing entirely: pledge/campaign/fund data," where the
 * absence itself IS the finding — this requires the same kind of product
 * judgment that produced docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md's
 * own §5 findings list, also hand-written. `relatedCaseIds` gives
 * traceability back to ALL_EXAM_CASES; central-henderson-exam.test.ts
 * asserts every id referenced here actually exists, so a renamed/removed
 * case surfaces as a loud test failure, not silent drift.
 */
import type { KnowledgeDomain } from '../types.js';

export interface DomainGapMapEntry {
  domain: KnowledgeDomain;
  knownFromAuthoritativeSources: string[];
  knownOnlyFromSupplementarySources: string[];
  existsInProductNotExposedToChat: string[];
  missingEntirely: string[];
  needsAdditionalPermissionControls: string[];
  cannotBeTestedAtAll: string[];
  pilotLimitingGaps: string[];
  relatedCaseIds: string[];
}

export type KnowledgeGapMap = Record<KnowledgeDomain, DomainGapMapEntry>;

export const CENTRAL_HENDERSON_GAP_MAP: KnowledgeGapMap = {
  church_identity: {
    knownFromAuthoritativeSources: [
      'Identity: catalyst church, "one church in many locations," independent/non-denominational.',
      'Mission: "We exist to introduce people to Jesus and help them follow Him."',
      'Vision: reproducible-environments statement.',
      'Four-part strategy (attend/invite/next-step/give) — navigation language only, never a score.',
      'Ownership path (salvation, baptism, First Step).',
      'All 5 scope-boundary guardrails (consolidated financials, affiliate activity, campus metrics, giving/care permissioning, legal/tax status verification-required).',
    ],
    knownOnlyFromSupplementarySources: ['A staff member\'s own conversation notes about identity/mission topics (grace_memories), always subordinate to the authoritative block.'],
    existsInProductNotExposedToChat: [],
    missingEntirely: ['Any Henderson-specific financial/attendance/debt figure — by design, no authorized source exists.'],
    needsAdditionalPermissionControls: [],
    cannotBeTestedAtAll: ['Whether GRACE relates strategy language to a real member\'s engagement pattern without turning it into a score (CONNECT/INTERPRET) — no live-judgment harness exercised this pass.'],
    pilotLimitingGaps: [],
    relatedCaseIds: ['chx-know-authoritative-seed-retrieval', 'chx-remember-legal-tax-status-caveat-preserved', 'chx-connect-strategy-and-attendance-cross-reference'],
  },
  people_households: {
    knownFromAuthoritativeSources: ['Live person records (status, tags) as client-composed dataContext.'],
    knownOnlyFromSupplementarySources: ['Person-tagged staff notes via grace_memories, name-matched to real people, always attributed and subordinate to live data.'],
    existsInProductNotExposedToChat: ['Households/household groupings (real table, migration 031) — never queried by buildDataContext.'],
    missingEntirely: [],
    needsAdditionalPermissionControls: [],
    cannotBeTestedAtAll: ['A general certainty/hedging or clarifying-question contract — none exists to test against, at any domain.'],
    pilotLimitingGaps: ['Households invisible to chat — a pastor asking about "the Smith household" gets no structured answer even though the data model supports it.'],
    relatedCaseIds: ['ph-know-households-not-exposed-finding', 'ph-remember-memory-vs-authoritative-distinction', 'ph-know-no-general-anti-inference-guardrail-finding'],
  },
  ministry_discipleship: {
    knownFromAuthoritativeSources: [],
    knownOnlyFromSupplementarySources: [],
    existsInProductNotExposedToChat: ['Real per-church group-activity data (fetchCommunityPosts) — exists but unused by buildDataContext.'],
    missingEntirely: ['Discipleship milestones, ministry assignments, curriculum/step tracking — no mechanism at all.'],
    needsAdditionalPermissionControls: [],
    cannotBeTestedAtAll: ['Any REMEMBER+ claim — no retrieval mechanism exists for ministry content.'],
    pilotLimitingGaps: ['Group-activity numbers reaching the prompt are hardcoded demo data, indistinguishable from real data — a genuine trust risk if surfaced to a pastor as if real.'],
    relatedCaseIds: ['min-know-hardcoded-demo-data-finding', 'min-know-zero-ministry-catalog-actions-finding', 'min-remember-no-grounding-tracking'],
  },
  pastoral_care: {
    knownFromAuthoritativeSources: ['Unanswered, non-private prayer content (full text, post-TD-068) reaches the prompt, capped to 6 items.'],
    knownOnlyFromSupplementarySources: ['Person-tagged care-related staff notes via grace_memories, attributed "noted from chat," never formatted as a live record.'],
    existsInProductNotExposedToChat: [],
    missingEntirely: ['Per-prayer date/staleness signal — a recent and a months-old prayer look identical to the model.'],
    needsAdditionalPermissionControls: ['private_pastoral_care/specific_care_team-visibility prayers — real RLS exists (care.view/care.manage-gated), but this harness cannot prove enforcement, only that the policy text exists.'],
    cannotBeTestedAtAll: ['Real RLS enforcement on prayer_requests (needs tools/rls-read-restriction-smoke.test.ts, a live-DB suite, not this harness).'],
    pilotLimitingGaps: ['No staleness signal — GRACE could be pressured into treating a months-old prayer as an urgent, current concern with nothing in the prompt to resist that.'],
    relatedCaseIds: [
      'pc-know-prayer-visibility-policies-exist-as-documented', 'pc-know-prayer-visibility-enforcement-live-db-boundary',
      'pc-know-active-prayers-lack-date-context-finding', 'pc-remember-care-memory-attribution-preserved',
    ],
  },
  sunday_worship: {
    knownFromAuthoritativeSources: ['Static service times (day/time/name) from church profile.'],
    knownOnlyFromSupplementarySources: [],
    existsInProductNotExposedToChat: [],
    missingEntirely: ['Service plans, setlists, preaching-series data, volunteer scheduling — nothing reaches the prompt beyond static service times.'],
    needsAdditionalPermissionControls: [],
    cannotBeTestedAtAll: ['Any REMEMBER+ claim — no retrieval mechanism exists for worship content.'],
    pilotLimitingGaps: ['A "who\'s serving this Sunday" question has zero grounding — any specific answer would be fabricated.'],
    relatedCaseIds: ['wor-know-only-static-service-times-finding', 'wor-know-no-volunteer-schedule-grounding-finding', 'wor-remember-no-grounding-tracking'],
  },
  events_calendar: {
    knownFromAuthoritativeSources: ['Upcoming events within 7 days: title + date, privacy-excluded (Fixture #005).'],
    knownOnlyFromSupplementarySources: [],
    existsInProductNotExposedToChat: ['Event location, capacity, RSVP/registration data.'],
    missingEntirely: ['Past-event history/retrieval — only a single forward-looking snapshot exists.', 'Room/resource data — no table exists at all, ANTICIPATE (room-conflict detection) is architecturally impossible, not just untested.'],
    needsAdditionalPermissionControls: [],
    cannotBeTestedAtAll: ['Event-to-giving-campaign cross-reference (CONNECT) — no campaign concept exists to relate an event to.'],
    pilotLimitingGaps: [],
    relatedCaseIds: ['evt-connect-event-and-giving-campaign-cross-reference', 'evt-remember-no-past-event-history-finding'],
  },
  giving_finance: {
    knownFromAuthoritativeSources: ['MTD total, rolling-30d total, top-5 donor names+amounts — correctly labeled and distinguished from each other.'],
    knownOnlyFromSupplementarySources: [],
    existsInProductNotExposedToChat: [],
    missingEntirely: ['Pledges, faith promises, designated/restricted funds, capital campaigns, benevolence-fund balances — the persona coaches fluent vocabulary for all of these with zero backing data.'],
    needsAdditionalPermissionControls: [],
    cannotBeTestedAtAll: ['Any REMEMBER+ claim — no retrieval mechanism exists for pledge/campaign/fund history.'],
    pilotLimitingGaps: ['The persona/data mismatch is the single highest hallucination-risk surface in the whole exam — the model is explicitly coached to sound fluent about data it structurally does not have.'],
    relatedCaseIds: [
      'giv-know-persona-promises-data-not-present-finding', 'giv-know-mtd-vs-30d-labeling-correct',
      'giv-adversarial-unsupported-campaign-or-fund-question', 'giv-remember-no-pledge-fund-grounding-tracking',
    ],
  },
  staff_work: {
    knownFromAuthoritativeSources: ['Open task titles and counts (Fixture #006); a deterministic non-model overdue-tasks shortcut with real due dates.'],
    knownOnlyFromSupplementarySources: [],
    existsInProductNotExposedToChat: ['Task due dates, priority, and assignee (title-only reaches the prompt, per Fixture #006).', 'Work Order / Decision Queue content and backlog — GRACE has zero visibility, not even an opaque count (corrects the framework doc\'s own understated claim).'],
    missingEntirely: ['Staff hours/workload/capacity data — no mechanism at all.'],
    needsAdditionalPermissionControls: [],
    cannotBeTestedAtAll: ['Any REMEMBER+ claim beyond the domain-agnostic person-tagged memory mechanism already proven generically.'],
    pilotLimitingGaps: ['Zero Decision Queue visibility means GRACE cannot answer "what\'s waiting for approval" — a plausible, high-value pilot question with no path to a truthful answer today.'],
    relatedCaseIds: ['stf-adversarial-staffing-capacity-claim-refused', 'stf-know-decision-queue-visibility-mischaracterized-finding', 'stf-remember-no-staff-history-grounding-tracking'],
  },
  communications: {
    knownFromAuthoritativeSources: [],
    knownOnlyFromSupplementarySources: [],
    existsInProductNotExposedToChat: ['Announcements, scheduled_messages, consents/opt-out status — none reach the prompt, though all three tables exist and consents is RLS-protected.'],
    missingEntirely: ['Any record of prior sends the model could check before recommending a new one.'],
    needsAdditionalPermissionControls: ['consents — real RLS exists (tenant_isolation + member-self-access), but GRACE cannot see it to honor it in a recommendation; this is a visibility gap layered on top of an already-correct permission boundary, not a permission gap by itself.'],
    cannotBeTestedAtAll: ['Whether a send proposal is checked against a recipient\'s consent/opt-out status — /api/actions/_propose.ts never queries consents for any action type, so there is nothing to even partially inspect.'],
    pilotLimitingGaps: ['send_email/send_sms are real, audited, permissioned actions with zero visibility into what\'s already been sent or who\'s opted out — the domain with the largest gap between action capability and informational grounding in the whole exam.'],
    relatedCaseIds: ['com-know-zero-comms-visibility-finding', 'com-recommend-consent-blind-send-not-yet-testable', 'com-act-send-audited-positive'],
  },
  governance_security_authority: {
    knownFromAuthoritativeSources: ['Permission denial, catalog/requiresApproval routing, execute/propose provenance, tenant-scope resolution — comprehensively proven by Fixture #002.'],
    knownOnlyFromSupplementarySources: [],
    existsInProductNotExposedToChat: [],
    missingEntirely: [],
    needsAdditionalPermissionControls: [],
    cannotBeTestedAtAll: ['Real RLS enforcement generally (needs the live-DB smoke-test suite, not this harness) — the mock proves app-layer permission checks and policy text, never Postgres enforcement itself.'],
    pilotLimitingGaps: [],
    relatedCaseIds: ['gov-know-consents-rls-confirmed', 'gov-act-central-henderson-tenant-scope-cross-check'],
  },
};

export function renderGapMapMarkdown(map: KnowledgeGapMap): string {
  const lines: string[] = ['# Central Henderson Knowledge Gap Map', ''];
  for (const [domain, entry] of Object.entries(map)) {
    lines.push(`## ${domain}`);
    const section = (label: string, items: string[]) => {
      lines.push(`**${label}:**`);
      lines.push(items.length ? items.map(i => `- ${i}`).join('\n') : '- (none)');
    };
    section('Known from authoritative sources', entry.knownFromAuthoritativeSources);
    section('Known only from supplementary sources', entry.knownOnlyFromSupplementarySources);
    section('Exists in product, not exposed to chat', entry.existsInProductNotExposedToChat);
    section('Missing entirely', entry.missingEntirely);
    section('Needs additional permission controls', entry.needsAdditionalPermissionControls);
    section('Cannot currently be tested at all', entry.cannotBeTestedAtAll);
    section('Gaps that most limit pilot usefulness', entry.pilotLimitingGaps);
    lines.push(`**Related cases:** ${entry.relatedCaseIds.join(', ') || '(none)'}`);
    lines.push('');
  }
  return lines.join('\n');
}
