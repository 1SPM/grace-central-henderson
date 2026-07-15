/**
 * Impact Card adoption-funnel metrics for the Admin Dashboard.
 *
 * Pure-function design: the route handler (api/impact-card/_funnel-
 * metrics.ts) fetches rows from kyc_verifications, cards, interchange_events,
 * impact_allocations, work_orders, and cron_runs; this module turns them
 * into the metric set. No IO, no Supabase client — directly unit-testable.
 *
 * Every metric returned carries source/definition/period/calculation/
 * assumptions/data_freshness/reconciliation_status, per the giving/Impact
 * Card phase brief. Two figures the brief asks for — "program benefit" and
 * a full "campaign performance" response-rate — have no backing source
 * table in the current schema (there is no church-program-benefit ledger,
 * and onboarding campaigns are tracked only as Work Order lifecycle, not
 * per-recipient attribution). Those are returned with
 * value: null, source: 'not_yet_computed' rather than a fabricated number —
 * required by "do not represent mock financial functionality as live."
 */

export interface ImpactCardMetric {
  value: number | null;
  source: string;
  definition: string;
  reporting_period: { start: string; end: string };
  calculation: string;
  assumptions: string;
  data_freshness: string;
  reconciliation_status: 'reconciled' | 'not_applicable' | 'exceptions_open' | 'not_yet_computed';
}

export interface KycRow { status: string; submitted_at: string }
export interface CardRow { status: string; activated_at: string | null; issued_at: string }
export interface InterchangeEventRow { card_id: string | null; event_type: string; direction: string; occurred_at: string }
export interface ImpactAllocationRow { amount_micro_usd: number; period_month: string }
export interface SupportWorkOrderRow { status: string; created_at: string }
export interface ReconciliationWorkOrderRow { status: string; created_at: string }
export interface CampaignWorkOrderRow { status: string; created_at: string }
export interface CronRunRow { ok: boolean; created_at: string; summary: Record<string, unknown> | null }

export interface FunnelMetricsInput {
  periodStart: string; // ISO
  periodEnd: string;   // ISO
  asOf: string;         // ISO — when this data was fetched, for data_freshness
  kyc: KycRow[];
  cards: CardRow[];
  interchangeEvents: InterchangeEventRow[];
  impactAllocations: ImpactAllocationRow[];
  supportWorkOrders: SupportWorkOrderRow[];
  reconciliationWorkOrders: ReconciliationWorkOrderRow[];
  campaignWorkOrders: CampaignWorkOrderRow[];
  latestReconcileCronRun: CronRunRow | null;
}

export interface ImpactCardFunnelMetrics {
  application_count: ImpactCardMetric;
  completion_count: ImpactCardMetric;
  activation_count: ImpactCardMetric;
  active_participation: ImpactCardMetric;
  approved_aggregate_value_usd: ImpactCardMetric;
  program_benefit: ImpactCardMetric;
  onboarding_drop_off_rate: ImpactCardMetric;
  support_cases: ImpactCardMetric;
  reconciliation_status: ImpactCardMetric;
  campaign_performance: ImpactCardMetric;
}

const OPEN_WORK_ORDER_STATUSES = new Set(['draft', 'planning', 'awaiting_approval', 'in_progress', 'blocked', 'under_review']);

function inPeriod(iso: string, start: string, end: string): boolean {
  return iso >= start && iso < end;
}

export function computeImpactCardFunnelMetrics(input: FunnelMetricsInput): ImpactCardFunnelMetrics {
  const { periodStart, periodEnd, asOf } = input;
  const period = { start: periodStart, end: periodEnd };
  const freshness = `Computed at ${asOf} from live database rows (not cached).`;

  const kycInPeriod = input.kyc.filter(k => inPeriod(k.submitted_at, periodStart, periodEnd));
  const applicationCount = kycInPeriod.length;
  const completionCount = kycInPeriod.filter(k => k.status === 'approved').length;

  const activatedInPeriod = input.cards.filter(c => c.activated_at && inPeriod(c.activated_at, periodStart, periodEnd));
  const activationCount = activatedInPeriod.length;

  const activeCardsWithSpend = new Set<string>();
  for (const ev of input.interchangeEvents) {
    if (!ev.card_id) continue;
    if (ev.event_type !== 'capture' || ev.direction !== 'debit') continue;
    if (!inPeriod(ev.occurred_at, periodStart, periodEnd)) continue;
    activeCardsWithSpend.add(ev.card_id);
  }
  const activeParticipation = activeCardsWithSpend.size;

  const approvedAggregateMicroUsd = input.impactAllocations
    .filter(a => inPeriod(`${a.period_month}T00:00:00.000Z`, periodStart, periodEnd))
    .reduce((sum, a) => sum + a.amount_micro_usd, 0);

  const dropOffRate = applicationCount > 0 ? (applicationCount - completionCount) / applicationCount : null;

  const supportInPeriod = input.supportWorkOrders.filter(w => inPeriod(w.created_at, periodStart, periodEnd));
  const supportOpen = supportInPeriod.filter(w => OPEN_WORK_ORDER_STATUSES.has(w.status)).length;

  const reconciliationOpen = input.reconciliationWorkOrders.filter(w => OPEN_WORK_ORDER_STATUSES.has(w.status)).length;
  const cronRun = input.latestReconcileCronRun;

  const campaignsInPeriod = input.campaignWorkOrders.filter(w => inPeriod(w.created_at, periodStart, periodEnd));
  const campaignsCompleted = campaignsInPeriod.filter(w => w.status === 'completed').length;

  return {
    application_count: {
      value: applicationCount,
      source: 'kyc_verifications',
      definition: 'Number of Impact Card applications (KYC submissions) started in the reporting period.',
      reporting_period: period,
      calculation: 'COUNT(kyc_verifications) WHERE submitted_at is within the reporting period.',
      assumptions: 'One row per application attempt; a member who reapplies after rejection counts twice.',
      data_freshness: freshness,
      reconciliation_status: 'not_applicable',
    },
    completion_count: {
      value: completionCount,
      source: 'kyc_verifications',
      definition: 'Number of applications from the period that reached status=approved.',
      reporting_period: period,
      calculation: "COUNT(kyc_verifications) WHERE submitted_at is within the period AND status='approved'.",
      assumptions: 'Counts approval regardless of when the approval itself was recorded, not just applications approved within the period.',
      data_freshness: freshness,
      reconciliation_status: 'not_applicable',
    },
    activation_count: {
      value: activationCount,
      source: 'cards',
      definition: 'Number of issued cards activated (activated_at set) during the reporting period.',
      reporting_period: period,
      calculation: 'COUNT(cards) WHERE activated_at is within the reporting period.',
      assumptions: 'A card issued in a prior period but activated in this one counts in this period, not the issuance period.',
      data_freshness: freshness,
      reconciliation_status: 'not_applicable',
    },
    active_participation: {
      value: activeParticipation,
      source: 'interchange_events',
      definition: 'Number of distinct active cards with at least one settled purchase (capture) during the reporting period.',
      reporting_period: period,
      calculation: "COUNT(DISTINCT card_id) FROM interchange_events WHERE event_type='capture' AND direction='debit' AND occurred_at is within the period.",
      assumptions: 'Counts card-level activity, not member-level; a member with two active cards used in the period counts as two.',
      data_freshness: freshness,
      reconciliation_status: 'not_applicable',
    },
    approved_aggregate_value_usd: {
      value: approvedAggregateMicroUsd / 1_000_000,
      source: 'impact_allocations',
      definition: 'Total Impact Card value approved/credited to members, church programs, or causes during the reporting period.',
      reporting_period: period,
      calculation: 'SUM(amount_micro_usd) FROM impact_allocations WHERE period_month falls within the reporting period, converted to USD.',
      assumptions: 'Reflects allocations already posted; does not include interchange activity not yet rolled into a monthly allocation.',
      data_freshness: freshness,
      reconciliation_status: reconciliationOpen > 0 ? 'exceptions_open' : 'reconciled',
    },
    program_benefit: {
      value: null,
      source: 'not_yet_computed',
      definition: 'Value of church-program benefit (e.g. subsidized fees, matched funds) attributable to the Impact Card program, as distinct from member-directed gifts.',
      reporting_period: period,
      calculation: 'No source table exists yet for church-program-benefit attribution (distinct from impact_allocations, which tracks member/cause routing, not program benefit). Not computed.',
      assumptions: 'N/A — not computed. Do not display this as $0; $0 would imply a real measurement of no benefit.',
      data_freshness: 'Not applicable — no data source.',
      reconciliation_status: 'not_yet_computed',
    },
    onboarding_drop_off_rate: {
      value: dropOffRate,
      source: 'kyc_verifications',
      definition: 'Share of applications submitted in the period that have not reached status=approved.',
      reporting_period: period,
      calculation: '(application_count - completion_count) / application_count for the same period; null when application_count is 0.',
      assumptions: 'Applications still in_review at the time of calculation count as drop-off even though they may later be approved — this is a point-in-time snapshot, not a cohort-complete figure.',
      data_freshness: freshness,
      reconciliation_status: 'not_applicable',
    },
    support_cases: {
      value: supportInPeriod.length,
      source: 'work_orders (ministry=Member Support, metadata.program=impact_card)',
      definition: 'Number of Impact Card support-escalation Work Orders opened during the reporting period.',
      reporting_period: period,
      calculation: "COUNT(work_orders) WHERE ministry='Member Support' AND metadata->>'program'='impact_card' AND created_at is within the period.",
      assumptions: `${supportOpen} of ${supportInPeriod.length} are still open as of data_freshness. Only escalated cases reach a Work Order — first-line support resolved without escalation is not counted here.`,
      data_freshness: freshness,
      reconciliation_status: 'not_applicable',
    },
    reconciliation_status: {
      value: reconciliationOpen,
      source: 'work_orders (ministry=Finance, metadata.program=impact_card) + cron_runs (job=reconcile-stripe)',
      definition: 'Number of currently-open reconciliation-exception Work Orders, plus the outcome of the most recent automated reconciliation run.',
      reporting_period: period,
      calculation: "COUNT(work_orders) WHERE ministry='Finance' AND metadata->>'program'='impact_card' AND status is an open status, as of now (not period-scoped).",
      assumptions: cronRun
        ? `Most recent automated reconciliation run: ${cronRun.ok ? 'completed without error' : 'failed'} at ${cronRun.created_at}. That job checks the internal ledger for anomalies only — it does not yet compare against the Stripe Balance API (tracked as TD-034), so a clean run does not guarantee the provider and ledger fully agree.`
        : 'No automated reconciliation run has been recorded yet.',
      data_freshness: freshness,
      reconciliation_status: reconciliationOpen > 0 ? 'exceptions_open' : 'reconciled',
    },
    campaign_performance: {
      value: campaignsInPeriod.length > 0 ? campaignsCompleted / campaignsInPeriod.length : null,
      source: 'work_orders (Impact Card Onboarding Campaign template)',
      definition: 'Completion rate of onboarding-campaign Work Orders opened during the reporting period.',
      reporting_period: period,
      calculation: "COUNT(work_orders WHERE status='completed') / COUNT(work_orders) for onboarding_campaign-templated Work Orders created within the period.",
      assumptions: 'This measures campaign planning/execution completion (a Work Order lifecycle), not member-level response or conversion — there is no per-recipient campaign-attribution table yet. A completed Work Order means the campaign checklist was finished, not a specific enrollment count.',
      data_freshness: freshness,
      reconciliation_status: 'not_applicable',
    },
  };
}

/**
 * Finance-role access split: application/completion/activation/
 * participation/drop-off/support-cases/campaign-performance require
 * impact_card.view; approved-aggregate-value/reconciliation/program-
 * benefit — the financially-sensitive figures — require
 * giving_financial.view. A caller with only one permission gets that
 * half; the other half is replaced with a permission_required marker
 * rather than silently omitted (so the UI can render "requires access"
 * instead of a missing key).
 */
export const FUNNEL_ACCESS_FIELDS: (keyof ImpactCardFunnelMetrics)[] = [
  'application_count', 'completion_count', 'activation_count', 'active_participation',
  'onboarding_drop_off_rate', 'support_cases', 'campaign_performance',
];
export const FINANCIAL_ACCESS_FIELDS: (keyof ImpactCardFunnelMetrics)[] = [
  'approved_aggregate_value_usd', 'reconciliation_status', 'program_benefit',
];

export interface PermissionRequiredMarker { permission_required: true }
export const PERMISSION_REQUIRED_MARKER: PermissionRequiredMarker = { permission_required: true };

export function applyFieldPermissions(
  metrics: ImpactCardFunnelMetrics,
  access: { hasFunnelAccess: boolean; hasFinancialAccess: boolean },
): Record<string, ImpactCardMetric | PermissionRequiredMarker> {
  const result: Record<string, ImpactCardMetric | PermissionRequiredMarker> = {};
  for (const field of FUNNEL_ACCESS_FIELDS) {
    result[field] = access.hasFunnelAccess ? metrics[field] : PERMISSION_REQUIRED_MARKER;
  }
  for (const field of FINANCIAL_ACCESS_FIELDS) {
    result[field] = access.hasFinancialAccess ? metrics[field] : PERMISSION_REQUIRED_MARKER;
  }
  return result;
}
