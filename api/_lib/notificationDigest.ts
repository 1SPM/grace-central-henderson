/**
 * Digest fan-out grouping — pure, no IO. api/cron/_notify.ts fetches raw
 * platform_events + staff_notification_prefs rows and passes them here;
 * this module decides who gets what, the route does the actual sending
 * and cursor advancement.
 *
 * Crisis notifications are never digested — they go out synchronously
 * from api/portal/_care.ts the moment a crisis is flagged, so a
 * 'crisis' category pref is always excluded here even if present.
 */

export interface DigestEvent {
  id: string;
  church_id: string;
  event_type: string;
  created_at: string;
}

export type NotificationCategory = 'crisis' | 'approvals' | 'finance' | 'agents' | 'digest';

export interface NotificationPref {
  user_id: string;
  church_id: string;
  category: NotificationCategory;
  channel: 'email' | 'sms';
  enabled: boolean;
}

export interface DigestUserRecipient {
  user_id: string;
  church_id: string;
  events: DigestEvent[];
}

/** Maps a platform_events eventType to a digest category by prefix. */
export function categoryForEventType(eventType: string): Exclude<NotificationCategory, 'crisis'> {
  if (eventType.startsWith('approval.')) return 'approvals';
  if (eventType.startsWith('agent_finding.')) return 'agents';
  if (eventType.startsWith('finance.')) return 'finance';
  return 'digest';
}

export function groupEventsForDigest(
  events: DigestEvent[],
  prefs: NotificationPref[],
): DigestUserRecipient[] {
  const enabledByUser = new Map<string, { church_id: string; categories: Set<NotificationCategory> }>();
  for (const pref of prefs) {
    if (pref.channel !== 'email' || !pref.enabled) continue;
    if (pref.category === 'crisis') continue;
    let entry = enabledByUser.get(pref.user_id);
    if (!entry) {
      entry = { church_id: pref.church_id, categories: new Set() };
      enabledByUser.set(pref.user_id, entry);
    }
    entry.categories.add(pref.category);
  }

  const recipients = new Map<string, DigestUserRecipient>();
  for (const event of events) {
    const category = categoryForEventType(event.event_type);
    for (const [userId, entry] of enabledByUser) {
      if (entry.church_id !== event.church_id) continue;
      if (!entry.categories.has(category)) continue;
      let recipient = recipients.get(userId);
      if (!recipient) {
        recipient = { user_id: userId, church_id: entry.church_id, events: [] };
        recipients.set(userId, recipient);
      }
      recipient.events.push(event);
    }
  }

  return Array.from(recipients.values());
}
