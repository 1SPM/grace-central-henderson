/**
 * Server-side agent runner.
 *
 * Pulls a per-church snapshot, calls each enabled agent, persists the
 * resulting observations into the right output sinks (tasks /
 * interactions / agent_logs), and dedups against prior runs so
 * subsequent invocations don't pile up duplicate tasks.
 *
 * Idempotency strategy: every observation carries a stable
 * `dedupKey` (e.g. `member-care:inactive:<person_id>`). The runner
 * checks `agent_logs` for a matching key in the last 24 hours and
 * skips if found. This means:
 *
 *   - Two runs in the same day for the same condition → 1 task
 *   - The same condition recurring tomorrow → a fresh task (the
 *     operator likely already actioned yesterday's)
 *
 * Sinks:
 *   - 'task'        → tasks table + agent_logs entry
 *   - 'interaction' → interactions table + agent_logs entry
 *   - 'log_only'    → agent_logs only (no surface for the user)
 *
 * Failure mode: per-observation try/catch. One failed write doesn't
 * abort the whole run. Failure counts roll up into the returned
 * RunResult for surfacing in the cron response.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { memberCareAgent } from './member-care';
import { stewardshipAgent } from './stewardship';
import { operationsAgent } from './operations';
import type {
  AgentInput,
  AgentObservation,
  AgentSettings,
  AgentId,
  AgentEventSnapshot,
  AgentGivingSnapshot,
  AgentPersonSnapshot,
  AgentTaskSnapshot,
} from './types';
import { DEFAULT_AGENT_SETTINGS } from './types';

const AGENTS: Array<{ id: AgentId; fn: (input: AgentInput) => AgentObservation[] }> = [
  { id: 'member-care', fn: memberCareAgent },
  { id: 'stewardship', fn: stewardshipAgent },
  { id: 'operations',  fn: operationsAgent },
];

const DEDUP_WINDOW_HOURS = 24;

export interface RunResult {
  churchId: string;
  agentsRun: AgentId[];
  observationsGenerated: number;
  observationsWritten: number;
  observationsSkippedDedup: number;
  observationsFailed: number;
  byAgent: Record<AgentId, { generated: number; written: number; skipped: number; failed: number }>;
}

export async function loadSettings(
  supabase: SupabaseClient,
  churchId: string,
): Promise<AgentSettings> {
  const { data, error } = await supabase
    .from('church_agent_settings')
    .select('*')
    .eq('church_id', churchId)
    .maybeSingle();
  if (error || !data) return { ...DEFAULT_AGENT_SETTINGS };
  // Numeric columns may come back as strings under some PostgREST setups.
  return {
    member_care_enabled: data.member_care_enabled !== false,
    stewardship_enabled: data.stewardship_enabled !== false,
    operations_enabled:  data.operations_enabled  !== false,
    member_care_inactive_days:        Number(data.member_care_inactive_days        ?? DEFAULT_AGENT_SETTINGS.member_care_inactive_days),
    member_care_birthday_window_days: Number(data.member_care_birthday_window_days ?? DEFAULT_AGENT_SETTINGS.member_care_birthday_window_days),
    stewardship_lapsed_days:          Number(data.stewardship_lapsed_days          ?? DEFAULT_AGENT_SETTINGS.stewardship_lapsed_days),
    stewardship_large_gift_micro_usd: Number(data.stewardship_large_gift_micro_usd ?? DEFAULT_AGENT_SETTINGS.stewardship_large_gift_micro_usd),
    stewardship_flag_first_time_gift: data.stewardship_flag_first_time_gift !== false,
    operations_event_no_leader_days:  Number(data.operations_event_no_leader_days  ?? DEFAULT_AGENT_SETTINGS.operations_event_no_leader_days),
  };
}

async function fetchPeople(supabase: SupabaseClient, churchId: string): Promise<AgentPersonSnapshot[]> {
  // people + a derived last_interaction_at via a window function would be
  // ideal, but we ship the simple path: pull people then pull interactions
  // separately and join client-side. Performance check at first tenant > 5k people.
  // Schema mapping for the existing grace-crm prod DB:
  //   - There's no `full_name` column → we synthesize "first last".
  //   - The column is `birth_date` not `birthday`.
  //   - The column is `join_date` not `joined_at` (and there's a
  //     separate `first_visit` we ignore here — first-visit goes
  //     through the recent-visitor follow-up path).
  const { data: people, error } = await supabase
    .from('people')
    .select('id, first_name, last_name, status, birth_date, join_date')
    .eq('church_id', churchId)
    .limit(10_000);
  if (error || !people) return [];

  const { data: lastInteractions } = await supabase
    .from('interactions')
    .select('person_id, created_at')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })
    .limit(20_000);

  const lastByPerson = new Map<string, string>();
  for (const r of (lastInteractions as Array<{ person_id: string; created_at: string }> | null) ?? []) {
    if (!lastByPerson.has(r.person_id)) lastByPerson.set(r.person_id, r.created_at);
  }

  return (people as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    status: string | null;
    birth_date: string | null;
    join_date: string | null;
  }>).map((p): AgentPersonSnapshot => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    full_name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null,
    status: p.status,
    birthday: p.birth_date,
    joined_at: p.join_date,
    last_interaction_at: lastByPerson.get(p.id) ?? null,
  }));
}

async function fetchRecentGiving(
  supabase: SupabaseClient,
  churchId: string,
  sinceIso: string,
): Promise<AgentGivingSnapshot[]> {
  const { data, error } = await supabase
    .from('giving')
    .select('id, person_id, amount, date, created_at')
    .eq('church_id', churchId)
    .gte('date', sinceIso.slice(0, 10))
    .limit(10_000);
  if (error || !data) return [];
  return (data as Array<{ id: string; person_id: string | null; amount: number; date: string; created_at: string }>).map((g) => ({
    id: g.id,
    person_id: g.person_id,
    amount_micro_usd: Math.round(Number(g.amount) * 1_000_000),
    occurred_at: g.date + 'T00:00:00Z',
  }));
}

async function fetchEvents(supabase: SupabaseClient, churchId: string): Promise<AgentEventSnapshot[]> {
  // Schema mapping: the table is `calendar_events` not `events`, and the
  // start column is `start_date` not `starts_at`. There's no leader
  // assignment column on this table — the operations agent's
  // "event_no_leader" signal will skip for every row until we add
  // volunteer assignments to calendar events (TD-037). Until then,
  // pass leader_id: null and the agent will flag every upcoming event.
  // Cap the horizon to limit noise.
  const horizon = new Date(Date.now() + 60 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, title, start_date')
    .eq('church_id', churchId)
    .gte('start_date', new Date().toISOString().slice(0, 10))
    .lte('start_date', horizon.slice(0, 10))
    .limit(500);
  if (error || !data) return [];
  return (data as Array<{ id: string; title: string; start_date: string }>).map((e): AgentEventSnapshot => ({
    id: e.id,
    title: e.title,
    starts_at: e.start_date.includes('T') ? e.start_date : `${e.start_date}T09:00:00Z`,
    leader_id: null,
  }));
}

async function fetchTasks(supabase: SupabaseClient, churchId: string): Promise<AgentTaskSnapshot[]> {
  // Schema mapping: the prod tasks table uses `completed` (boolean) not
  // `status`. We surface non-completed tasks as status='pending' so the
  // overdue-task agent sees them.
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, completed')
    .eq('church_id', churchId)
    .eq('completed', false)
    .limit(2000);
  if (error || !data) return [];
  return (data as Array<{ id: string; title: string; due_date: string | null; completed: boolean }>).map((t): AgentTaskSnapshot => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    status: t.completed ? 'done' : 'pending',
  }));
}

async function loadRecentDedupKeys(
  supabase: SupabaseClient,
  churchId: string,
  sinceIso: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('agent_logs')
    .select('metadata')
    .eq('church_id', churchId)
    .gte('created_at', sinceIso)
    .like('message', 'observation:%')
    .limit(10_000);
  const keys = new Set<string>();
  for (const r of (data as Array<{ metadata: Record<string, unknown> | null }> | null) ?? []) {
    const k = r.metadata?.dedup_key;
    if (typeof k === 'string') keys.add(k);
  }
  return keys;
}

async function persistObservation(
  supabase: SupabaseClient,
  churchId: string,
  obs: AgentObservation,
): Promise<'written' | 'skipped' | 'failed'> {
  try {
    if (obs.outputSink === 'task') {
      // Schema mapping: prod tasks table uses `completed` (boolean) +
      // `category` text; no `status`, `source`, or `metadata` columns.
      // We embed observation kind into category prefix so the existing
      // task UI can filter by category. Dedup key still lives in
      // agent_logs.metadata so dedup works regardless.
      const { error } = await supabase.from('tasks').insert({
        church_id: churchId,
        title: obs.title,
        description: obs.detail,
        priority: obs.severity === 'urgent' ? 'high' : obs.severity === 'attention' ? 'medium' : 'low',
        category: `agent:${obs.agentId}`,
        completed: false,
        person_id: obs.personId ?? null,
      });
      if (error) throw new Error(`tasks insert: ${error.message}`);
    } else if (obs.outputSink === 'interaction') {
      // Schema mapping: prod interactions uses `content` not `notes`,
      // no `metadata` column. Embed the full context into content.
      const { error } = await supabase.from('interactions').insert({
        church_id: churchId,
        person_id: obs.personId ?? null,
        type: 'agent_observation',
        content: `[${obs.agentId}] ${obs.title} — ${obs.detail}`,
        created_by_name: `agent:${obs.agentId}`,
      });
      if (error) throw new Error(`interactions insert: ${error.message}`);
    }
    // Always write the agent_log entry (the dedup index).
    await supabase.from('agent_logs').insert({
      church_id: churchId,
      agent_id: obs.agentId,
      level: 'info',
      message: `observation:${obs.kind}`,
      metadata: {
        dedup_key: obs.dedupKey,
        severity: obs.severity,
        person_id: obs.personId,
        related_id: obs.relatedId,
        sink: obs.outputSink,
        ...obs.metadata,
      },
    });
    return 'written';
  } catch (err) {
    console.error('[agents] persistObservation failed', { dedupKey: obs.dedupKey, err: String(err) });
    return 'failed';
  }
}

export async function runAgentsForChurch(
  supabase: SupabaseClient,
  churchId: string,
  now: Date = new Date(),
): Promise<RunResult> {
  const settings = await loadSettings(supabase, churchId);

  const sinceDedup = new Date(now.getTime() - DEDUP_WINDOW_HOURS * 3_600_000).toISOString();
  const sinceGiving = new Date(now.getTime() - 365 * 86_400_000).toISOString();

  const [people, giving, events, tasks, dedup] = await Promise.all([
    fetchPeople(supabase, churchId),
    fetchRecentGiving(supabase, churchId, sinceGiving),
    fetchEvents(supabase, churchId),
    fetchTasks(supabase, churchId),
    loadRecentDedupKeys(supabase, churchId, sinceDedup),
  ]);

  const input: AgentInput = { churchId, now, settings, people, giving, events, tasks };

  const result: RunResult = {
    churchId,
    agentsRun: [],
    observationsGenerated: 0,
    observationsWritten: 0,
    observationsSkippedDedup: 0,
    observationsFailed: 0,
    byAgent: {
      'member-care': { generated: 0, written: 0, skipped: 0, failed: 0 },
      'stewardship': { generated: 0, written: 0, skipped: 0, failed: 0 },
      'operations':  { generated: 0, written: 0, skipped: 0, failed: 0 },
    },
  };

  for (const a of AGENTS) {
    const enabledKey = `${a.id.replace('-', '_')}_enabled` as keyof AgentSettings;
    if (!settings[enabledKey]) continue;
    result.agentsRun.push(a.id);

    const observations = a.fn(input);
    result.observationsGenerated += observations.length;
    result.byAgent[a.id].generated = observations.length;

    for (const obs of observations) {
      if (dedup.has(obs.dedupKey)) {
        result.observationsSkippedDedup += 1;
        result.byAgent[a.id].skipped += 1;
        continue;
      }
      const status = await persistObservation(supabase, churchId, obs);
      if (status === 'written') {
        result.observationsWritten += 1;
        result.byAgent[a.id].written += 1;
        dedup.add(obs.dedupKey);                     // local dedup within this run
      } else if (status === 'failed') {
        result.observationsFailed += 1;
        result.byAgent[a.id].failed += 1;
      }
    }
  }

  // Roll up agent_stats
  for (const a of result.agentsRun) {
    const stats = result.byAgent[a];
    await supabase.from('agent_stats').upsert(
      {
        church_id: churchId,
        agent_id: a,
        total_actions: stats.written,
        successful_actions: stats.written,
        failed_actions: stats.failed,
        last_run_at: now.toISOString(),
      },
      { onConflict: 'church_id,agent_id' },
    );
  }

  return result;
}

/** Returns the list of church_ids that have at least one agent enabled. */
export async function listChurchesWithAgents(supabase: SupabaseClient): Promise<string[]> {
  // Two ways: settings table OR fall back to ALL churches if no settings rows
  // exist yet (defaults are all-enabled). We do both: union the two lists.
  const { data: settingsRows } = await supabase
    .from('church_agent_settings')
    .select('church_id, member_care_enabled, stewardship_enabled, operations_enabled');
  const enabledByRow = new Set(
    ((settingsRows as Array<{ church_id: string; member_care_enabled: boolean; stewardship_enabled: boolean; operations_enabled: boolean }> | null) ?? [])
      .filter((r) => r.member_care_enabled || r.stewardship_enabled || r.operations_enabled)
      .map((r) => r.church_id),
  );
  const disabledByRow = new Set(
    ((settingsRows as Array<{ church_id: string; member_care_enabled: boolean; stewardship_enabled: boolean; operations_enabled: boolean }> | null) ?? [])
      .filter((r) => !r.member_care_enabled && !r.stewardship_enabled && !r.operations_enabled)
      .map((r) => r.church_id),
  );

  const { data: allChurches } = await supabase.from('churches').select('id').limit(5000);
  const out = new Set<string>(enabledByRow);
  for (const c of (allChurches as Array<{ id: string }> | null) ?? []) {
    if (!disabledByRow.has(c.id)) out.add(c.id);
  }
  return Array.from(out);
}
