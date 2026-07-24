/**
 * Congregational Health scorecard — pure functions, no IO. The route
 * (api/impact/_health.ts) fetches raw rows and passes them in here.
 *
 * Honesty convention (matches api/_lib/impactCardFunnelMetrics.ts):
 * every metric returns { value: null, source: 'not_yet_computed' } when
 * the denominator or backing data is empty — never a fabricated 0 or
 * ratio. `computed` metrics are always derived from real rows, never
 * estimated or interpolated.
 *
 * IMPORTANT — engagement score framing (hard requirement, code AND UI
 * copy both): computeEngagementScore measures platform engagement
 * (activity), never spiritual standing. It is not a measure of a
 * person's faith, character, or worth — only how much recorded activity
 * they've had on the platform recently. Every surface that renders this
 * score must carry that caveat.
 */

const MEMBER_LIKE_STATUSES = new Set(['member', 'regular']);

// ---------------------------------------------------------------------
// Engagement score
// ---------------------------------------------------------------------

export interface EngagementEvent {
  event_type: string;
  created_at: string;
}

/**
 * High-intent events (a gift, an RSVP, a check-in, joining a group,
 * hitting a discipleship milestone) weigh more than passive ones
 * (signing in, viewing a page). Any event type not listed here is
 * treated as passive (DEFAULT_WEIGHT) — an unrecognized *_view-style
 * event should never outweigh a real action.
 */
const EVENT_WEIGHTS: Record<string, number> = {
  gift: 10,
  milestone_achieved: 10,
  rsvp: 8,
  checkin: 8,
  group_join: 8,
  login: 2,
};
const DEFAULT_EVENT_WEIGHT = 2;

const ENGAGEMENT_WINDOW_DAYS = 90;
/** No single event type can contribute more than this to the final score — repeating one behavior (e.g. logging in daily) can't max out the score on its own. */
const PER_TYPE_CONTRIBUTION_CAP = 30;

function eventWeight(eventType: string): number {
  return EVENT_WEIGHTS[eventType] ?? DEFAULT_EVENT_WEIGHT;
}

/**
 * Recency-weighted activity score, 0-100, over the trailing 90 days.
 * Formula: for each event within the window, weight(type) * recency,
 * where recency decays linearly from 1.0 (today) to 0.0 (90 days ago).
 * Contributions are summed per event type, each type capped at
 * PER_TYPE_CONTRIBUTION_CAP, then the capped per-type totals are summed
 * and clamped to [0, 100].
 */
export function computeEngagementScore(events: EngagementEvent[], now: Date): number {
  const windowStartMs = now.getTime() - ENGAGEMENT_WINDOW_DAYS * 86_400_000;
  const nowMs = now.getTime();

  const contributionByType = new Map<string, number>();
  for (const event of events) {
    const eventMs = new Date(event.created_at).getTime();
    if (Number.isNaN(eventMs) || eventMs < windowStartMs || eventMs > nowMs) continue;
    const daysAgo = (nowMs - eventMs) / 86_400_000;
    const recency = Math.max(0, 1 - daysAgo / ENGAGEMENT_WINDOW_DAYS);
    const contribution = eventWeight(event.event_type) * recency;
    contributionByType.set(event.event_type, (contributionByType.get(event.event_type) ?? 0) + contribution);
  }

  let total = 0;
  for (const contribution of contributionByType.values()) {
    total += Math.min(contribution, PER_TYPE_CONTRIBUTION_CAP);
  }
  return Math.max(0, Math.min(100, Math.round(total)));
}

// ---------------------------------------------------------------------
// At-risk members
// ---------------------------------------------------------------------

export interface AtRiskPersonRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export interface AtRiskEvent {
  person_id: string;
  created_at: string;
}

export interface AtRiskMember {
  id: string;
  name: string;
  last_activity_at: string;
}

const AT_RISK_LOOKBACK_DAYS = 180;
const AT_RISK_RECENT_DAYS = 45;

/**
 * Explainable rule (beats a clever one): a person is "at risk" when they
 * had activity within the last 180 days but none within the last 45.
 * Someone with no activity at all in 180 days isn't newly at-risk —
 * they're already long gone; this flags people whose engagement just
 * dropped off. "Within the last N days" is inclusive of exactly N days
 * ago.
 */
export function computeAtRiskMembers(
  events: AtRiskEvent[],
  people: AtRiskPersonRow[],
  now: Date,
): AtRiskMember[] {
  const nowMs = now.getTime();
  const lookbackStartMs = nowMs - AT_RISK_LOOKBACK_DAYS * 86_400_000;
  const recentCutoffMs = nowMs - AT_RISK_RECENT_DAYS * 86_400_000;

  const lastActivityMsByPerson = new Map<string, number>();
  for (const event of events) {
    const eventMs = new Date(event.created_at).getTime();
    if (Number.isNaN(eventMs)) continue;
    const existing = lastActivityMsByPerson.get(event.person_id);
    if (existing === undefined || eventMs > existing) {
      lastActivityMsByPerson.set(event.person_id, eventMs);
    }
  }

  const peopleById = new Map(people.map(p => [p.id, p]));
  const out: AtRiskMember[] = [];
  for (const [personId, lastMs] of lastActivityMsByPerson) {
    if (lastMs < lookbackStartMs) continue;
    if (lastMs >= recentCutoffMs) continue;
    const person = peopleById.get(personId);
    if (!person) continue;
    out.push({
      id: personId,
      name: [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || 'Unknown',
      last_activity_at: new Date(lastMs).toISOString(),
    });
  }
  return out.sort((a, b) => a.last_activity_at.localeCompare(b.last_activity_at));
}

// ---------------------------------------------------------------------
// Church-level north stars
// ---------------------------------------------------------------------

export interface HealthMetricValue {
  value: number | null;
  source: 'computed' | 'not_yet_computed';
  detail: string;
}

export interface HealthMetricsPersonRow {
  id: string;
  status: string;
  first_visit: string | null;
  portal_enabled: boolean;
  clerk_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface HealthMetricsInput {
  people: HealthMetricsPersonRow[];
  /** Already filtered to status='active'. */
  activeRecurringGivers: Array<{ person_id: string | null }>;
  /** Already filtered to status='active'. */
  activeGroupMemberships: Array<{ person_id: string }>;
  /** Already filtered to status='submitted'. */
  openCareRequests: Array<{ created_at: string }>;
  /** member_activity_events rows within the last ENGAGEMENT_WINDOW_DAYS, all people. */
  events: Array<{ person_id: string; event_type: string; created_at: string }>;
  now: Date;
}

export interface HealthMetricsResult {
  visitor_conversion_90d: HealthMetricValue;
  recurring_coverage: HealthMetricValue;
  care_responsiveness: HealthMetricValue;
  group_participation: HealthMetricValue;
  portal_adoption: HealthMetricValue;
  engagement: HealthMetricValue & { at_risk_count: number };
}

function ratioMetric(numerator: number, denominator: number, detail: string): HealthMetricValue {
  if (denominator === 0) return { value: null, source: 'not_yet_computed', detail };
  return { value: Math.round((numerator / denominator) * 1000) / 10, source: 'computed', detail };
}

function median(sortedAscending: number[]): number {
  const mid = Math.floor(sortedAscending.length / 2);
  return sortedAscending.length % 2 === 0
    ? (sortedAscending[mid - 1] + sortedAscending[mid]) / 2
    : sortedAscending[mid];
}

export function computeHealthMetrics(input: HealthMetricsInput): HealthMetricsResult {
  const { people, activeRecurringGivers, activeGroupMemberships, openCareRequests, events, now } = input;
  const nowMs = now.getTime();

  const memberLike = people.filter(p => MEMBER_LIKE_STATUSES.has(p.status));
  const memberLikeIds = new Set(memberLike.map(p => p.id));

  const ninetyDaysAgoMs = nowMs - 90 * 86_400_000;
  const recentVisitors = people.filter(p => {
    if (!p.first_visit) return false;
    const t = new Date(p.first_visit).getTime();
    return !Number.isNaN(t) && t >= ninetyDaysAgoMs && t <= nowMs;
  });
  const convertedVisitors = recentVisitors.filter(p => memberLikeIds.has(p.id));
  const visitor_conversion_90d = ratioMetric(
    convertedVisitors.length,
    recentVisitors.length,
    "Share of first-time visitors in the last 90 days who are now a member or regular attender.",
  );

  const recurringGiverIds = new Set(activeRecurringGivers.map(r => r.person_id).filter((id): id is string => !!id));
  const coveredMembers = memberLike.filter(p => recurringGiverIds.has(p.id));
  const recurring_coverage = ratioMetric(
    coveredMembers.length,
    memberLike.length,
    'Share of members/regular attenders with an active recurring gift.',
  );

  // care_requests has no triage timestamp, so this is an honest
  // substitute for a response-time SLA: how long currently-open
  // requests have been waiting, not how quickly they were handled.
  let care_responsiveness: HealthMetricValue;
  if (openCareRequests.length === 0) {
    care_responsiveness = {
      value: null,
      source: 'not_yet_computed',
      detail: 'Median age (hours) of currently-open care requests awaiting a response. No open requests right now.',
    };
  } else {
    const agesHours = openCareRequests
      .map(r => (nowMs - new Date(r.created_at).getTime()) / 3_600_000)
      .filter(h => Number.isFinite(h) && h >= 0)
      .sort((a, b) => a - b);
    care_responsiveness = {
      value: Math.round(median(agesHours) * 10) / 10,
      source: 'computed',
      detail: 'Median age (hours) of currently-open care requests awaiting a response — an open care request age, not a response-time SLA.',
    };
  }

  const participatingIds = new Set(activeGroupMemberships.map(g => g.person_id));
  const participatingMembers = memberLike.filter(p => participatingIds.has(p.id));
  const group_participation = ratioMetric(
    participatingMembers.length,
    memberLike.length,
    'Share of members/regular attenders active in at least one group.',
  );

  const portalMembers = memberLike.filter(p => p.portal_enabled && !!p.clerk_user_id);
  const portal_adoption = ratioMetric(
    portalMembers.length,
    memberLike.length,
    'Share of members/regular attenders with an active Members Portal account.',
  );

  const eventsByPerson = new Map<string, EngagementEvent[]>();
  for (const event of events) {
    const arr = eventsByPerson.get(event.person_id) ?? [];
    arr.push({ event_type: event.event_type, created_at: event.created_at });
    eventsByPerson.set(event.person_id, arr);
  }
  const atRiskCount = computeAtRiskMembers(events, people, now).length;

  let engagement: HealthMetricValue & { at_risk_count: number };
  const engagementDetail = 'Mean platform-engagement score (0-100, recency-weighted activity over 90 days) across members/regular attenders. Measures platform engagement, never spiritual standing.';
  if (memberLike.length === 0) {
    engagement = { value: null, source: 'not_yet_computed', detail: engagementDetail, at_risk_count: atRiskCount };
  } else {
    const scores = memberLike.map(p => computeEngagementScore(eventsByPerson.get(p.id) ?? [], now));
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    engagement = { value: Math.round(mean * 10) / 10, source: 'computed', detail: engagementDetail, at_risk_count: atRiskCount };
  }

  return { visitor_conversion_90d, recurring_coverage, care_responsiveness, group_participation, portal_adoption, engagement };
}
