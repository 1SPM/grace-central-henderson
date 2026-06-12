/**
 * Crisis Escalation agent (Phase D).
 *
 * Anchor care conversations flagged for crisis language must never
 * sit unseen. Every open crisis-flagged conversation becomes an
 * URGENT task until the conversation is closed — and re-fires daily
 * (dedup window is 24h) so an unactioned crisis keeps resurfacing
 * rather than scrolling away.
 *
 * Unassigned crisis conversations get extra emphasis: nobody owns
 * them yet, which is the most dangerous state.
 */

import type { AgentFunction, AgentObservation } from './types';

export const crisisEscalationAgent: AgentFunction = (input) => {
  if (!input.settings.crisis_escalation_enabled) return [];

  const observations: AgentObservation[] = [];
  const { now, crisisConversations, people } = input;

  const nameById = new Map(
    people.map(p => [
      p.id,
      (p.full_name && p.full_name.trim()) || [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null,
    ]),
  );

  for (const conv of crisisConversations) {
    if (conv.status === 'closed' || conv.status === 'archived') continue;

    const flagged = new Date(conv.crisis_flagged_at);
    const hoursAgo = Number.isNaN(flagged.getTime())
      ? 0
      : Math.floor((now.getTime() - flagged.getTime()) / 3_600_000);
    const name = conv.person_id ? nameById.get(conv.person_id) : null;
    const who = name ?? 'An anonymous member';
    const unassigned = !conv.leader_id;

    observations.push({
      // Day-scoped dedup key: re-fires every 24h while the crisis stays open.
      dedupKey: `crisis-escalation:${conv.id}:${now.toISOString().slice(0, 10)}`,
      agentId: 'crisis-escalation',
      kind: 'crisis_conversation',
      severity: 'urgent',
      title: unassigned
        ? `CRISIS — unassigned: ${who} needs immediate pastoral contact`
        : `CRISIS: ${who}'s care conversation is flagged`,
      detail:
        `Crisis language detected in a care conversation${conv.category ? ` (${conv.category})` : ''}, ` +
        `flagged ${hoursAgo}h ago${unassigned ? ' and NOT yet assigned to a leader' : ''}. ` +
        'Open the Pastoral Care dashboard and respond personally. If there is any indication of immediate danger, call 911 / 988.',
      personId: conv.person_id,
      relatedId: conv.id,
      metadata: { hours_since_flag: hoursAgo, unassigned, category: conv.category ?? null },
      outputSink: 'task',
    });
  }

  return observations;
};
