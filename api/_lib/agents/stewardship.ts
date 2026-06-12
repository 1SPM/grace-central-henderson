/**
 * Stewardship agent.
 *
 * Three signals from the giving stream:
 *   1. Lapsed givers — historically regular donors who haven't given
 *      in N days (default 60).
 *   2. First-time gifts — any new donor; a thank-you opportunity.
 *   3. Large gifts — any single gift ≥ threshold (default $1000).
 *
 * Stewardship observations are mostly INTERACTIONS (record-only)
 * rather than tasks, with one exception: lapsed givers create a
 * task because the recovery moment is action-required.
 *
 * The agent does NOT generate the thank-you wording itself —
 * that's the AI gateway's job, called from the runner when the
 * UI surfaces the observation. This keeps the agent deterministic
 * and free of model cost.
 */

import type { AgentFunction, AgentGivingSnapshot, AgentObservation } from './types.js';

function dollarsFromMicro(m: number): number {
  return m / 1_000_000;
}

interface DonorRollup {
  personId: string;
  totalMicroUsd: number;
  giftCount: number;
  firstGift: AgentGivingSnapshot;
  lastGift: AgentGivingSnapshot;
}

function rollupGiving(giving: AgentGivingSnapshot[]): Map<string, DonorRollup> {
  const m = new Map<string, DonorRollup>();
  for (const g of giving) {
    if (!g.person_id) continue;
    const existing = m.get(g.person_id);
    if (!existing) {
      m.set(g.person_id, {
        personId: g.person_id,
        totalMicroUsd: g.amount_micro_usd,
        giftCount: 1,
        firstGift: g,
        lastGift: g,
      });
    } else {
      existing.totalMicroUsd += g.amount_micro_usd;
      existing.giftCount += 1;
      if (g.occurred_at < existing.firstGift.occurred_at) existing.firstGift = g;
      if (g.occurred_at > existing.lastGift.occurred_at) existing.lastGift = g;
    }
  }
  return m;
}

export const stewardshipAgent: AgentFunction = (input) => {
  if (!input.settings.stewardship_enabled) return [];

  const { now, settings, giving, people } = input;
  const observations: AgentObservation[] = [];

  const peopleById = new Map(people.map((p) => [p.id, p]));
  const rollups = rollupGiving(giving);

  // ----- FIRST-TIME GIFTS -----
  // For each gift in the snapshot window flagged is_first_time=true (or
  // the only gift the donor has in the snapshot AND they've never given
  // in our rolled-up history), surface a thank-you opportunity.
  if (settings.stewardship_flag_first_time_gift) {
    for (const g of giving) {
      const isFirst = g.is_first_time === true
        || (g.person_id && rollups.get(g.person_id)?.giftCount === 1);
      if (!isFirst || !g.person_id) continue;
      const person = peopleById.get(g.person_id);
      const name = person?.full_name || `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || 'A new donor';
      observations.push({
        dedupKey: `stewardship:first-time:${g.id}`,
        agentId: 'stewardship',
        kind: 'first_time_gift',
        severity: 'attention',
        title: `${name} gave for the first time — $${dollarsFromMicro(g.amount_micro_usd).toFixed(2)}`,
        detail: `Send a personal thank-you. First-time gifts are the highest-conversion stewardship moment.`,
        personId: g.person_id,
        relatedId: g.id,
        metadata: { amount_micro_usd: g.amount_micro_usd, gift_date: g.occurred_at },
        outputSink: 'task',
      });
    }
  }

  // ----- LARGE GIFTS -----
  for (const g of giving) {
    if (g.amount_micro_usd >= settings.stewardship_large_gift_micro_usd) {
      const person = g.person_id ? peopleById.get(g.person_id) : null;
      const name = person?.full_name
        || (person ? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() : '')
        || 'Anonymous';
      observations.push({
        dedupKey: `stewardship:large-gift:${g.id}`,
        agentId: 'stewardship',
        kind: 'large_gift',
        severity: 'attention',
        title: `Major gift: ${name} gave $${dollarsFromMicro(g.amount_micro_usd).toFixed(2)}`,
        detail: `Pastoral acknowledgement recommended within 48 hours. Generosity of this size deserves a personal touch.`,
        personId: g.person_id ?? null,
        relatedId: g.id,
        metadata: { amount_micro_usd: g.amount_micro_usd, gift_date: g.occurred_at },
        outputSink: 'task',
      });
    }
  }

  // ----- LAPSED GIVERS -----
  // A donor who has 2+ historical gifts AND whose last gift was N+ days ago.
  // (The 2+ threshold avoids flagging one-time visitors.)
  for (const r of rollups.values()) {
    if (r.giftCount < 2) continue;
    const last = new Date(r.lastGift.occurred_at);
    if (Number.isNaN(last.getTime())) continue;
    const days = Math.floor((now.getTime() - last.getTime()) / 86_400_000);
    if (days < settings.stewardship_lapsed_days) continue;
    const person = peopleById.get(r.personId);
    const name = person?.full_name || `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || 'A regular donor';
    observations.push({
      dedupKey: `stewardship:lapsed:${r.personId}`,
      agentId: 'stewardship',
      kind: 'lapsed_giver',
      severity: days >= settings.stewardship_lapsed_days * 2 ? 'urgent' : 'attention',
      title: `${name} hasn't given in ${days} days`,
      detail: `Regular donor (${r.giftCount} prior gifts, lifetime $${dollarsFromMicro(r.totalMicroUsd).toFixed(0)}). Check in pastorally — could be life circumstance, not stewardship issue.`,
      personId: r.personId,
      metadata: {
        days_since_last_gift: days,
        lifetime_micro_usd: r.totalMicroUsd,
        gift_count: r.giftCount,
        last_gift_date: r.lastGift.occurred_at,
      },
      outputSink: 'task',
    });
  }

  return observations;
};
