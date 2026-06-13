import { getClerkTokenProvider } from '../supabase';

export interface LeadershipActivitySummary {
  totalLeaders: number;
  activeConversations: number;
  humanReplies24h: number;
  aiReplies24h: number;
  unassigned: number;
}

export interface LeadershipLeaderStats {
  leaderId: string;
  displayName: string;
  humanMessages: number;
  aiMessages: number;
  conversations: number;
  lastActiveAt: string | null;
  crisisOpen: number;
}

export interface LeadershipActivityEvent {
  at: string;
  type: string;
  leaderId?: string;
  memberName?: string;
  preview: string;
}

export interface LeadershipActivityData {
  summary: LeadershipActivitySummary;
  leaders: LeadershipLeaderStats[];
  recentEvents: LeadershipActivityEvent[];
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const provider = getClerkTokenProvider();
  const token = provider ? await provider() : null;
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

export async function fetchLeadershipActivity(): Promise<LeadershipActivityData | null> {
  const headers = await authHeaders();
  if (!headers) return null;

  const res = await fetch('/api/leadership/activity', { headers });
  if (!res.ok) return null;
  return res.json() as Promise<LeadershipActivityData>;
}

export function statsForLeader(
  data: LeadershipActivityData | null,
  leaderId: string,
): LeadershipLeaderStats | null {
  if (!data) return null;
  return data.leaders.find(l => l.leaderId === leaderId) ?? null;
}
