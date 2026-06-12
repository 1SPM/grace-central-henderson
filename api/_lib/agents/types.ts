/**
 * Server-side agent contracts.
 *
 * Each agent is a pure function: takes a snapshot of relevant church
 * data + the church's thresholds, returns a list of `AgentObservation`.
 * The runner persists observations into the appropriate output sinks
 * (tasks, interactions, agent_logs).
 *
 * Pure-function design lets us:
 *   - Unit test each agent in isolation (no Supabase mock for the
 *     observation logic itself)
 *   - Re-run an agent against a deterministic input snapshot during
 *     debugging
 *   - Run agents in parallel without IO contention
 */

export type AgentId =
  | 'member-care'
  | 'stewardship'
  | 'operations'
  | 'portal-engagement'
  | 'card-ops'
  | 'crisis-escalation';

export type ObservationKind =
  // member-care
  | 'inactive_member'
  | 'upcoming_birthday'
  | 'recent_visitor_followup'
  // stewardship
  | 'lapsed_giver'
  | 'first_time_gift'
  | 'large_gift'
  // operations
  | 'event_no_leader'
  | 'task_overdue'
  // portal-engagement
  | 'portal_inactive'
  | 'portal_never_signed_in'
  // card-ops (RUNBOOK RB-016)
  | 'kyc_stuck'
  | 'card_frozen_stale'
  // crisis-escalation
  | 'crisis_conversation'
  ;

export type ObservationSeverity = 'info' | 'attention' | 'urgent';

export interface AgentObservation {
  /** Stable identity within an agent run: `<agentId>:<kind>:<subjectId>`. Used for idempotency. */
  dedupKey: string;
  agentId: AgentId;
  kind: ObservationKind;
  severity: ObservationSeverity;
  /** Human-readable summary for the surfaced task/interaction. */
  title: string;
  /** Longer detail explaining the why. */
  detail: string;
  /** Person this observation is about, when applicable. */
  personId?: string | null;
  /** Event / pledge / other entity this observation is about. */
  relatedId?: string | null;
  /** Extra context for downstream surface (e.g. days_since_last_gift). */
  metadata?: Record<string, unknown>;
  /** Where the runner should write this. */
  outputSink: 'task' | 'interaction' | 'log_only';
}

export interface AgentSettings {
  member_care_enabled: boolean;
  stewardship_enabled: boolean;
  operations_enabled: boolean;
  portal_engagement_enabled: boolean;
  card_ops_enabled: boolean;
  crisis_escalation_enabled: boolean;
  member_care_inactive_days: number;
  member_care_birthday_window_days: number;
  stewardship_lapsed_days: number;
  stewardship_large_gift_micro_usd: number;
  stewardship_flag_first_time_gift: boolean;
  operations_event_no_leader_days: number;
  portal_engagement_inactive_days: number;
  card_ops_kyc_stuck_hours: number;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  member_care_enabled: true,
  stewardship_enabled: true,
  operations_enabled: true,
  portal_engagement_enabled: true,
  card_ops_enabled: true,
  crisis_escalation_enabled: true,
  member_care_inactive_days: 30,
  member_care_birthday_window_days: 7,
  stewardship_lapsed_days: 60,
  stewardship_large_gift_micro_usd: 1_000_000_000,
  stewardship_flag_first_time_gift: true,
  operations_event_no_leader_days: 7,
  portal_engagement_inactive_days: 14,
  card_ops_kyc_stuck_hours: 48,                 // per RUNBOOK RB-016
};

/**
 * Minimal shapes the agents need from the upstream tables. Wider shapes
 * exist in the DB; agents only read what they need.
 */

export interface AgentPersonSnapshot {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  status?: string | null;                  // 'visitor' | 'regular' | 'member' | 'inactive' | 'leader'
  birthday?: string | null;                // YYYY-MM-DD (year may be 1900 for missing year)
  joined_at?: string | null;               // when they first connected
  /** Most recent interaction timestamp from the `interactions` table. */
  last_interaction_at?: string | null;
  /** Member portal provisioning + presence (Phase A/B columns). */
  portal_enabled?: boolean | null;
  portal_last_seen_at?: string | null;
}

export interface AgentGivingSnapshot {
  id: string;
  person_id: string | null;
  amount_micro_usd: number;
  occurred_at: string;                     // ISO 8601
  is_first_time?: boolean;                 // computed upstream (no prior gift from this person)
}

export interface AgentEventSnapshot {
  id: string;
  title: string;
  starts_at: string;                       // ISO 8601
  leader_id?: string | null;
}

export interface AgentTaskSnapshot {
  id: string;
  title: string;
  due_date?: string | null;                // YYYY-MM-DD
  status: string;                          // 'pending' | 'done' | ...
}

export interface AgentPortalActivitySnapshot {
  person_id: string | null;
  event_type: string;
  created_at: string;                      // ISO 8601
}

export interface AgentKycSnapshot {
  id: string;
  person_id: string | null;
  status: string;                          // 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired'
  submitted_at: string;                    // ISO 8601
}

export interface AgentCardSnapshot {
  id: string;
  cardholder_person_id: string | null;
  cardholder_name: string;
  status: string;                          // 'pending' | 'active' | 'frozen' | 'cancelled' | 'expired'
  frozen_at?: string | null;
}

export interface AgentCrisisConversationSnapshot {
  id: string;
  person_id: string | null;
  category?: string | null;
  status: string;                          // anchor_conversations.status
  crisis_flagged_at: string;               // ISO 8601
  leader_id: string | null;
}

export interface AgentInput {
  churchId: string;
  /** "Now" — injected for deterministic testing. */
  now: Date;
  settings: AgentSettings;
  people: AgentPersonSnapshot[];
  giving: AgentGivingSnapshot[];
  events: AgentEventSnapshot[];
  tasks: AgentTaskSnapshot[];
  /** Portal activity events in the lookback window (Phase D agents). */
  portalActivity: AgentPortalActivitySnapshot[];
  kycVerifications: AgentKycSnapshot[];
  cards: AgentCardSnapshot[];
  crisisConversations: AgentCrisisConversationSnapshot[];
}

export type AgentFunction = (input: AgentInput) => AgentObservation[];
