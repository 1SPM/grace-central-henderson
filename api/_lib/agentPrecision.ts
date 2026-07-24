/**
 * Per-agent precision stats computed from agent_findings rows. Pure —
 * no IO. The route fetches the rows for a church (optionally windowed)
 * and passes them in here.
 */

export interface AgentFindingPrecisionRow {
  agent_id: string;
  status: 'open' | 'triaged' | 'actioned' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
}

export interface AgentPrecisionStats {
  generated: number;
  dismissed: number;
  actioned: number;
  resolved: number;
  dismissal_rate: number;
  /** Median hours between created_at and resolved_at across resolved findings. null when none have resolved yet — not a fabricated 0. */
  median_hours_to_resolve: number | null;
}

function median(sortedAsc: number[]): number {
  const mid = Math.floor(sortedAsc.length / 2);
  return sortedAsc.length % 2 === 0
    ? (sortedAsc[mid - 1] + sortedAsc[mid]) / 2
    : sortedAsc[mid];
}

export function computeAgentPrecision(
  rows: AgentFindingPrecisionRow[],
): Record<string, AgentPrecisionStats> {
  const byAgent = new Map<string, AgentFindingPrecisionRow[]>();
  for (const row of rows) {
    const arr = byAgent.get(row.agent_id) ?? [];
    arr.push(row);
    byAgent.set(row.agent_id, arr);
  }

  const out: Record<string, AgentPrecisionStats> = {};
  for (const [agentId, agentRows] of byAgent) {
    const generated = agentRows.length;
    const dismissed = agentRows.filter(r => r.status === 'dismissed').length;
    const actioned = agentRows.filter(r => r.status === 'actioned').length;
    const resolvedRows = agentRows.filter(r => r.status === 'resolved' && r.resolved_at);
    const resolved = resolvedRows.length;

    const hoursToResolve = resolvedRows
      .map(r => (new Date(r.resolved_at as string).getTime() - new Date(r.created_at).getTime()) / 3_600_000)
      .filter(h => Number.isFinite(h) && h >= 0)
      .sort((a, b) => a - b);

    out[agentId] = {
      generated,
      dismissed,
      actioned,
      resolved,
      dismissal_rate: generated > 0 ? dismissed / generated : 0,
      median_hours_to_resolve: hoursToResolve.length > 0 ? median(hoursToResolve) : null,
    };
  }
  return out;
}
