/**
 * GET /api/automation/status
 *
 * One call feeding the Settings → Automation tab: the scheduled jobs
 * (with their last run from cron_runs), the agent roster with per-church
 * enablement, and connected-service health. Read-only.
 *
 * Auth: Clerk Bearer token, staff roles — same guard as /api/agents/run.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';
import { loadSettings } from '../_lib/agents/runner.js';
import { loadMessagingSettings } from '../_lib/agents/messaging.js';
import { probeTtsHealth } from '../_lib/grace-tts.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ROLES = ['admin', 'staff', 'pastor', 'platform_admin'];

const CRON_JOBS = [
  {
    job: 'ai-anomaly',
    schedule: '0 5 * * *',
    label: 'AI spend watch',
    description: 'Reviews AI usage across the platform and flags anything unusual before it becomes a bill surprise.',
  },
  {
    job: 'reconcile-stripe',
    schedule: '0 6 * * *',
    label: 'Giving reconciliation',
    description: "Checks yesterday's giving ledger for anything that doesn't add up — volume spikes, drops, or missing credits.",
  },
  {
    job: 'agents',
    schedule: '0 7 * * *',
    label: 'Morning congregation review',
    description: 'Looks through the congregation for anyone who might need care — recent visitors, birthdays, lapsed givers, events without leaders — and prepares tasks and notes.',
  },
  {
    job: 'send-pending-emails',
    schedule: '0 8 * * *',
    label: 'Morning mail',
    description: 'Sends the emails the agents prepared — welcome notes, thank-yous, and birthday greetings.',
  },
] as const;

interface CronRunRow {
  job: string;
  ran_at: string;
  ok: boolean;
  duration_ms: number | null;
  summary: Record<string, unknown> | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'supabase not configured' });

  const auth = await requireClerkAuth(req, { allowedRoles: ALLOWED_ROLES });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // Last run per job (table may not exist yet if migration 030 hasn't run).
  const lastRuns = new Map<string, CronRunRow>();
  try {
    const { data } = await supabase
      .from('cron_runs')
      .select('job, ran_at, ok, duration_ms, summary')
      .order('ran_at', { ascending: false })
      .limit(40);
    for (const row of (data as CronRunRow[] | null) ?? []) {
      if (!lastRuns.has(row.job)) lastRuns.set(row.job, row);
    }
  } catch {
    // no ledger yet — jobs report last_run: null
  }

  const [settings, messagingSettings, tts] = await Promise.all([
    loadSettings(supabase, auth.churchId),
    loadMessagingSettings(supabase, auth.churchId),
    probeTtsHealth(),
  ]);

  const serverAgents = [
    { id: 'member-care', enabled: settings.member_care_enabled },
    { id: 'stewardship', enabled: settings.stewardship_enabled },
    { id: 'operations', enabled: settings.operations_enabled },
    { id: 'portal-engagement', enabled: settings.portal_engagement_enabled },
    { id: 'card-ops', enabled: settings.card_ops_enabled },
    { id: 'crisis-escalation', enabled: settings.crisis_escalation_enabled },
  ];

  const messagingAgentIds = ['life-event-agent', 'new-member-agent', 'donation-processing-agent'] as const;
  const messagingAgents = messagingAgentIds.map((id) => {
    const cfg = messagingSettings?.[id] as { enabled?: boolean } | undefined;
    return { id, enabled: Boolean(cfg?.enabled), configured: Boolean(cfg) };
  });

  const services = {
    voice: { configured: tts.ok, detail: tts.ok ? 'ElevenLabs neural voice' : 'Browser voice fallback' },
    ai: { configured: Boolean(process.env.GEMINI_API_KEY || process.env.HERMES_API_URL) },
    email: { configured: Boolean(process.env.RESEND_API_KEY) },
    sms: { configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) },
    stripe: { configured: Boolean(process.env.STRIPE_SECRET_KEY) },
    supabase: { configured: true },
  };

  return res.status(200).json({
    ok: true,
    crons: CRON_JOBS.map((c) => {
      const last = lastRuns.get(c.job);
      return {
        ...c,
        last_run: last
          ? { ran_at: last.ran_at, ok: last.ok, duration_ms: last.duration_ms, summary: last.summary }
          : null,
      };
    }),
    agents: {
      server: serverAgents,
      messaging: messagingAgents,
      thresholds: {
        member_care_inactive_days: settings.member_care_inactive_days,
        stewardship_lapsed_days: settings.stewardship_lapsed_days,
        stewardship_large_gift_usd: Math.round(settings.stewardship_large_gift_micro_usd / 1_000_000),
        operations_event_no_leader_days: settings.operations_event_no_leader_days,
      },
    },
    services,
  });
}
