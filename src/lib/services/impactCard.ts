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

export interface MyCardData {
  person_id: string | null;
  kyc: KycRecord | null;
  cards: CardRecord[];
  transactions: CardTransaction[];
  adapter_mode: 'live' | 'mock';
}

export interface AdminCardData {
  kyc_queue: (KycRecord & { person_id: string | null; email: string })[];
  cards: CardRecord[];
  interchange_events: CardTransaction[];
  summary: {
    pending_kyc: number;
    active_cards: number;
    frozen_cards: number;
    interchange_mtd_micro_usd: number;
    spend_mtd_micro_usd: number;
  };
  adapter_mode: 'live' | 'mock';
}

export class PlanGateError extends Error {
  requiredPlan: string;
  constructor(message: string, requiredPlan: string) {
    super(message);
    this.requiredPlan = requiredPlan;
  }
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const provider = getClerkTokenProvider();
  const token = provider ? await provider() : null;
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (res.status === 402 || (res.status === 403 && body.error === 'subscription_inactive')) {
    throw new PlanGateError(
      body.detail || 'The Impact Card program requires the Enterprise plan.',
      body.required_plan ?? 'enterprise',
    );
  }
  if (!res.ok) throw new Error(body.error || `request failed (HTTP ${res.status})`);
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

export async function fetchAdminCardProgram(): Promise<AdminCardData | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const res = await fetch('/api/neobank?resource=admin', { headers });
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

export function freezeCard(cardId: string) {
  return post<{ card: CardRecord }>({ action: 'freeze_card', card_id: cardId });
}

export function unfreezeCard(cardId: string) {
  return post<{ card: CardRecord }>({ action: 'unfreeze_card', card_id: cardId });
}

export function cancelCard(cardId: string) {
  return post<{ card: CardRecord }>({ action: 'cancel_card', card_id: cardId });
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
