/**
 * Member Care agent.
 *
 * Surfaces three signals:
 *   1. Members who haven't had an interaction logged in N days
 *      (default 30) — likely fell off the radar.
 *   2. Upcoming birthdays within N days (default 7) — pastoral
 *      outreach opportunity.
 *   3. Recent visitors who joined > 14 days ago but have no
 *      follow-up interaction yet — connection assimilation gap.
 *
 * Each observation is a TASK (not just a log) — care is meant to
 * be actioned by a staff member, not just observed.
 */

import type { AgentFunction, AgentObservation, AgentPersonSnapshot } from './types.js';

const VISITOR_FOLLOWUP_WINDOW_DAYS = 14;

function displayName(p: AgentPersonSnapshot): string {
  if (p.full_name && p.full_name.trim()) return p.full_name.trim();
  const composed = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return composed || 'Unnamed';
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Returns the next occurrence of (month, day) relative to `now`,
 * or null if the birthday string is malformed. Ignores year.
 */
function nextBirthdayDaysAway(birthdayStr: string | null | undefined, now: Date): number | null {
  if (!birthdayStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdayStr);
  if (!m) return null;
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let candidate = new Date(Date.UTC(nowUtc.getUTCFullYear(), month - 1, day));
  if (candidate < nowUtc) {
    candidate = new Date(Date.UTC(nowUtc.getUTCFullYear() + 1, month - 1, day));
  }
  return daysBetween(nowUtc, candidate);
}

export const memberCareAgent: AgentFunction = (input) => {
  if (!input.settings.member_care_enabled) return [];

  const observations: AgentObservation[] = [];
  const { now, settings, people } = input;

  for (const p of people) {
    const status = (p.status ?? '').toLowerCase();
    const name = displayName(p);

    // ----- INACTIVE MEMBERS -----
    // Skip visitors (different signal — see "recent visitor followup" below)
    // and people already marked inactive (operator already aware).
    if (['member', 'leader', 'regular'].includes(status)) {
      if (p.last_interaction_at) {
        const last = new Date(p.last_interaction_at);
        if (!Number.isNaN(last.getTime())) {
          const days = daysBetween(last, now);
          if (days >= settings.member_care_inactive_days) {
            observations.push({
              dedupKey: `member-care:inactive:${p.id}`,
              agentId: 'member-care',
              kind: 'inactive_member',
              severity: days >= settings.member_care_inactive_days * 2 ? 'urgent' : 'attention',
              title: `${name} hasn't been touched in ${days} days`,
              detail: `Last interaction logged ${days} days ago. Suggest a check-in call or text.`,
              personId: p.id,
              metadata: { days_since_last_interaction: days, status },
              outputSink: 'task',
            });
          }
        }
      } else if (p.joined_at) {
        // Member but no interactions recorded ever.
        const joined = new Date(p.joined_at);
        if (!Number.isNaN(joined.getTime())) {
          const days = daysBetween(joined, now);
          if (days >= settings.member_care_inactive_days) {
            observations.push({
              dedupKey: `member-care:no-interactions:${p.id}`,
              agentId: 'member-care',
              kind: 'inactive_member',
              severity: 'attention',
              title: `${name} has no recorded interactions`,
              detail: `Member since ${joined.toISOString().slice(0, 10)} (${days} days) with no logged interactions. Add a touchpoint.`,
              personId: p.id,
              metadata: { days_since_joined: days, status },
              outputSink: 'task',
            });
          }
        }
      }
    }

    // ----- BIRTHDAYS -----
    if (settings.member_care_birthday_window_days > 0) {
      const daysAway = nextBirthdayDaysAway(p.birthday, now);
      if (daysAway !== null && daysAway <= settings.member_care_birthday_window_days) {
        observations.push({
          dedupKey: `member-care:birthday:${p.id}:${new Date(now).getUTCFullYear()}`,
          agentId: 'member-care',
          kind: 'upcoming_birthday',
          severity: daysAway === 0 ? 'attention' : 'info',
          title:
            daysAway === 0
              ? `${name}'s birthday is today`
              : `${name}'s birthday is in ${daysAway} day${daysAway === 1 ? '' : 's'}`,
          detail: `Birthday: ${p.birthday}. Consider sending a card or note.`,
          personId: p.id,
          metadata: { days_until_birthday: daysAway },
          outputSink: 'task',
        });
      }
    }

    // ----- RECENT VISITOR FOLLOWUP -----
    if (status === 'visitor' && p.joined_at) {
      const joined = new Date(p.joined_at);
      if (!Number.isNaN(joined.getTime())) {
        const days = daysBetween(joined, now);
        const hasFollowup = !!p.last_interaction_at && new Date(p.last_interaction_at) > joined;
        if (days >= VISITOR_FOLLOWUP_WINDOW_DAYS && !hasFollowup) {
          observations.push({
            dedupKey: `member-care:visitor-followup:${p.id}`,
            agentId: 'member-care',
            kind: 'recent_visitor_followup',
            severity: 'attention',
            title: `${name} visited ${days} days ago — no follow-up yet`,
            detail: `Visitor since ${joined.toISOString().slice(0, 10)}. The first 30 days are critical for assimilation.`,
            personId: p.id,
            metadata: { days_since_visit: days },
            outputSink: 'task',
          });
        }
      }
    }
  }

  return observations;
};
