/**
 * Card Ops agent (Phase D, RUNBOOK RB-016).
 *
 * Watches the GRACE Impact Card program for operational stalls:
 *   1. KYC applications stuck in pending/in_review for more than N
 *      hours (default 48, per RB-016) — a member is waiting on us.
 *   2. Cards frozen for more than 14 days — either the member forgot
 *      (help them unfreeze) or something is wrong (investigate).
 *
 * KYC stalls are TASKS — a member is blocked. Stale freezes are
 * interactions (FYI-grade).
 */

import type { AgentFunction, AgentObservation } from './types.js';

const FROZEN_STALE_DAYS = 14;

export const cardOpsAgent: AgentFunction = (input) => {
  if (!input.settings.card_ops_enabled) return [];

  const observations: AgentObservation[] = [];
  const { now, settings, kycVerifications, cards, people } = input;

  const nameById = new Map(
    people.map(p => [
      p.id,
      (p.full_name && p.full_name.trim()) || [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || 'A member',
    ]),
  );

  // ----- KYC STUCK (RB-016) -----
  for (const kyc of kycVerifications) {
    if (kyc.status !== 'pending' && kyc.status !== 'in_review') continue;
    const submitted = new Date(kyc.submitted_at);
    if (Number.isNaN(submitted.getTime())) continue;
    const hours = Math.floor((now.getTime() - submitted.getTime()) / 3_600_000);
    if (hours < settings.card_ops_kyc_stuck_hours) continue;

    const name = kyc.person_id ? nameById.get(kyc.person_id) ?? 'A member' : 'A member';
    observations.push({
      dedupKey: `card-ops:kyc-stuck:${kyc.id}`,
      agentId: 'card-ops',
      kind: 'kyc_stuck',
      severity: hours >= settings.card_ops_kyc_stuck_hours * 2 ? 'urgent' : 'attention',
      title: `${name}'s Impact Card application stuck ${Math.floor(hours / 24)}d ${hours % 24}h`,
      detail: `KYC ${kyc.status.replace('_', ' ')} since ${submitted.toISOString().slice(0, 10)} — past the ${settings.card_ops_kyc_stuck_hours}h SLA (RB-016). Review it in Impact Card Accounts.`,
      personId: kyc.person_id,
      relatedId: kyc.id,
      metadata: { hours_stuck: hours, kyc_status: kyc.status },
      outputSink: 'task',
    });
  }

  // ----- STALE FREEZES -----
  for (const card of cards) {
    if (card.status !== 'frozen' || !card.frozen_at) continue;
    const frozen = new Date(card.frozen_at);
    if (Number.isNaN(frozen.getTime())) continue;
    const days = Math.floor((now.getTime() - frozen.getTime()) / 86_400_000);
    if (days < FROZEN_STALE_DAYS) continue;

    observations.push({
      dedupKey: `card-ops:frozen-stale:${card.id}`,
      agentId: 'card-ops',
      kind: 'card_frozen_stale',
      severity: 'info',
      title: `${card.cardholder_name}'s card has been frozen ${days} days`,
      detail: `Frozen since ${frozen.toISOString().slice(0, 10)}. Check whether the member needs help unfreezing or the card should be cancelled.`,
      personId: card.cardholder_person_id,
      relatedId: card.id,
      metadata: { days_frozen: days },
      outputSink: 'interaction',
    });
  }

  return observations;
};
