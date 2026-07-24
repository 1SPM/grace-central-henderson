/**
 * Catalog of the named Work Order templates required by the giving/Impact
 * Card phase brief: onboarding campaign, support escalation, reconciliation
 * exception, Impact Card communications, and monthly leadership reporting.
 * Each template is planning/tracking data only — instantiating one creates
 * a work_orders row plus its checklist of work_order_tasks; it does not
 * itself call Stripe, i2c, or any other financial provider.
 *
 * The sixth named type, "pilot-readiness review," already has its own
 * working endpoint and ten-task checklist (api/work-orders/_pilot-
 * readiness.ts, POST /api/work-orders/pilot-readiness) predating this
 * catalog — it is intentionally not duplicated here. Callers wanting the
 * full set of six should route pilot_readiness_review to that endpoint and
 * the other five keys to POST /api/work-orders/create-from-template.
 */

export type WorkOrderTemplateKey =
  | 'onboarding_campaign'
  | 'support_escalation'
  | 'reconciliation_exception'
  | 'impact_card_communications'
  | 'monthly_leadership_reporting';

export interface WorkOrderTemplateTask {
  title: string;
  description: string;
}

export interface WorkOrderTemplate {
  key: WorkOrderTemplateKey;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  ministry: string;
  sensitivity: 'public' | 'internal' | 'restricted' | 'confidential';
  /**
   * requires_approval mirrors what api/_lib/workOrderPolicy.ts already
   * derives from the ministry name for communications Work Orders — set
   * explicitly here too so the flag survives even if a user later edits
   * the free-text ministry field on the created row.
   */
  metadata: Record<string, unknown> | null;
  tasks: WorkOrderTemplateTask[];
}

export const WORK_ORDER_TEMPLATES: Record<WorkOrderTemplateKey, WorkOrderTemplate> = {
  onboarding_campaign: {
    key: 'onboarding_campaign',
    title: 'Impact Card Onboarding Campaign',
    description:
      'Plan and track a member onboarding campaign for the Impact Card. Tracking only — does not enroll or ' +
      'contact members by itself; execution happens through the existing member communication channels once ' +
      'each task below is complete.',
    priority: 'medium',
    ministry: 'Impact Card Operations',
    sensitivity: 'internal',
    metadata: { program: 'impact_card' },
    tasks: [
      { title: 'Define target audience', description: 'Determine which members are eligible and in scope for this onboarding wave.' },
      { title: 'Review consent and disclosure copy', description: 'Confirm the application, KYC, and card-issuance disclosures members will see are current and accurate.' },
      { title: 'Walk the KYC/application funnel in sandbox', description: 'Exercise the real i2c sandbox application flow end-to-end and note any friction before members see it.' },
      { title: 'Confirm support readiness', description: 'Verify support staff know how to answer application/activation questions and where to escalate.' },
      { title: 'Confirm funnel tracking is live', description: 'Confirm the Admin Dashboard adoption-funnel metrics are reading real application/activation data for this cohort.' },
      { title: 'Launch communication', description: 'Coordinate the announcement with an Impact Card Communications Work Order (requires approval before send).' },
      { title: 'Post-launch funnel review', description: 'Review application, completion, and activation counts against the campaign goal after the wave closes.' },
    ],
  },
  support_escalation: {
    key: 'support_escalation',
    title: 'Impact Card Support Escalation',
    description:
      'Track a support case escalated beyond first-line response — e.g. an application stuck in review, a ' +
      'disputed transaction, or a provider-side error a member reported.',
    priority: 'high',
    ministry: 'Member Support',
    sensitivity: 'restricted',
    metadata: { program: 'impact_card' },
    tasks: [
      { title: 'Intake and triage', description: 'Record what the member reported and classify the case (application, activation, transaction, account).' },
      { title: 'Reproduce or verify against provider records', description: 'Check the case against real provider/ledger records (not assumptions) before proposing a resolution.' },
      { title: 'Determine resolution path', description: 'Decide whether this is resolvable directly, requires a provider ticket, or requires a reconciliation exception Work Order.' },
      { title: 'Resolve and notify member', description: 'Complete the resolution and communicate the outcome to the member in plain language.' },
      { title: 'Document root cause', description: 'Record what caused the case so recurring issues are visible in support-case reporting.' },
      { title: 'Independent closure check', description: 'A second staff member confirms the case is genuinely resolved before this Work Order is marked complete.' },
    ],
  },
  reconciliation_exception: {
    key: 'reconciliation_exception',
    title: 'Reconciliation Exception Review',
    description:
      'Investigate a ledger/provider mismatch surfaced by the reconciliation job (see api/cron/_reconcile-stripe.ts) ' +
      'or the Impact Card reconciliation-status metric. Finance-role visibility only.',
    priority: 'high',
    ministry: 'Finance',
    sensitivity: 'confidential',
    metadata: { program: 'impact_card' },
    tasks: [
      { title: 'Identify the exception', description: 'Record which record(s) the reconciliation job flagged and why.' },
      { title: 'Verify against provider records', description: 'Confirm the discrepancy against the provider (Stripe/i2c) directly rather than only the internal ledger.' },
      { title: 'Classify the exception', description: 'Determine whether this is a duplicate, a missing entry, a timing difference, or a genuine error.' },
      { title: 'Resolve or escalate', description: 'Correct the record via a new ledger entry (append-only — never edit a posted entry) or escalate to the provider.' },
      { title: 'Document resolution', description: 'Record the resolution and evidence so the reconciliation-status metric reflects the closed exception.' },
    ],
  },
  impact_card_communications: {
    key: 'impact_card_communications',
    title: 'Impact Card Communications',
    description:
      'Plan a member-facing communication about the Impact Card (announcement, program update, or campaign message). ' +
      'Requires approval before it can move into execution — see api/_lib/workOrderPolicy.ts.',
    priority: 'medium',
    ministry: 'Communications',
    sensitivity: 'internal',
    metadata: { requires_approval: true, program: 'impact_card' },
    tasks: [
      { title: 'Draft message', description: 'Draft the member-facing copy, distinguishing clearly between gift activity, card status, and any program benefit being described.' },
      { title: 'Compliance/accuracy review', description: 'Confirm no claim in the draft represents mock or sandbox functionality as live, and that figures cited match a real metric source.' },
      { title: 'Request approval', description: 'Submit the Work Order for approval (awaiting_approval) before any send.' },
      { title: 'Send', description: 'Send only after approval is recorded.' },
      { title: 'Post-send review', description: 'Confirm delivery and capture any support-case volume the communication generated.' },
    ],
  },
  monthly_leadership_reporting: {
    key: 'monthly_leadership_reporting',
    title: 'Monthly Impact Card Leadership Report',
    description:
      'Compile the monthly Impact Card report for leadership from the Admin Dashboard adoption-funnel metrics — ' +
      'every figure sourced, defined, and dated rather than estimated.',
    priority: 'medium',
    ministry: 'Impact Card Operations',
    sensitivity: 'internal',
    metadata: { program: 'impact_card' },
    tasks: [
      { title: 'Pull adoption funnel metrics', description: 'Pull application, completion, activation, and active-participation counts for the reporting period.' },
      { title: 'Pull financial metrics', description: 'Pull approved aggregate value and platform revenue for the period, each with its source and calculation noted.' },
      { title: 'Reconciliation status', description: 'Note any open reconciliation exceptions for the period and their status.' },
      { title: 'Support case summary', description: 'Summarize support case volume and themes for the period.' },
      { title: 'Draft leadership summary', description: 'Draft the narrative summary, keeping every figure traceable to its source metric.' },
      { title: 'Review and distribute', description: 'Route for leadership review before distribution.' },
    ],
  },
};

export function getWorkOrderTemplate(key: string): WorkOrderTemplate | null {
  return (WORK_ORDER_TEMPLATES as Record<string, WorkOrderTemplate>)[key] ?? null;
}
