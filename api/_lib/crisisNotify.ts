/**
 * Synchronous crisis staff notification — called from
 * api/portal/_care.ts the moment a care request is crisis-flagged, so
 * an alert reaches staff in seconds rather than waiting for the digest
 * cron. Never throws: every failure is caught and logged by the caller
 * wrapping this in try/catch, matching the resilience posture of the
 * agent_findings insert right above it in care.ts.
 *
 * No member details in the email/SMS body — title + deep link only,
 * same confidentiality rule as the crisis Decision Queue item and the
 * agent_findings row (api/_lib/decisionQueue.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendViaResend } from './email/resend.js';
import { sendSms } from './sms/send.js';

interface CrisisPrefRow {
  user_id: string;
  channel: 'email' | 'sms';
  users: { email: string | null; phone: string | null } | null;
}

export interface NotifyCrisisStaffResult {
  recipients: number;
  emailsSent: number;
  smsSent: number;
}

export async function notifyCrisisStaff(
  supabase: SupabaseClient,
  churchId: string,
  appUrl: string,
): Promise<NotifyCrisisStaffResult> {
  const { data: prefRows } = await supabase
    .from('staff_notification_prefs')
    .select('user_id, channel, users(email, phone)')
    .eq('church_id', churchId)
    .eq('category', 'crisis')
    .eq('enabled', true);

  const prefs = (prefRows ?? []) as unknown as CrisisPrefRow[];
  const deepLink = `${appUrl}/app#/pastoral-care`;
  const subject = 'Crisis-flagged care request awaiting triage';
  const html = `<p>A care request has been flagged as crisis-priority and needs triage.</p><p><a href="${deepLink}">Open Pastoral Care</a></p>`;
  const smsBody = `GRACE: Crisis-flagged care request awaiting triage. ${deepLink}`;

  let emailsSent = 0;
  let smsSent = 0;
  for (const pref of prefs) {
    if (pref.channel === 'email' && pref.users?.email) {
      const result = await sendViaResend({ to: pref.users.email, subject, html });
      if (result.ok) emailsSent += 1;
    } else if (pref.channel === 'sms' && pref.users?.phone) {
      const result = await sendSms({ to: pref.users.phone, message: smsBody });
      if (result.ok) smsSent += 1;
    }
  }

  return { recipients: prefs.length, emailsSent, smsSent };
}
