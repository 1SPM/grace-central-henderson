/**
 * useServerAgents — read-side of the server agent pipeline for the
 * Rules Engine dashboard.
 *
 * The six observation agents (member-care, stewardship, operations,
 * portal-engagement, card-ops, crisis-escalation) run on the daily
 * cron and write to agent_stats / agent_logs. Until now the Rules
 * Engine UI never showed them. This hook pulls:
 *
 *   - per-agent stats (total/success/failed + last_run_at)
 *   - recent observations (agent_logs rows with message 'observation:*')
 *
 * and exposes runNow() → POST /api/agents/run for an on-demand run
 * (Clerk-authenticated; no-ops in demo mode without a token).
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, getClerkTokenProvider } from '../lib/supabase';

export const SERVER_AGENT_IDS = [
  'member-care',
  'stewardship',
  'operations',
  'portal-engagement',
  'card-ops',
  'crisis-escalation',
] as const;

export const SERVER_AGENT_LABELS: Record<string, { name: string; description: string }> = {
  'member-care': { name: 'Member Care', description: 'Flags inactive members and upcoming birthdays for follow-up' },
  'stewardship': { name: 'Stewardship', description: 'Detects lapsed givers, first-time gifts, and large gifts' },
  'operations': { name: 'Operations', description: 'Watches for overdue tasks and events missing leaders' },
  'portal-engagement': { name: 'Portal Engagement', description: 'Spots members going quiet in the member portal' },
  'card-ops': { name: 'Card Operations', description: 'Monitors stuck KYC applications and frozen cards' },
  'crisis-escalation': { name: 'Crisis Escalation', description: 'Escalates unassigned crisis-flagged care conversations' },
};

export interface ServerAgentStatus {
  agentId: string;
  name: string;
  description: string;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  lastRunAt?: string;
}

export interface ServerAgentObservation {
  id: string;
  agentId: string;
  kind: string;
  severity?: string;
  createdAt: string;
}

export function useServerAgents(churchId: string | undefined) {
  const [serverAgents, setServerAgents] = useState<ServerAgentStatus[]>([]);
  const [observations, setObservations] = useState<ServerAgentObservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!churchId || !isSupabaseConfigured() || !supabase) return;
    setLoading(true);
    try {
      const [statsRes, logsRes] = await Promise.all([
        supabase
          .from('agent_stats')
          .select('agent_id, total_actions, successful_actions, failed_actions, last_run_at')
          .eq('church_id', churchId)
          .in('agent_id', [...SERVER_AGENT_IDS]),
        supabase
          .from('agent_logs')
          .select('id, agent_id, message, metadata, created_at')
          .eq('church_id', churchId)
          .in('agent_id', [...SERVER_AGENT_IDS])
          .like('message', 'observation:%')
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      const statsByAgent = new Map(
        ((statsRes.data as Array<{
          agent_id: string;
          total_actions: number;
          successful_actions: number;
          failed_actions: number;
          last_run_at: string | null;
        }> | null) ?? []).map((r) => [r.agent_id, r]),
      );

      setServerAgents(SERVER_AGENT_IDS.map((agentId) => {
        const labels = SERVER_AGENT_LABELS[agentId];
        const s = statsByAgent.get(agentId);
        return {
          agentId,
          name: labels.name,
          description: labels.description,
          totalActions: s?.total_actions ?? 0,
          successfulActions: s?.successful_actions ?? 0,
          failedActions: s?.failed_actions ?? 0,
          lastRunAt: s?.last_run_at ?? undefined,
        };
      }));

      setObservations(
        ((logsRes.data as Array<{
          id: string;
          agent_id: string;
          message: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        }> | null) ?? []).map((r) => ({
          id: r.id,
          agentId: r.agent_id,
          kind: r.message.replace(/^observation:/, ''),
          severity: typeof r.metadata?.severity === 'string' ? r.metadata.severity : undefined,
          createdAt: r.created_at,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runNow = useCallback(async () => {
    setRunError(null);
    const provider = getClerkTokenProvider();
    const token = provider ? await provider() : null;
    if (!token) {
      setRunError('Sign in with a staff account to run server agents.');
      return;
    }
    setRunning(true);
    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setRunError(body.error ?? `Run failed (${res.status})`);
        return;
      }
      await refresh();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }, [refresh]);

  return { serverAgents, observations, loading, running, runError, runNow, refresh };
}
