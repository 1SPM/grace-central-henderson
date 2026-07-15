/**
 * GRACE Impact Card client — talks to /api/neobank (Clerk-authed,
 * Enterprise plan-gated). All money values are integer micro-USD per
 * the ledger convention.
 */

import { getClerkTokenProvider } from '../supabase';

export interface KycRecord {
  id: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired';
  full_name: string;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface CardRecord {
  id: string;
  i2c_card_id: string;
  masked_pan: string;
  cardholder_name: string;
  cardholder_person_id: string | null;
  expiry_month: number;
  expiry_year: number;
  status: 'pending' | 'active' | 'frozen' | 'cancelled' | 'expired';
  daily_limit_micro_usd: number;
  monthly_limit_micro_usd: number;
  issued_at: string;
  metadata?: {
    last_staff_action?: {
      action: string;
      reason: string;
      at: string;
      clerk_user_id?: string;
    };
    [key: string]: unknown;
  };
}

export interface CardTransaction {
  id: string;
  card_id: string | null;
  event_type: 'authorization' | 'capture' | 'refund' | 'reversal' | 'fee' | 'declined';
  direction: 'debit' | 'credit';
  amount_micro_usd: number;
  merchant_name: string | null;
  merchant_category: string | null;
  decline_reason: string | null;
  occurred_at: string;
}

export interface CardAccountRecord {
  id: string;
  person_id: string;
  i2c_account_id: string;
  account_name: string;
  /**
   * Omitted on the member-facing /api/neobank?resource=me response by
   * design — members never see their own account number or routing
   * details from this API (financial-safety brief). Present when this
   * record comes from a staff-facing resource (admin/account).
   */
  account_number_last4?: string;
  routing_number?: string | null;
  available_balance_micro_usd: number;
  status: 'pending' | 'active' | 'frozen' | 'closed';
  last_synced_at: string | null;
}

export interface CardTransferRecord {
  id: string;
  person_id: string;
  card_account_id: string | null;
  direction: 'outbound' | 'inbound';
  transfer_type: 'member' | 'ach' | 'bank' | 'give' | 'receive';
  counterparty_name: string;
  counterparty_ref: string | null;
  amount_micro_usd: number;
  memo: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  failure_reason: string | null;
  initiated_at: string;
  completed_at: string | null;
  metadata?: {
    staff_review?: {
      note: string;
      marked_at: string;
      clerk_user_id?: string;
    };
    [key: string]: unknown;
  };
}

export interface ImpactRouteRecord {
  id: string;
  person_id: string;
  route_label: string;
  route_fund: string;
  set_by: 'member' | 'staff' | 'system';
  effective_at: string;
}

export interface ImpactAllocationRecord {
  id: string;
  person_id: string;
  period_month: string;
  amount_micro_usd: number;
  route_label: string | null;
  source: 'interchange' | 'manual' | 'adjustment';
}

export interface MyCardData {
  person_id: string | null;
  kyc: KycRecord | null;
  cards: CardRecord[];
  transactions: CardTransaction[];
  account: CardAccountRecord | null;
  impact_route: ImpactRouteRecord | null;
  transfers: CardTransferRecord[];
  adapter_mode: 'live' | 'mock';
}

export interface AdminCardSummary {
  pending_kyc: number;
  active_cards: number;
  frozen_cards: number;
  interchange_mtd_micro_usd: number;
  spend_mtd_micro_usd: number;
  total_float_micro_usd: number;
  impact_mtd_micro_usd: number;
  decline_count_mtd: number;
  pending_transfers: number;
  failed_transfers: number;
  ledger_i2c_net_mtd_micro_usd: number;
  reconciliation_delta_micro_usd: number;
}

export interface AdminCardData {
  kyc_queue: (KycRecord & { person_id: string | null; email: string })[];
  cards: CardRecord[];
  interchange_events: CardTransaction[];
  accounts: CardAccountRecord[];
  transfers: CardTransferRecord[];
  impact_routes: ImpactRouteRecord[];
  impact_allocations: ImpactAllocationRecord[];
  summary: AdminCardSummary;
  adapter_mode: 'live' | 'mock';
}

export class PlanGateError extends Error {
  requiredPlan: string;
  constructor(message: string, requiredPlan: string) {
    super(message);
    this.requiredPlan = requiredPlan;
  }
}

export class NeobankFetchError extends Error {
  status: number;
  code: string;
  detail: string;
  requiredPlan?: string;

  constructor(status: number, body: Record<string, unknown>) {
    const code = String(body.error ?? 'request_failed');
    const detail = String(
      body.detail ?? body.error ?? `Impact Card API request failed (HTTP ${status})`,
    );
    super(detail);
    this.name = 'NeobankFetchError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    if (body.required_plan) this.requiredPlan = String(body.required_plan);
  }
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const provider = getClerkTokenProvider();
  const token = provider ? await provider() : null;
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function isPlanGateResponse(status: number, body: Record<string, unknown>): boolean {
  return (
    status === 402
    || body.error === 'plan_required'
    || (status === 403 && body.error === 'subscription_inactive')
  );
}

async function handleResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (isPlanGateResponse(res.status, body)) {
    throw new PlanGateError(
      String(body.detail || 'The Impact Card program requires the Enterprise plan.'),
      String(body.required_plan ?? 'enterprise'),
    );
  }
  if (!res.ok) throw new NeobankFetchError(res.status, body);
  return body as T;
}

export function microUsdToDollars(micro: number): number {
  return micro / 1_000_000;
}

/** Null = demo mode (no Clerk session). */
export async function fetchMyCard(): Promise<MyCardData | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const res = await fetch('/api/neobank?resource=me', { headers });
  return handleResponse<MyCardData>(res);
}

/** Demo mode allows unauthenticated admin reads when the server has VITE_ENABLE_DEMO_MODE. */
export async function fetchAdminCardProgram(): Promise<AdminCardData> {
  const headers = await authHeaders();
  const res = await fetch('/api/neobank?resource=admin', {
    headers: headers ?? { 'Content-Type': 'application/json' },
  });
  return handleResponse<AdminCardData>(res);
}

async function post<T>(payload: Record<string, unknown>): Promise<T | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const res = await fetch('/api/neobank', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return handleResponse<T>(res);
}

export function submitKyc(input: { fullName: string; dateOfBirth: string; email: string; phone?: string }) {
  return post<{ kyc: KycRecord }>({
    action: 'submit_kyc',
    full_name: input.fullName,
    date_of_birth: input.dateOfBirth,
    email: input.email,
    phone: input.phone,
  });
}

export function issueCard(kycVerificationId: string) {
  return post<{ card: CardRecord }>({ action: 'issue_card', kyc_verification_id: kycVerificationId });
}

export function freezeCard(cardId: string, reason?: string) {
  return post<{ card: CardRecord }>({ action: 'freeze_card', card_id: cardId, reason });
}

export function unfreezeCard(cardId: string) {
  return post<{ card: CardRecord }>({ action: 'unfreeze_card', card_id: cardId });
}

export function cancelCard(cardId: string, reason?: string) {
  return post<{ card: CardRecord }>({ action: 'cancel_card', card_id: cardId, reason });
}

export function reviewKyc(kycVerificationId: string, decision: 'approve' | 'reject', rejectionReason?: string) {
  return post<{ kyc: KycRecord }>({
    action: 'review_kyc',
    kyc_verification_id: kycVerificationId,
    decision,
    rejection_reason: rejectionReason,
  });
}

export function setCardLimits(cardId: string, limits: { dailyMicroUsd?: number; monthlyMicroUsd?: number }) {
  return post<{ card: CardRecord }>({
    action: 'set_limits',
    card_id: cardId,
    daily_limit_micro_usd: limits.dailyMicroUsd,
    monthly_limit_micro_usd: limits.monthlyMicroUsd,
  });
}

export function setImpactRoute(personId: string, routeLabel: string, routeFund?: string) {
  return post<{ impact_route: ImpactRouteRecord }>({
    action: 'set_impact_route',
    person_id: personId,
    route_label: routeLabel,
    route_fund: routeFund,
  });
}

export function syncAccountBalance(personId: string) {
  return post<{ account: CardAccountRecord }>({ action: 'sync_balance', person_id: personId });
}

export function createTransfer(input: {
  personId: string;
  amountMicroUsd: number;
  direction: 'outbound' | 'inbound';
  transferType: CardTransferRecord['transfer_type'];
  counterpartyName: string;
  counterpartyRef?: string;
  memo?: string;
}) {
  return post<{ transfer: CardTransferRecord }>({
    action: 'create_transfer',
    person_id: input.personId,
    amount_micro_usd: input.amountMicroUsd,
    direction: input.direction,
    transfer_type: input.transferType,
    counterparty_name: input.counterpartyName,
    counterparty_ref: input.counterpartyRef,
    memo: input.memo,
  });
}

export function retryTransfer(transferId: string) {
  return post<{ transfer: CardTransferRecord }>({ action: 'retry_transfer', transfer_id: transferId });
}

export function issueReplacementCard(cardId: string, reason?: string) {
  return post<{ card: CardRecord }>({ action: 'issue_replacement_card', card_id: cardId, reason });
}

export function markTransferForReview(transferId: string, note: string) {
  return post<{ transfer: CardTransferRecord }>({ action: 'review_transfer', transfer_id: transferId, note });
}

export async function fetchMemberAccount(personId: string) {
  const headers = await authHeaders();
  if (!headers) return null;
  const res = await fetch(`/api/neobank?resource=account&person_id=${encodeURIComponent(personId)}`, { headers });
  return handleResponse<{ account: CardAccountRecord | null; impact_route: ImpactRouteRecord | null; transfers: CardTransferRecord[] }>(res);
}
