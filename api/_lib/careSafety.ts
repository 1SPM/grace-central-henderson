/**
 * Crisis-language detection and member-safe status mapping for the care
 * and prayer workflows.
 *
 * detectCrisisLanguage is DELIBERATELY simple and deterministic — the
 * same keyword-pattern approach already proven in
 * previews/grace-companion.js (RX.crisis), not a model call. This is a
 * FLAG for human review, never a diagnosis and never an autonomous
 * action: a true positive routes to a human; a false positive costs a
 * pastoral-care team member two minutes reading a message that turned
 * out to be fine. That asymmetry is why this stays a keyword match
 * instead of anything fuzzier — see docs/AI_BOUNDARIES.md.
 */

const CRISIS_PATTERN = /suicid|kill myself|self.?harm|hurt myself|hurting myself|end my life|don.?t want to live|overdose|abus(e|ive|ed)/i;

export function detectCrisisLanguage(text: string | null | undefined): boolean {
  if (!text) return false;
  return CRISIS_PATTERN.test(text);
}

/**
 * Approved crisis-resource copy — never invented at request time (by a
 * human or a model), never a promise of emergency response, always this
 * exact vetted text. Single source of truth: api/portal/_prayer.ts and
 * the member assistant runtime (api/_lib/ai/assistant-runtime.ts) both
 * import this rather than each keeping their own copy.
 */
export const CRISIS_RESOURCE_MESSAGE =
  'If you are in immediate danger, please call or text 988 (Suicide & Crisis Lifeline) or call 911. ' +
  'Your message has been routed directly to pastoral care for human follow-up.';

/**
 * Member-facing status for a care_requests row. Same five-label set as
 * api/_lib/portalRequestTask.ts's toMemberFacingStatus (Received /
 * Assigned / In Progress / Waiting for Information / Completed) — never
 * the internal care_requests.status value, never crisis_flagged, never
 * sentinel_review_status, never who is assigned.
 */
export type CareMemberStatus = 'Received' | 'Assigned' | 'In Progress' | 'Waiting for Information' | 'Completed';

export function toCareMemberStatus(status: string, hasAssignment: boolean): CareMemberStatus {
  switch (status) {
    case 'submitted':
      return 'Received';
    case 'triaged':
      return hasAssignment ? 'Assigned' : 'Received';
    case 'assigned':
      return 'Assigned';
    case 'in_progress':
      return 'In Progress';
    case 'resolved':
    case 'closed':
      return 'Completed';
    default:
      return 'Received';
  }
}

/**
 * A prayer or care request's visibility, resolved AFTER the crisis-
 * language safety override — crisis language always wins over whatever
 * the member selected. Pure so the override behavior itself (not just
 * detection) is directly testable.
 */
export function resolveEffectiveVisibility<V extends string>(
  requestedVisibility: V,
  crisisFlagged: boolean,
  privateFallback: V,
): V {
  return crisisFlagged ? privateFallback : requestedVisibility;
}

/**
 * The structural crisis-review gate: a care request cannot move to a
 * closing status while a human privacy/safety review is still pending.
 * The system never bypasses this itself — only a human setting
 * sentinel_review_status to 'cleared' (or the request never having
 * required review) unlocks closure.
 */
const CLOSING_STATUSES = new Set(['resolved', 'closed']);

export function canCloseCareRequest(targetStatus: string, sentinelReviewStatus: string): boolean {
  if (!CLOSING_STATUSES.has(targetStatus)) return true;
  return sentinelReviewStatus !== 'pending';
}
