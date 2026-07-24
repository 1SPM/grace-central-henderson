/**
 * Synchronous crisis staff notification — called from
 * api/portal/_care.ts the moment a care request is crisis-flagged, so
 * an alert reaches staff in seconds rather than waiting for the digest
 * cron. Never throws into the member's submission: the caller wraps
 * this in try/catch, matching the resilience posture of the
 * agent_findings insert right above it in care.ts.
 *
 * Recipient resolution, in order:
 *   1. staff_notification_prefs rows for (church, category='crisis') —
 *      the enabled ones get their chosen channel (email and/or SMS).
 *   2. If the church has ZERO crisis rows of any kind (never configured
 *      — distinct from "everyone explicitly opted out", which leaves
 *      enabled=false rows behind), fall back to emailing every active
 *      care.view holder in the church. A crisis must never be silently
 *      unrouted just because nobody has opened the Settings card yet.
 *      Migration 052 seeded defaults for staff existing at that time;
 *      this fallback covers churches/staff created after it.
 *
 * No member details in the email/SMS body — title + deep link only,
 * same confidentiality rule as the crisis Decision Queue item and the
 * agent_findings row (api/_lib/decisionQueue.ts). The deep link prefers
 * STAFF_APP_URL (full URL to the staff SPA, including any path prefix
 * like /app) and falls back to `<appUrl>/app`, which is correct for
 * gracecrm-centralhenderson.org but not for root-mounted hosts — set
 * STAFF_APP_URL in Vercel to override.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendViaResend } from './email/resend.js';
import { sendSms } from './sms/send.js';

interface CrisisPrefRow {
  user_id: string;
  channel: 'email' | 'sms';
  enabled: boolean;
  users: { email: string | null; phone: string | null } | null;
}

export interface NotifyCrisisStaffResult {
  recipients: number;
  emailsSent: number;
  smsSent: number;
  usedFallback: boolean;
}

/**
 * Emails of every active user in the church whose role grants
 * care.view. Two-step lookup (global roles carrying the key, then the
 * church's users holding one of those roles) — staff counts are small,
 * so no pagination needed.
 */
async function careViewHolderEmails(supabase: SupabaseClient, churchId: string): Promise<string[]> {
  const { data: roleRows } = await supabase
    .from('role_permissions')
    .select('role_id, permissions!inner(key)')
    .eq('permissions.key', 'care.view');
  const roleIds = ((roleRows ?? []) as Array<{ role_id: string }>).map(r => r.role_id);
  if (roleIds.length === 0) return [];

  const { data: userRows } = await supabase
    .from('users')
    .select('id, email, user_roles!inner(role_id, revoked_at)')
    .eq('church_id', churchId)
    .eq('account_status', 'active')
    .is('user_roles.revoked_at', null)
    .in('user_roles.role_id', roleIds);

  const emails = new Set<string>();
  for (const u of (userRows ?? []) as Array<{ email: string | null }>) {
    if (u.email) emails.add(u.email);
  }
  return Array.from(emails);
}

export async function notifyCrisisStaff(
  supabase: SupabaseClient,
  churchId: string,
  appUrl: string,
): Promise<NotifyCrisisStaffResult> {
  const { data: prefRows } = await supabase
    .from('staff_notification_prefs')
    .select('user_id, channel, enabled, users(email, phone)')
    .eq('church_id', churchId)
    .eq('category', 'crisis');

  const prefs = (prefRows ?? []) as unknown as CrisisPrefRow[];
  const deepLink = `${process.env.STAFF_APP_URL ?? `${appUrl}/app`}#/pastoral-care`;
  const subject = 'Crisis-flagged care request awaiting triage';
  const html = `<p>A care request has been flagged as crisis-priority and needs triage.</p><p><a href="${deepLink}">Open Pastoral Care</a></p>`;
  const smsBody = `GRACE: Crisis-flagged care request awaiting triage. ${deepLink}`;

  let emailsSent = 0;
  let smsSent = 0;

  if (prefs.length === 0) {
    // Never-configured church: email every active care.view holder.
    const emails = await careViewHolderEmails(supabase, churchId);
    for (const email of emails) {
      const result = await sendViaResend({ to: email, subject, html });
      if (result.ok) emailsSent += 1;
    }
    return { recipients: emails.length, emailsSent, smsSent, usedFallback: true };
  }

  const enabled = prefs.filter(p => p.enabled);
  for (const pref of enabled) {
    if (pref.channel === 'email' && pref.users?.email) {
      const result = await sendViaResend({ to: pref.users.email, subject, html });
      if (result.ok) emailsSent += 1;
    } else if (pref.channel === 'sms' && pref.users?.phone) {
      const result = await sendSms({ to: pref.users.phone, message: smsBody });
      if (result.ok) smsSent += 1;
    }
  }

  return { recipients: enabled.length, emailsSent, smsSent, usedFallback: false };
}
