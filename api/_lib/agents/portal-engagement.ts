/**
 * Portal Engagement agent (Phase D).
 *
 * Watches the member portal's pulse:
 *   1. Members provisioned for the portal who haven't used it in N
 *      days (default 14) — engagement is decaying; suggest a nudge.
 *   2. Members invited/enabled who have NEVER signed in — the
 *      invitation likely got lost; suggest a personal follow-up.
 *
 * Both are interactions (touchpoint suggestions), not tasks — portal
 * inactivity is lower-stakes than pastoral-care signals, and a flood
 * of tasks would train staff to ignore the agent.
 */

import type { AgentFunction, AgentObservation, AgentPersonSnapshot } from './types.js';

function displayName(p: AgentPersonSnapshot): string {
  if (p.full_name && p.full_name.trim()) return p.full_name.trim();
  const composed = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return composed || 'Unnamed';
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

const NEVER_SIGNED_IN_GRACE_DAYS = 7;

export const portalEngagementAgent: AgentFunction = (input) => {
  if (!input.settings.portal_engagement_enabled) return [];

  const observations: AgentObservation[] = [];
  const { now, settings, people, portalActivity } = input;

  // Most recent portal event per person (any type).
  const lastEventByPerson = new Map<string, string>();
  for (const e of portalActivity) {
    if (!e.person_id) continue;
    const prev = lastEventByPerson.get(e.person_id);
    if (!prev || e.created_at > prev) lastEventByPerson.set(e.person_id, e.created_at);
  }

  for (const p of people) {
    if (!p.portal_enabled) continue;
    const name = displayName(p);

    const lastSeen = lastEventByPerson.get(p.id) ?? p.portal_last_seen_at ?? null;

    if (!lastSeen) {
      // Enabled but never signed in. Give the invitation a grace
      // window (joined_at proxies the enable date when we have it).
      const enabledAt = p.joined_at ? new Date(p.joined_at) : null;
      const daysSinceEnabled = enabledAt && !Number.isNaN(enabledAt.getTime())
        ? daysBetween(enabledAt, now)
        : NEVER_SIGNED_IN_GRACE_DAYS;
      if (daysSinceEnabled >= NEVER_SIGNED_IN_GRACE_DAYS) {
        observations.push({
          dedupKey: `portal-engagement:never-signed-in:${p.id}`,
          agentId: 'portal-engagement',
          kind: 'portal_never_signed_in',
          severity: 'info',
          title: `${name} hasn't activated their portal account`,
          detail: 'Invited to the member portal but never signed in. The invite may be buried — a personal text with the link usually lands better than a re-send.',
          personId: p.id,
          metadata: { portal_enabled: true },
          outputSink: 'interaction',
        });
      }
      continue;
    }

    const last = new Date(lastSeen);
    if (Number.isNaN(last.getTime())) continue;
    const days = daysBetween(last, now);
    if (days >= settings.portal_engagement_inactive_days) {
      observations.push({
        dedupKey: `portal-engagement:inactive:${p.id}`,
        agentId: 'portal-engagement',
        kind: 'portal_inactive',
        severity: days >= settings.portal_engagement_inactive_days * 2 ? 'attention' : 'info',
        title: `${name} hasn't opened the portal in ${days} days`,
        detail: `Last portal activity ${last.toISOString().slice(0, 10)}. Engagement decays fast — a relevant nudge (upcoming event, new announcement) re-engages better than a generic reminder.`,
        personId: p.id,
        metadata: { days_since_portal_activity: days },
        outputSink: 'interaction',
      });
    }
  }

  return observations;
};
