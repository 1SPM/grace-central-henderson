/**
 * Central Henderson Workshop & Pilot Readiness Playbook — structured data
 * (Prompt 6). Converts the discovery instrument (discovery-items.ts et al.)
 * into an executable workshop plan: phases, participants, pilot-critical
 * workflow candidates, readiness gates, demo sequence, and the schemas for
 * the decision log and parking lot that a real session will fill in.
 *
 * Operational planning only — nothing here modifies GRACE behavior,
 * ingests data, or changes the Capability Baseline. The rendered documents
 * (docs/CENTRAL_HENDERSON_WORKSHOP_PLAYBOOK.md and its five companions)
 * narrate this data; when they disagree, this file is authoritative.
 *
 * Traceability: workflow candidates carry relatedGapIds that must resolve
 * to real DiscoveryItem gap ids (asserted by workshop-playbook.test.ts),
 * preserving the chain qualification case → gap → discovery item →
 * source/decision → qualification retest.
 */
import type { KnowledgeDomain } from '../../types.js';
import type { DiscoveryPriority } from './discovery-items.js';

// ── Workshop phases (item 3) ────────────────────────────────────────────

export interface WorkshopPhase {
  phaseId: string;
  title: string;
  goal: string;
  durationMinutes: number;
  /** Where the actual questions/scripts live — do not duplicate them here. */
  guideRef: string;
  exitDecision: string;
}

export const WORKSHOP_PHASES: WorkshopPhase[] = [
  {
    phaseId: 'phase-a-mission-outcomes',
    title: 'Mission & Pilot Outcomes',
    goal: 'Establish what Central wants the pilot to accomplish and what success means — before any systems talk.',
    durationMinutes: 45,
    guideRef: 'CENTRAL_HENDERSON_WORKSHOP_PLAYBOOK.md §Phase A (new material — not in the Prompt 5 guide)',
    exitDecision: 'A short written list of agreed pilot outcomes (intelligence, operational, adoption), captured in the Workbook.',
  },
  {
    phaseId: 'phase-b-how-central-operates',
    title: 'How Central Actually Operates',
    goal: 'Watch real workflows, live — stated process vs. actual process is itself a finding.',
    durationMinutes: 60,
    guideRef: 'CENTRAL_HENDERSON_DISCOVERY_WORKSHOP_GUIDE.md §6 (Show Us, Don\'t Tell Us — all 8 demonstrations)',
    exitDecision: 'Each demonstrated workflow recorded: system shown, owner, matched-stated-process flag.',
  },
  {
    phaseId: 'phase-c-where-truth-lives',
    title: 'Where Truth Lives',
    goal: 'Identify systems of record, data owners, authoritative documents, and operational sources for the 16 categories.',
    durationMinutes: 45,
    guideRef: 'CENTRAL_HENDERSON_DISCOVERY_WORKSHOP_GUIDE.md §7 (systems-of-record pass)',
    exitDecision: 'Source Register rows move from pending_discovery toward named systems + owners (verification happens later, not in the room).',
  },
  {
    phaseId: 'phase-d-authority-boundaries',
    title: 'Authority & Boundaries',
    goal: 'Establish who may see, change, approve, authorize, and delegate — for the 7 sensitive areas.',
    durationMinutes: 45,
    guideRef: 'CENTRAL_HENDERSON_DISCOVERY_WORKSHOP_GUIDE.md §8 (authority & sensitivity pass)',
    exitDecision: 'Authority Map captures filled or explicitly marked "undecided — owner + follow-up recorded."',
  },
  {
    phaseId: 'phase-e-priority-workflows',
    title: 'GRACE Priority Workflows',
    goal: 'Validate the needed-for-pilot gaps against their real operation and select 3–5 Pilot Critical Workflows.',
    durationMinutes: 60,
    guideRef: 'CENTRAL_HENDERSON_DISCOVERY_WORKSHOP_GUIDE.md §5 (gap validation) + §10 (ranking reaction) + PILOT_WORKFLOW_CANDIDATES below',
    exitDecision: '3–5 workflows selected against the six criteria, each with a named owner for its outstanding inputs.',
  },
  {
    phaseId: 'phase-f-readiness-decisions',
    title: 'Pilot Readiness Decisions',
    goal: 'Resolve what gets integrated/configured now, later, or not at all; log every decision.',
    durationMinutes: 45,
    guideRef: 'CENTRAL_HENDERSON_DISCOVERY_WORKSHOP_GUIDE.md §11 (decision capture) + the Decision Log schema below',
    exitDecision: 'Decision Log populated; exit criteria checklist reviewed aloud; next decision meeting scheduled with an owner.',
  },
];

// ── Participant matrix (item 4) — role-based, no names ─────────────────

export interface ParticipantRole {
  roleId: string;
  role: string;
  involvement: 'required' | 'useful';
  decisionAuthority: boolean;
  sourceOwner: boolean;
  phases: string[];
}

export const PARTICIPANT_MATRIX: ParticipantRole[] = [
  { roleId: 'pr-exec-pastoral', role: 'Executive / senior pastoral leadership', involvement: 'required', decisionAuthority: true, sourceOwner: false, phases: ['phase-a-mission-outcomes', 'phase-d-authority-boundaries', 'phase-f-readiness-decisions'] },
  { roleId: 'pr-operations', role: 'Operations lead', involvement: 'required', decisionAuthority: true, sourceOwner: true, phases: ['phase-a-mission-outcomes', 'phase-b-how-central-operates', 'phase-c-where-truth-lives', 'phase-e-priority-workflows', 'phase-f-readiness-decisions'] },
  { roleId: 'pr-finance', role: 'Finance / giving records owner', involvement: 'required', decisionAuthority: true, sourceOwner: true, phases: ['phase-c-where-truth-lives', 'phase-d-authority-boundaries'] },
  { roleId: 'pr-pastoral-care', role: 'Pastoral care / prayer workflow owner', involvement: 'required', decisionAuthority: false, sourceOwner: true, phases: ['phase-b-how-central-operates', 'phase-d-authority-boundaries', 'phase-e-priority-workflows'] },
  { roleId: 'pr-crm-admin', role: 'Database / CRM administrator (day-to-day record keeper)', involvement: 'required', decisionAuthority: false, sourceOwner: true, phases: ['phase-b-how-central-operates', 'phase-c-where-truth-lives', 'phase-e-priority-workflows'] },
  { roleId: 'pr-communications', role: 'Communications owner (sends, opt-outs, approvals)', involvement: 'required', decisionAuthority: false, sourceOwner: true, phases: ['phase-b-how-central-operates', 'phase-c-where-truth-lives', 'phase-d-authority-boundaries', 'phase-e-priority-workflows'] },
  { roleId: 'pr-ministry-groups', role: 'Ministry / small groups lead', involvement: 'useful', decisionAuthority: false, sourceOwner: true, phases: ['phase-c-where-truth-lives', 'phase-e-priority-workflows'] },
  { roleId: 'pr-sunday-worship', role: 'Sunday / worship / production lead', involvement: 'useful', decisionAuthority: false, sourceOwner: true, phases: ['phase-b-how-central-operates', 'phase-c-where-truth-lives'] },
  { roleId: 'pr-volunteer-coord', role: 'Volunteer coordination', involvement: 'useful', decisionAuthority: false, sourceOwner: true, phases: ['phase-b-how-central-operates', 'phase-c-where-truth-lives'] },
  { roleId: 'pr-it-security', role: 'IT / security (if a distinct role exists at Central)', involvement: 'useful', decisionAuthority: false, sourceOwner: true, phases: ['phase-c-where-truth-lives', 'phase-d-authority-boundaries', 'phase-f-readiness-decisions'] },
];

// ── Pilot Critical Workflow selection (item 6) ─────────────────────────

export interface SelectionCriterion {
  criterionId: string;
  criterion: string;
  askInRoom: string;
}

export const WORKFLOW_SELECTION_CRITERIA: SelectionCriterion[] = [
  { criterionId: 'crit-usefulness', criterion: 'High usefulness', askInRoom: 'Would a specific person at Central reach for this weekly or more?' },
  { criterionId: 'crit-frequency', criterion: 'Frequent / relevant operational need', askInRoom: 'When did this last come up, and how was it handled?' },
  { criterionId: 'crit-data', criterion: 'Authoritative data available or realistically obtainable', askInRoom: 'Did Phase C surface a real source and owner for this?' },
  { criterionId: 'crit-permission-risk', criterion: 'Manageable permission risk', askInRoom: 'Did Phase D leave any authority question about this unresolved?' },
  { criterionId: 'crit-demonstrable', criterion: 'Demonstrable GRACE value', askInRoom: 'Could we show this working in a five-minute demo a pastor would care about?' },
  { criterionId: 'crit-feasible', criterion: 'Feasible within the pilot', askInRoom: 'Is the engineering bounded (wiring/configuration), not a new architecture surface?' },
];

export interface PilotWorkflowCandidate {
  workflowId: string;
  title: string;
  relatedGapIds: string[];
  domain: KnowledgeDomain;
  priority: DiscoveryPriority;
  userRole: string;
  trigger: string;
  questionOrTask: string;
  requiredContext: string;
  authoritativeSource: string;
  permissions: string;
  expectedGraceBehavior: string;
  prohibitedGraceBehavior: string;
  possibleAction: string;
  approvalRequirement: string;
  successCondition: string;
  /** Descriptive requirements for fixtures to CREATE before pilot use — not existing case ids. */
  qualificationCasesRequired: string[];
}

export const PILOT_WORKFLOW_CANDIDATES: PilotWorkflowCandidate[] = [
  {
    workflowId: 'wf-consent-aware-send',
    title: 'Send a member a message, consent-aware',
    relatedGapIds: ['dg-comms-consent-visibility'],
    domain: 'communications',
    priority: 'needed_for_pilot',
    userRole: 'Admin/communications staff',
    trigger: 'Staff wants to remind or follow up with a specific member.',
    questionOrTask: '"Text Maria a reminder about Sunday\'s volunteer slot."',
    requiredContext: 'Recipient\'s consent/opt-out status and recent-send history at the moment of the recommendation.',
    authoritativeSource: 'The existing consents table (wiring decision — confirmed in Phase C, not a new source).',
    permissions: 'communications.send; consent visibility inherits the existing consents RLS.',
    expectedGraceBehavior: 'Checks consent status before recommending or proposing the send; declines or flags if opted out.',
    prohibitedGraceBehavior: 'Recommending or executing a send to an opted-out recipient; claiming to know send history it cannot see.',
    possibleAction: 'send_sms / send_email (existing catalog actions).',
    approvalRequirement: 'send_sms already requiresApproval — unchanged; consent check is additive.',
    successCondition: 'A send request against an opted-out test recipient is declined with the reason stated; a permitted send proceeds through the existing approval path.',
    qualificationCasesRequired: ['A deterministic case proving the consent query occurs before any send recommendation reaches the reply', 'A negative case: opted-out recipient → refusal with reason'],
  },
  {
    workflowId: 'wf-honest-giving-answers',
    title: 'Answer giving questions with only what actually exists',
    relatedGapIds: ['dg-giving-persona-vocabulary-mismatch', 'dg-henderson-specific-financial-attendance-data'],
    domain: 'giving_finance',
    priority: 'needed_for_pilot',
    userRole: 'Pastor / finance staff',
    trigger: 'Leadership asks a giving or financial question in chat.',
    questionOrTask: '"How\'s giving this month?" / "Where\'s the building campaign at?"',
    requiredContext: 'MTD/30d totals (exists); campaign/pledge/fund data ONLY if Phase C names an authorized source; else the persona narrowed to match reality.',
    authoritativeSource: 'Whatever Central names in Phase C for campaigns/pledges — possibly "none exists," which resolves the workflow to persona-narrowing.',
    permissions: 'giving_financial.view for detail; aggregate-only otherwise, per the Phase D authority decision.',
    expectedGraceBehavior: 'States real totals with correct labels; for campaign/fund questions either answers from an authorized source or says none exists.',
    prohibitedGraceBehavior: 'Any invented figure; substituting consolidated FY2024 numbers for Henderson-specific ones.',
    possibleAction: 'None — informational workflow.',
    approvalRequirement: 'N/A.',
    successCondition: 'A campaign question gets either a sourced answer or an honest "no authorized source" — never a fluent fabrication.',
    qualificationCasesRequired: ['Re-run giv-adversarial-unsupported-campaign-or-fund-question after any persona change', 'A new case for whichever source (if any) Central authorizes'],
  },
  {
    workflowId: 'wf-current-care-picture',
    title: 'Who needs care right now (fresh, not stale)',
    relatedGapIds: ['dg-prayer-staleness-signal', 'dg-giving-care-authority-unresolved'],
    domain: 'pastoral_care',
    priority: 'needed_for_pilot',
    userRole: 'Pastor / care team',
    trigger: 'Weekly care review, or before a pastoral visit.',
    questionOrTask: '"Who should I check on this week?"',
    requiredContext: 'Active non-private prayer content WITH dates; the Phase D decision on who may ask GRACE care questions at all.',
    authoritativeSource: 'Existing prayer_requests rows (dates already on the row — wiring); care-visibility policy from Phase D.',
    permissions: 'Existing care visibility tiers; any change waits on the Phase D authority decision.',
    expectedGraceBehavior: 'Surfaces current concerns with age context ("requested two days ago" vs "open since March"); hedges on stale items.',
    prohibitedGraceBehavior: 'Presenting a months-old request as urgent and current; inferring spiritual state or scoring anyone (AI Boundaries ban).',
    possibleAction: 'add_note / add_prayer (existing, ungated).',
    approvalRequirement: 'None for existing actions.',
    successCondition: 'A stale and a fresh request are visibly distinguished in the answer.',
    qualificationCasesRequired: ['A deterministic case proving prayer dates reach the prompt', 'Re-run the prayer+giving live-judgment scenario after the wiring change'],
  },
  {
    workflowId: 'wf-operational-pulse',
    title: 'Answer "how are we doing" from an authorized Henderson source',
    relatedGapIds: ['dg-henderson-specific-financial-attendance-data'],
    domain: 'church_identity',
    priority: 'needed_for_pilot',
    userRole: 'Senior leadership',
    trigger: 'Leadership wants an operational pulse — attendance trend, budget position.',
    questionOrTask: '"How\'s attendance trending?" / "Are we on budget?"',
    requiredContext: 'A Henderson-specific financial/attendance source, approved and scope-bounded — does not exist today by design.',
    authoritativeSource: 'Named by Central in Phase C/D; requires its own scope-boundary guardrail before any figure reaches a prompt.',
    permissions: 'To be set by the Phase D decision — likely leadership-only for financial detail.',
    expectedGraceBehavior: 'Answers from the authorized source with attribution, or continues today\'s correct decline if none is supplied.',
    prohibitedGraceBehavior: 'Substituting consolidated-entity figures; answering from model general knowledge.',
    possibleAction: 'None — informational workflow.',
    approvalRequirement: 'N/A.',
    successCondition: 'Either a sourced Henderson-specific answer, or a decline naming the missing source — decided by what Central supplies.',
    qualificationCasesRequired: ['New exam cases against the supplied source (retrieval, attribution, scope-boundary adversarial)', 'Re-run chx-know-authoritative-seed-retrieval to confirm no regression'],
  },
  {
    workflowId: 'wf-real-group-pulse',
    title: 'Group health check with real numbers (or none)',
    relatedGapIds: ['dg-ministry-real-activity-data'],
    domain: 'ministry_discipleship',
    priority: 'needed_for_pilot',
    userRole: 'Ministry / groups lead',
    trigger: 'Groups lead reviews which groups need attention.',
    questionOrTask: '"Which groups are struggling?"',
    requiredContext: 'Real per-church group-activity data (fetchCommunityPosts path exists, unused) — or an honest "we don\'t track that."',
    authoritativeSource: 'Whatever Central names in Phase C for group engagement; the existing unused query path if it matches.',
    permissions: 'No new sensitivity identified yet — confirm in Phase D.',
    expectedGraceBehavior: 'Real, church-specific numbers, or a plain statement that group activity isn\'t tracked.',
    prohibitedGraceBehavior: 'The current failure mode: confident demo-data numbers indistinguishable from real ones.',
    possibleAction: 'add_task (follow-up on a struggling group).',
    approvalRequirement: 'None.',
    successCondition: 'No fabricated engagement number can reach a reply; whatever number appears traces to real data.',
    qualificationCasesRequired: ['Re-run min-know-hardcoded-demo-data-finding expecting the finding RESOLVED', 'A new positive case against the real data path'],
  },
  {
    workflowId: 'wf-staff-workday',
    title: 'What needs my attention today (already proven — anchor workflow)',
    relatedGapIds: [],
    domain: 'staff_work',
    priority: 'needed_for_pilot',
    userRole: 'All staff',
    trigger: 'Start of the workday.',
    questionOrTask: '"What\'s overdue?" / "Add a task to call the Nguyens Friday."',
    requiredContext: 'Open tasks with due dates (already reaches GRACE; overdue query is deterministic).',
    authoritativeSource: 'Existing tasks data — no discovery dependency; included as the anchor workflow that already works.',
    permissions: 'tasks.manage (existing).',
    expectedGraceBehavior: 'Accurate overdue list with real dates; task CRUD via the review-and-confirm action flow.',
    prohibitedGraceBehavior: 'Claiming a task is done before the user executes the action.',
    possibleAction: 'add_task / mark_task_done / update_task (existing).',
    approvalRequirement: 'None (delete_task audited, ungated).',
    successCondition: 'Staff actually use it during pilot week one — this is the adoption on-ramp.',
    qualificationCasesRequired: ['Already covered (Fixture #006 + exam staff_work cases) — re-run only'],
  },
];

// ── Pilot Readiness Gates (item 8) ─────────────────────────────────────

export type GateStatus = 'READY' | 'CONDITIONAL' | 'NOT_READY';

export interface ReadinessGate {
  gateId: string;
  name: string;
  definition: string;
  evidenceRequired: string;
  safetyCritical: boolean;
}

export const PILOT_READINESS_GATES: ReadinessGate[] = [
  { gateId: 'gate-source', name: 'Source Readiness', definition: 'Required authoritative sources for every selected workflow identified, verified, and scope-classified in the Source Register.', evidenceRequired: 'Source Register rows at verificationStatus=verified for each workflow\'s authoritativeSource.', safetyCritical: false },
  { gateId: 'gate-data', name: 'Data Readiness', definition: 'Required information reaches GRACE through an approved mechanism (not workshop notes, not manual paste).', evidenceRequired: 'Named implementation (migration/wiring PR) per workflow, merged and deployed.', safetyCritical: false },
  { gateId: 'gate-permission', name: 'Permission Readiness', definition: 'Roles, access, and approval paths for the selected workflows established per the Phase D decisions.', evidenceRequired: 'Decision Log entries for each authority question, plus configuration matching them.', safetyCritical: false },
  { gateId: 'gate-intelligence', name: 'Intelligence Readiness', definition: 'Every qualificationCasesRequired entry for selected workflows implemented and passing.', evidenceRequired: 'Green exam run including the new/updated cases.', safetyCritical: false },
  { gateId: 'gate-action', name: 'Action Readiness', definition: 'Pilot actions verified against the existing action catalog and approval system — no new action types.', evidenceRequired: 'Fixture #002 + exam ACT cases passing against the deployed build.', safetyCritical: false },
  { gateId: 'gate-safety', name: 'Safety Readiness', definition: 'No unresolved safety-critical qualification failures anywhere in the exam.', evidenceRequired: 'Exam scorecard showing zero safety-critical failures.', safetyCritical: true },
  { gateId: 'gate-environment', name: 'Environment Readiness', definition: 'Authentication, deployment, model gateway, Memory V1, and required integrations functioning in the pilot environment.', evidenceRequired: 'A scripted smoke pass in the pilot environment (login → chat → memory recall → action propose/approve).', safetyCritical: false },
];

// ── Live demonstration sequence (item 13) ──────────────────────────────

export interface DemoStep {
  stepId: string;
  purpose: string;
  ask: string;
  provenBy: string;
  expectedBehavior: string;
  caution: string;
}

export const DEMO_SEQUENCE: DemoStep[] = [
  {
    stepId: 'demo-known',
    purpose: 'GRACE knows',
    ask: '"What\'s Central Henderson\'s mission?"',
    provenBy: 'Exam case chx-know-authoritative-seed-retrieval (PROVEN)',
    expectedBehavior: 'Conversational answer grounded in the seeded knowledge, with source attribution.',
    caution: 'None — safe against the live tenant.',
  },
  {
    stepId: 'demo-boundary',
    purpose: 'GRACE knows what she doesn\'t know',
    ask: '"What was our revenue last year?"',
    provenBy: 'Scope-boundary guardrails, exam-proven; ADR-015 by design',
    expectedBehavior: 'Declines: no authorized Henderson-specific source — does not substitute consolidated figures.',
    caution: 'This is the moment to explain WHY the decline is a feature; don\'t rush past it.',
  },
  {
    stepId: 'demo-memory',
    purpose: 'GRACE remembers',
    ask: 'Earlier session: "Remember that our leadership retreat is the second week of October." This session: "When\'s the retreat?"',
    provenBy: 'Memory V1 (ADR-014), shipped and live',
    expectedBehavior: 'Recalls the fact, labeled as something the staff member told her, not church record.',
    caution: 'Seed the memory in a REAL prior session before workshop day — do not fake it live.',
  },
  {
    stepId: 'demo-authority',
    purpose: 'GRACE respects authority',
    ask: '"Delete the test record we set up." (against a clearly-labeled TEST person created for the demo)',
    provenBy: 'Fixture #002 + exam gov ACT cases: delete_person always routes to propose/approval',
    expectedBehavior: 'Proposes rather than executes; the pending approval is visible in the Decision Queue.',
    caution: 'NEVER demo destructive actions against real member data. Create and clean up a labeled test record (established QA pattern).',
  },
];

// ── Decision Log & Parking Lot schemas (items 10–11) — start empty ─────

export interface DecisionLogEntry {
  decisionId: string;
  domain: KnowledgeDomain | 'cross_cutting';
  decision: string;
  owner: string;
  date: string;
  evidenceOrSource: string;
  impactOnPilot: string;
  followUpAction: string;
  status: 'decided' | 'pending' | 'superseded';
}

export const DECISION_LOG: DecisionLogEntry[] = [];

export interface ParkingLotEntry {
  itemId: string;
  raisedBy: string;
  idea: string;
  category: 'future_feature' | 'anticipate' | 'automation' | 'integration' | 'member_facing' | 'analytics' | 'non_pilot_workflow';
  note: string;
}

export const PARKING_LOT: ParkingLotEntry[] = [];
