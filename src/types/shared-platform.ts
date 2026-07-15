/**
 * Shared-platform type contracts.
 *
 * These mirror the schema added in supabase/migrations/031–038 and the API
 * shapes returned by api/work-orders/*, api/approvals/*, api/consents/*.
 * Both the Admin Dashboard and (once it becomes a real build) the Members
 * Portal import from this one file so the two frontends and the WorkOS
 * agent layer never drift on field names — see SHARED_BACKEND.md.
 *
 * This file is types only (no runtime code, no Supabase client) so it is
 * safe to import from any bundle, including a future member-portal build.
 */

// ============================================
// Identity
// ============================================

export type AccountStatus = 'active' | 'invited' | 'suspended' | 'deactivated';

export interface Household {
  id: string;
  church_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  created_at: string;
  updated_at: string;
}

export type HouseholdRelationship = 'head' | 'spouse' | 'child' | 'dependent' | 'other' | 'member';

export interface HouseholdMember {
  id: string;
  household_id: string;
  person_id: string;
  relationship: HouseholdRelationship;
  is_primary_contact: boolean;
  created_at: string;
}

export interface StaffProfile {
  id: string;
  church_id: string;
  user_id: string;
  title: string | null;
  department: string | null;
  ministry: string | null;
  employment_type: 'staff' | 'clergy' | 'volunteer' | 'contractor';
  hire_date: string | null;
  phone: string | null;
  phone_extension: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// RBAC
// ============================================

export type SystemRoleKey =
  | 'system_administrator'
  | 'executive_leadership'
  | 'senior_pastor'
  | 'ministry_leader'
  | 'pastoral_care'
  | 'member_services'
  | 'communications'
  | 'volunteer_coordinator'
  | 'finance'
  | 'impact_card_operations'
  | 'analyst'
  | 'auditor'
  | 'member_portal_user';

export type Sensitivity = 'public' | 'internal' | 'restricted' | 'confidential';

export interface Role {
  id: string;
  church_id: string | null; // null = system template
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

export interface Permission {
  id: string;
  key: string; // "<module>.<action>"
  module: string;
  action: string;
  sensitivity: Sensitivity;
  description: string | null;
}

export interface UserRoleAssignment {
  id: string;
  church_id: string;
  user_id: string;
  role_id: string;
  ministry: string | null;
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
}

// ============================================
// Consent & preferences
// ============================================

export type ConsentType =
  | 'email'
  | 'sms'
  | 'push_notification'
  | 'pastoral_contact'
  | 'directory_visibility'
  | 'photograph'
  | 'group_visibility'
  | 'prayer_request_visibility'
  | 'volunteer_communications'
  | 'impact_card_communications';

export type ConsentStatus = 'granted' | 'denied' | 'withdrawn';

export interface Consent {
  id: string;
  church_id: string;
  person_id: string;
  consent_type: ConsentType;
  status: ConsentStatus;
  granted_at: string | null;
  withdrawn_at: string | null;
  source: 'portal' | 'staff' | 'import' | 'agent';
  recorded_by_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunicationPreferences {
  id: string;
  church_id: string;
  person_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  preferred_channel: 'email' | 'sms' | 'push' | 'none' | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  topics: Record<string, boolean>;
  updated_at: string;
}

export type DataSubjectRequestType = 'data_export' | 'account_deactivation';
export type DataSubjectRequestStatus = 'pending' | 'in_progress' | 'completed' | 'denied';

export interface DataSubjectRequest {
  id: string;
  church_id: string;
  person_id: string;
  request_type: DataSubjectRequestType;
  status: DataSubjectRequestStatus;
  requested_at: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  notes: string | null;
}

// ============================================
// Work Orders
// ============================================

export type WorkOrderStatus =
  | 'draft'
  | 'planning'
  | 'awaiting_approval'
  | 'in_progress'
  | 'blocked'
  | 'under_review'
  | 'completed'
  | 'cancelled';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface WorkOrder {
  id: string;
  church_id: string;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  priority: Priority;
  ministry: string | null;
  sensitivity: Sensitivity;
  owner_user_id: string | null;
  requested_by_user_id: string | null;
  requested_by_agent: string | null;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  deliverable_summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type WorkOrderTaskStatus = 'pending' | 'in_progress' | 'blocked' | 'under_review' | 'completed' | 'cancelled';

export interface WorkOrderTask {
  id: string;
  work_order_id: string;
  church_id: string;
  title: string;
  description: string | null;
  status: WorkOrderTaskStatus;
  priority: Priority;
  owner_user_id: string | null;
  due_date: string | null;
  position: number;
  completed_at: string | null;
}

export interface WorkOrderDependency {
  id: string;
  work_order_id: string;
  depends_on_work_order_id: string;
  dependency_type: 'blocks' | 'relates_to';
}

export interface WorkOrderEvidence {
  id: string;
  work_order_id: string;
  task_id: string | null;
  kind: 'file' | 'link' | 'note' | 'validation_result';
  url: string | null;
  content: string | null;
  submitted_by_user_id: string | null;
  submitted_by_agent: string | null;
  created_at: string;
}

// ============================================
// Approvals
// ============================================

export type ApprovalDecision =
  | 'approve'
  | 'approve_with_changes'
  | 'return_for_revision'
  | 'reject'
  | 'escalate';

export type ApprovalStatus = 'pending' | 'decided' | 'expired';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Approval {
  id: string;
  church_id: string;
  work_order_id: string | null;
  entity_type: string;
  entity_id: string | null;
  proposed_action: string;
  requested_by_user_id: string | null;
  requested_by_agent: string | null;
  affected_resources: unknown[];
  risk_level: RiskLevel;
  supporting_evidence: unknown[];
  approver_user_id: string | null;
  decision: ApprovalDecision | null;
  decision_notes: string | null;
  status: ApprovalStatus;
  requested_at: string;
  decided_at: string | null;
  related_party_flagged: boolean;
  related_party_reviewed_by_user_id: string | null;
  related_party_reviewed_at: string | null;
}

// ============================================
// WorkOS agent platform
// ============================================

export type AgentRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface AgentRun {
  id: string;
  church_id: string;
  agent_key: string;
  work_order_id: string | null;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export type AgentActionStatus = 'proposed' | 'approved' | 'executed' | 'rejected' | 'failed';

export interface AgentAction {
  id: string;
  agent_run_id: string;
  church_id: string;
  action_type: string;
  target_entity_type: string | null;
  target_entity_id: string | null;
  payload: Record<string, unknown>;
  requires_approval: boolean;
  approval_id: string | null;
  status: AgentActionStatus;
  executed_at: string | null;
}

export interface Validation {
  id: string;
  church_id: string;
  work_order_id: string | null;
  agent_action_id: string | null;
  validation_type: string;
  status: 'pending' | 'passed' | 'failed';
  details: Record<string, unknown>;
  validated_by_user_id: string | null;
  validated_by_system: string | null;
}

// ============================================
// Platform events / notifications / audit
// ============================================

export type PlatformEventType =
  | 'member.profile.updated'
  | 'member.preferences.changed'
  | 'care.request.submitted'
  | 'care.request.updated'
  | 'group.join.requested'
  | 'event.rsvp.created'
  | 'volunteer.interest.submitted'
  | 'gift.completed'
  | 'impact.routing.updated'
  | 'impact.support.requested'
  | 'journey.step.completed'
  | 'community.post.created'
  | 'community.post.reported'
  | 'work_order.created'
  | 'work_order.status_changed'
  | 'work_order.approval_requested'
  | 'work_order.completed'
  | 'approval.decided'
  | 'consent.changed'
  | 'agent.run.completed'
  | 'contact.request.submitted'
  | 'prayer.request.submitted'
  | 'community.post.moderated'
  | 'giving.recurring_gift.cancelled'
  | 'assistant.tool_invoked';

export type SourceApp = 'admin_dashboard' | 'member_portal' | 'workos' | 'system' | 'webhook';

export interface PlatformEvent {
  id: string;
  church_id: string;
  event_type: PlatformEventType;
  source_app: SourceApp;
  actor_user_id: string | null;
  actor_person_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  payload: Record<string, unknown>;
  correlation_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  church_id: string;
  recipient_user_id: string | null;
  recipient_person_id: string | null;
  channel: 'in_app' | 'email' | 'sms' | 'push';
  title: string;
  body: string | null;
  related_event_id: string | null;
  status: 'pending' | 'sent' | 'failed' | 'read';
  read_at: string | null;
  sent_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  church_id: string | null;
  actor_user_id: string | null;
  actor_clerk_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  source_app: SourceApp | null;
  reason: string | null;
  correlation_id: string | null;
  created_at: string;
}

// ============================================
// Care, volunteer, artifacts, metrics
// ============================================

export type CareCategory =
  | 'marriage' | 'addiction' | 'grief' | 'faith-questions' | 'crisis'
  | 'financial' | 'anxiety-depression' | 'parenting' | 'general';

export type CareRequestStatus = 'submitted' | 'triaged' | 'assigned' | 'in_progress' | 'resolved' | 'closed';

export interface CareRequest {
  id: string;
  church_id: string;
  person_id: string;
  submitted_via: 'portal' | 'staff' | 'agent';
  category: CareCategory | null;
  priority: 'low' | 'medium' | 'high' | 'crisis';
  summary: string;
  status: CareRequestStatus;
  is_confidential: boolean;
  crisis_flagged: boolean;
  created_at: string;
  updated_at: string;
}

export interface CareAssignment {
  id: string;
  care_request_id: string;
  church_id: string;
  assigned_to_user_id: string;
  assigned_by_user_id: string | null;
  role_in_case: 'primary' | 'secondary' | 'observer';
  status: 'assigned' | 'active' | 'completed' | 'reassigned';
  notes: string | null;
  assigned_at: string;
  completed_at: string | null;
}

export interface VolunteerInterest {
  id: string;
  church_id: string;
  person_id: string;
  area: string;
  group_id: string | null;
  event_id: string | null;
  message: string | null;
  status: 'new' | 'contacted' | 'placed' | 'declined';
  created_at: string;
}

export interface Artifact {
  id: string;
  church_id: string;
  work_order_id: string | null;
  kind: 'document' | 'report' | 'export' | 'media' | 'dataset';
  title: string;
  storage_url: string | null;
  content: string | null;
  checksum: string | null;
  sensitivity: Sensitivity;
  created_by_user_id: string | null;
  created_by_agent: string | null;
  created_at: string;
}

// ============================================
// Work Order completion report (computed, see api/_lib/completionReport.ts)
// ============================================

export interface CompletionReport {
  work_order_id: string;
  title: string;
  status: string;
  generated_at: string;
  task_summary: {
    total: number;
    completed: number;
    in_progress: number;
    blocked: number;
    pending: number;
    percent_complete: number;
  };
  evidence_count: number;
  tasks_missing_evidence: string[];
  approval_summary: {
    total: number;
    pending: number;
    decided_favorably: number;
    decided_unfavorably: number;
    latest_status: string | null;
  };
  narrative: string;
}

export interface MetricDefinition {
  id: string;
  church_id: string | null; // null = platform-wide
  key: string;
  name: string;
  description: string | null;
  unit: string | null;
  calculation: string | null;
  sensitivity: Sensitivity;
}

// ============================================
// Finance ledgers (gift-in-kind, expenses) — extracted from reviewing a
// real church's audited financial statement, see docs history for
// context. Both are minimal ledgers, not a general-ledger replacement.
// ============================================

export type GiftInKindCategory = 'food' | 'clothing' | 'toys' | 'household' | 'other';
export type GiftInKindTransactionType = 'contribution' | 'distribution';

export interface GiftInKindTransaction {
  id: string;
  category: GiftInKindCategory;
  transaction_type: GiftInKindTransactionType;
  description: string | null;
  quantity: number | null;
  quantity_unit: string | null;
  estimated_value: number | null;
  occurred_at: string;
  created_at: string;
}

export type ExpenseFunctionalCategory = 'program' | 'g_and_a';

export interface Expense {
  id: string;
  functional_category: ExpenseFunctionalCategory;
  category: string;
  amount: number;
  fund: string | null;
  expense_date: string;
  description: string | null;
  created_at: string;
}

export interface ExpenseRatio {
  program_total: number;
  g_and_a_total: number;
  total: number;
  program_ratio: number | null;
}

// ============================================
// Configurable giving tiers / membership track — computed from
// churches.settings, never stored as a score.
// ============================================

export interface GivingTierDefinition {
  label: string;
  weeklyThreshold: number;
}

export interface GivingTierResult {
  label: string;
  weeklyThreshold: number;
}

export interface MembershipTrackDefinition {
  label: string;
  requiredMilestoneTypes: string[];
}

export interface MembershipTrackStatus {
  label: string;
  required_count: number;
  completed_count: number;
  is_complete: boolean;
}
