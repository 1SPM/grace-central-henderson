/**
 * Server-side messaging agents — the cron port of the client Rules
 * Engine agents (Life Event, New Member drip, Donation thank-you).
 *
 * The client agents in src/lib/agents/ only run when an operator
 * clicks "Run Now" in the browser. This module runs the same logic
 * daily from api/cron/_agents.ts so greetings, drip steps, and
 * thank-yous go out without anyone logging in.
 *
 * Config source: church_agent_settings.messaging_settings (JSONB) —
 * the same AgentConfig JSON the Rules Engine UI saves (see
 * src/hooks/useAgents.ts). Churches that never saved config are
 * SKIPPED: automated outbound email is opt-in, never default-on.
 *
 * Send path: everything goes through the email_outbox queue
 * (queueEmail) with a stable idempotency key per person/occasion, so
 * re-runs and manual triggers can never double-send:
 *   - life-event:birthday:<person_id>:<yyyy-mm-dd>
 *   - life-event:anniversary:<person_id>:<yyyy-mm-dd>
 *   - drip:day<N>:<person_id>
 *   - donation_thanks:<giving_id>
 *
 * The outbox is drained by the send-pending-emails cron one hour
 * after this runs (07:00 → 08:00 UTC). SMS is not sent from the cron
 * (Twilio sends remain manual via the Rules Engine "Run Now").
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { queueEmail } from '../email/queue.js';

// ---------------------------------------------------------------
// Config shapes (mirror of src/lib/agents/types.ts AgentConfig JSON)
// ---------------------------------------------------------------

interface MessagingAgentConfig {
  enabled?: boolean;
  settings?: Record<string, unknown>;
}

export interface MessagingSettings {
  'life-event-agent'?: MessagingAgentConfig;
  'new-member-agent'?: MessagingAgentConfig;
  'donation-processing-agent'?: MessagingAgentConfig;
}

export type MessagingAgentId = keyof MessagingSettings;

export interface MessagingRunResult {
  churchId: string;
  skipped: boolean;
  agentsRun: MessagingAgentId[];
  emailsQueued: number;
  emailsDuplicate: number;
  emailsFailed: number;
  byAgent: Record<string, { queued: number; duplicate: number; failed: number }>;
}

interface PersonRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  birth_date: string | null;
  join_date: string | null;
}

// ---------------------------------------------------------------
// Templates (ported from src/lib/agents/* client templates)
// ---------------------------------------------------------------

const DRIP_MESSAGES: Array<{ day: number; subject: string; html: string }> = [
  {
    day: 1,
    subject: 'Welcome to Our Family!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">Welcome to {{churchName}}!</h1>
        <p>Dear {{firstName}},</p>
        <p>We are so excited to officially welcome you as a member of our church family!</p>
        <p>This is the beginning of a wonderful journey together. We can't wait to see how God will work in your life as you grow with us.</p>
        <p>Here are some ways to get connected:</p>
        <ul>
          <li>Join a small group to build deeper relationships</li>
          <li>Explore volunteer opportunities</li>
          <li>Attend our upcoming events</li>
        </ul>
        <p>If you have any questions, don't hesitate to reach out!</p>
        <p>Blessings,<br/>{{pastorName}}<br/>{{churchName}}</p>
      </div>
    `,
  },
  {
    day: 3,
    subject: 'Getting Connected at {{churchName}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Let's Get You Connected!</h2>
        <p>Hi {{firstName}},</p>
        <p>Now that you're part of our family, we want to help you find your place!</p>
        <p><strong>Small Groups</strong> are a great way to build friendships and grow in faith. We have groups for all ages and interests.</p>
        <p><strong>Serving</strong> is another wonderful way to connect. Whether it's greeting, children's ministry, worship, or technical teams - there's a place for everyone!</p>
        <p>Would you like us to help connect you with a small group or ministry team? Just reply to this email!</p>
        <p>Looking forward to seeing you Sunday!</p>
        <p>Blessings,<br/>{{churchName}} Team</p>
      </div>
    `,
  },
  {
    day: 7,
    subject: 'Your First Week as a Member',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Happy One Week Anniversary!</h2>
        <p>Hi {{firstName}},</p>
        <p>Can you believe it's been a week already? We hope you're settling in well!</p>
        <p>We wanted to check in and see how your first week has been. Is there anything we can help you with? Any questions about our church, ministries, or how to get involved?</p>
        <p>Remember, we're here for you - that's what family is for!</p>
        <p>See you soon,<br/>{{churchName}} Team</p>
      </div>
    `,
  },
  {
    day: 14,
    subject: 'Two Weeks of Being Family',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Two Weeks In!</h2>
        <p>Hi {{firstName}},</p>
        <p>It's been two weeks since you joined our church family, and we've loved having you!</p>
        <p>By now, we hope you're starting to feel at home. If there's anything more we can do to help you connect, please let us know.</p>
        <p>We're so glad you're part of our family!</p>
        <p>Blessings,<br/>{{churchName}}</p>
      </div>
    `,
  },
  {
    day: 30,
    subject: 'Your First Month with Us!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Happy One Month!</h2>
        <p>Dear {{firstName}},</p>
        <p>Wow - it's been one month since you officially became part of our church family!</p>
        <p>We hope this month has been filled with meaningful connections, spiritual growth, and a sense of belonging.</p>
        <p>Thank you for choosing to grow with us. Here's to many more months of faith, fellowship, and family!</p>
        <p>With gratitude,<br/>{{pastorName}}<br/>{{churchName}}</p>
      </div>
    `,
  },
];

const BIRTHDAY_HTML = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center;">
    <h1 style="color: #4F46E5;">Happy Birthday, {{firstName}}!</h1>
    <p>Wishing you a wonderful birthday filled with joy and blessings.</p>
    <p>We're so grateful to have you as part of our church family, and we're praying this next year is your best one yet.</p>
    <p>With love,<br/>Your {{churchName}} Family</p>
  </div>
`;

const ANNIVERSARY_HTML = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center;">
    <h1 style="color: #4F46E5;">Happy Anniversary!</h1>
    <p>Dear {{firstName}},</p>
    <p>Today marks <strong>{{years}} {{yearWord}}</strong> since you joined our church family!</p>
    <p>We are so grateful for your presence in our community. Thank you for being part of {{churchName}}.</p>
    <p>With love and gratitude,<br/>Your {{churchName}} Family</p>
  </div>
`;

const DONATION_THANKS_HTML = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #4F46E5;">Thank You for Your Generosity!</h2>
    <p>Dear {{firstName}},</p>
    <p>Thank you for your gift of <strong>{{amount}}</strong> to the <strong>{{fund}}</strong> fund on {{date}}.</p>
    <p>Your faithful giving makes the ministry of {{churchName}} possible. We are grateful for you!</p>
    <p>This message serves as a receipt for your records. No goods or services were provided in exchange for this contribution.</p>
    <p>Blessings,<br/>{{churchName}}</p>
  </div>
`;

function fill(template: string, data: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(data)) {
    out = out.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return out;
}

function usd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// ---------------------------------------------------------------
// Settings + data loading
// ---------------------------------------------------------------

export async function loadMessagingSettings(
  supabase: SupabaseClient,
  churchId: string,
): Promise<MessagingSettings | null> {
  const { data, error } = await supabase
    .from('church_agent_settings')
    .select('messaging_settings')
    .eq('church_id', churchId)
    .maybeSingle();
  if (error || !data) return null;
  const settings = data.messaging_settings as MessagingSettings | null;
  if (!settings || Object.keys(settings).length === 0) return null;
  return settings;
}

async function fetchPeopleWithContact(
  supabase: SupabaseClient,
  churchId: string,
): Promise<PersonRow[]> {
  const { data, error } = await supabase
    .from('people')
    .select('id, first_name, last_name, email, status, birth_date, join_date')
    .eq('church_id', churchId)
    .limit(10_000);
  if (error || !data) return [];
  return data as PersonRow[];
}

// ---------------------------------------------------------------
// Runner
// ---------------------------------------------------------------

export async function runMessagingAgentsForChurch(
  supabase: SupabaseClient,
  churchId: string,
  now: Date = new Date(),
): Promise<MessagingRunResult> {
  const result: MessagingRunResult = {
    churchId,
    skipped: false,
    agentsRun: [],
    emailsQueued: 0,
    emailsDuplicate: 0,
    emailsFailed: 0,
    byAgent: {},
  };

  const settings = await loadMessagingSettings(supabase, churchId);
  if (!settings) {
    result.skipped = true;
    return result;
  }

  const { data: church } = await supabase
    .from('churches')
    .select('name')
    .eq('id', churchId)
    .maybeSingle();
  const fallbackChurchName = (church?.name as string | undefined) ?? 'Our Church';

  const people = await fetchPeopleWithContact(supabase, churchId);
  const todayMonthDay = now.toISOString().slice(5, 10); // 'MM-DD'
  const todayIso = now.toISOString().slice(0, 10);

  const tally = (agentId: MessagingAgentId, r: { queued: boolean; duplicate: boolean; error?: string }) => {
    const bucket = (result.byAgent[agentId] ??= { queued: 0, duplicate: 0, failed: 0 });
    if (r.queued) { bucket.queued += 1; result.emailsQueued += 1; }
    else if (r.duplicate) { bucket.duplicate += 1; result.emailsDuplicate += 1; }
    else { bucket.failed += 1; result.emailsFailed += 1; }
  };

  // ----- Life Event agent: birthdays + membership anniversaries today -----
  const lifeEvent = settings['life-event-agent'];
  if (lifeEvent?.enabled && lifeEvent.settings?.sendEmail !== false) {
    result.agentsRun.push('life-event-agent');
    const churchName = (lifeEvent.settings?.churchName as string | undefined) || fallbackChurchName;
    const enableBirthdays = lifeEvent.settings?.enableBirthdays !== false;
    const enableAnniversaries = lifeEvent.settings?.enableMembershipAnniversaries !== false;

    for (const p of people) {
      if (!p.email || p.status === 'inactive') continue;
      const firstName = p.first_name ?? 'Friend';

      if (enableBirthdays && p.birth_date && p.birth_date.slice(5, 10) === todayMonthDay) {
        tally('life-event-agent', await queueEmail({
          supabase,
          churchId,
          toAddr: p.email,
          subject: `Happy Birthday, ${firstName}!`,
          templateId: 'agent_birthday',
          html: fill(BIRTHDAY_HTML, { firstName, churchName }),
          idempotencyKey: `life-event:birthday:${p.id}:${todayIso}`,
          metadata: { agent_id: 'life-event-agent', person_id: p.id },
        }));
      }

      if (enableAnniversaries && p.join_date && p.join_date.slice(5, 10) === todayMonthDay) {
        const years = now.getUTCFullYear() - Number(p.join_date.slice(0, 4));
        if (years > 0) {
          tally('life-event-agent', await queueEmail({
            supabase,
            churchId,
            toAddr: p.email,
            subject: `Happy ${years} Year Anniversary at ${churchName}!`,
            templateId: 'agent_membership_anniversary',
            html: fill(ANNIVERSARY_HTML, {
              firstName,
              churchName,
              years: String(years),
              yearWord: years === 1 ? 'year' : 'years',
            }),
            idempotencyKey: `life-event:anniversary:${p.id}:${todayIso}`,
            metadata: { agent_id: 'life-event-agent', person_id: p.id },
          }));
        }
      }
    }
  }

  // ----- New Member agent: advance the drip campaign -----
  const newMember = settings['new-member-agent'];
  if (newMember?.enabled && newMember.settings?.enableDripCampaign !== false) {
    result.agentsRun.push('new-member-agent');
    const churchName = (newMember.settings?.churchName as string | undefined) || fallbackChurchName;
    const pastorName = (newMember.settings?.pastorName as string | undefined) || 'Pastor';
    const dripDays = Array.isArray(newMember.settings?.dripCampaignDays)
      ? (newMember.settings.dripCampaignDays as number[])
      : [1, 3, 7, 14, 30];

    for (const p of people) {
      if (!p.email || p.status !== 'member' || !p.join_date) continue;
      const joined = Date.parse(p.join_date);
      if (Number.isNaN(joined)) continue;
      const daysSinceJoin = Math.floor((now.getTime() - joined) / 86_400_000);

      const drip = DRIP_MESSAGES.find((m) => m.day === daysSinceJoin && dripDays.includes(m.day));
      if (!drip) continue;

      const firstName = p.first_name ?? 'Friend';
      const data = { firstName, churchName, pastorName };
      tally('new-member-agent', await queueEmail({
        supabase,
        churchId,
        toAddr: p.email,
        subject: fill(drip.subject, data),
        templateId: `agent_drip_day_${drip.day}`,
        html: fill(drip.html, data),
        idempotencyKey: `drip:day${drip.day}:${p.id}`,
        metadata: { agent_id: 'new-member-agent', person_id: p.id, drip_day: drip.day },
      }));
    }
  }

  // ----- Donation agent: thank-you receipts for offline gifts -----
  // Online (Stripe) gifts already get receipts from the webhook; this
  // covers manually-recorded gifts (cash, check, batch entry, import).
  const donation = settings['donation-processing-agent'];
  if (donation?.enabled && donation.settings?.autoSendReceipts !== false) {
    result.agentsRun.push('donation-processing-agent');
    const churchName = (donation.settings?.churchName as string | undefined) || fallbackChurchName;
    const sinceIso = new Date(now.getTime() - 26 * 3_600_000).toISOString();

    const { data: gifts } = await supabase
      .from('giving')
      .select('id, person_id, amount, fund, date, method, created_at')
      .eq('church_id', churchId)
      .gte('created_at', sinceIso)
      .neq('method', 'online')
      .limit(1000);

    const peopleById = new Map(people.map((p) => [p.id, p]));
    for (const g of (gifts as Array<{ id: string; person_id: string | null; amount: number; fund: string; date: string; method: string }> | null) ?? []) {
      if (!g.person_id) continue;
      const p = peopleById.get(g.person_id);
      if (!p?.email) continue;

      tally('donation-processing-agent', await queueEmail({
        supabase,
        churchId,
        toAddr: p.email,
        subject: `Thank you for your gift to ${churchName}`,
        templateId: 'agent_donation_thanks',
        html: fill(DONATION_THANKS_HTML, {
          firstName: p.first_name ?? 'Friend',
          churchName,
          amount: usd(Number(g.amount)),
          fund: g.fund || 'general',
          date: g.date,
        }),
        idempotencyKey: `donation_thanks:${g.id}`,
        metadata: { agent_id: 'donation-processing-agent', person_id: p.id, giving_id: g.id },
      }));
    }
  }

  // Roll up agent_stats + one summary log per agent so the Rules
  // Engine dashboard can show last-run status for the cron path too.
  for (const agentId of result.agentsRun) {
    const stats = result.byAgent[agentId] ?? { queued: 0, duplicate: 0, failed: 0 };
    await supabase.from('agent_stats').upsert(
      {
        church_id: churchId,
        agent_id: agentId,
        total_actions: stats.queued + stats.failed,
        successful_actions: stats.queued,
        failed_actions: stats.failed,
        last_run_at: now.toISOString(),
      },
      { onConflict: 'church_id,agent_id' },
    );
    await supabase.from('agent_logs').insert({
      church_id: churchId,
      agent_id: agentId,
      level: stats.failed > 0 ? 'warning' : 'info',
      message: `cron:messaging-run`,
      metadata: { queued: stats.queued, duplicate: stats.duplicate, failed: stats.failed },
    });
  }

  return result;
}
