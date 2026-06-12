/**
 * Care chat client — talks to /api/care/* (the only path to the
 * service-role-locked anchor_* tables) and maps rows into the existing
 * PastoralConversation/PastoralMessage UI types.
 */

import { getClerkTokenProvider } from '../supabase';
import type {
  PastoralConversation,
  PastoralMessage,
  HelpCategory,
  ConversationPriority,
  ConversationStatus,
} from '../../types';

interface AnchorConversationRow {
  id: string;
  church_id: string;
  leader_id: string | null;
  person_id: string | null;
  anonymous_session_id: string | null;
  status: string;
  topic: string | null;
  category: string | null;
  priority: string;
  crisis_flagged: boolean;
  last_message_at: string;
  created_at: string;
  closed_at: string | null;
}

interface AnchorMessageRow {
  id: string;
  conversation_id: string;
  sender: 'member' | 'ai_clone' | 'human_leader' | 'system';
  content: string;
  is_crisis_flag: boolean;
  created_at: string;
}

export interface AdminCareSummary {
  total: number;
  active: number;
  crisis: number;
  unassigned: number;
}

export interface AdminCareData {
  conversations: PastoralConversation[];
  summary: AdminCareSummary;
  memberNames: Map<string, string>;
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const provider = getClerkTokenProvider();
  const token = provider ? await provider() : null;
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function mapStatus(s: string): ConversationStatus {
  switch (s) {
    case 'active': return 'active';
    case 'idle': return 'waiting';
    case 'handoff_offered':
    case 'handoff_accepted': return 'escalated';
    case 'closed': return 'resolved';
    case 'archived': return 'archived';
    default: return 'active';
  }
}

function mapSender(s: AnchorMessageRow['sender']): PastoralMessage['sender'] {
  if (s === 'member') return 'user';
  if (s === 'human_leader') return 'leader';
  return 'ai';
}

function senderName(s: AnchorMessageRow['sender']): string {
  if (s === 'member') return 'You';
  if (s === 'human_leader') return 'Care Team';
  if (s === 'system') return 'Care Assistant';
  return 'AI Care Assistant';
}

export function mapConversations(
  conversations: AnchorConversationRow[],
  messages: AnchorMessageRow[],
): PastoralConversation[] {
  const byConv = new Map<string, PastoralMessage[]>();
  for (const m of messages) {
    const list = byConv.get(m.conversation_id) ?? [];
    list.push({
      id: m.id,
      conversationId: m.conversation_id,
      sender: mapSender(m.sender),
      senderName: senderName(m.sender),
      content: m.content,
      timestamp: m.created_at,
    });
    byConv.set(m.conversation_id, list);
  }
  return conversations.map(c => ({
    id: c.id,
    helpRequestId: c.id,
    leaderId: c.leader_id ?? undefined,
    status: mapStatus(c.status),
    priority: (c.priority as ConversationPriority) ?? 'medium',
    category: (c.category as HelpCategory) ?? 'general',
    isAnonymous: !c.person_id,
    personId: c.person_id ?? undefined,
    messages: byConv.get(c.id) ?? [],
    createdAt: c.created_at,
    updatedAt: c.last_message_at,
    resolvedAt: c.closed_at ?? undefined,
  }));
}

/** Member: list own conversations. Returns null when auth is unavailable (demo mode). */
export async function fetchMyConversations(): Promise<PastoralConversation[] | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const res = await fetch('/api/care/conversations', { headers });
  if (!res.ok) throw new Error(`care read failed (HTTP ${res.status})`);
  const body = await res.json();
  return mapConversations(body.conversations ?? [], body.messages ?? []);
}

/** Member: create a help request. Returns the new conversation, or null in demo mode. */
export async function createCareConversation(input: {
  category: HelpCategory;
  description?: string;
  isAnonymous: boolean;
  leaderId?: string;
}): Promise<PastoralConversation | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const res = await fetch('/api/care/conversations', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      category: input.category,
      description: input.description,
      is_anonymous: input.isAnonymous,
      // Demo leader ids (leader-1…) aren't DB rows; only forward UUIDs.
      leader_id: input.leaderId && /^[0-9a-fA-F-]{36}$/.test(input.leaderId) ? input.leaderId : undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `care request failed (HTTP ${res.status})`);
  }
  const body = await res.json();
  const [conv] = mapConversations([body.conversation], body.messages ?? []);
  return conv ?? null;
}

/** Append a message. Returns the mapped message, or null in demo mode. */
export async function sendCareMessage(
  conversationId: string,
  content: string,
  asStaff = false,
): Promise<PastoralMessage | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const res = await fetch('/api/care/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      conversation_id: conversationId,
      content,
      sender: asStaff ? 'human_leader' : 'member',
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `care message failed (HTTP ${res.status})`);
  }
  const body = await res.json();
  const m = body.message as AnchorMessageRow;
  return {
    id: m.id,
    conversationId: m.conversation_id,
    sender: mapSender(m.sender),
    senderName: senderName(m.sender),
    content: m.content,
    timestamp: m.created_at,
  };
}

/** Staff: full care overview for the Pastoral Care dashboard. Null in demo mode. */
export async function fetchAdminCare(): Promise<AdminCareData | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const res = await fetch('/api/care/admin', { headers });
  if (!res.ok) throw new Error(`care admin read failed (HTTP ${res.status})`);
  const body = await res.json();
  const conversations = mapConversations(body.conversations ?? [], body.messages ?? []);
  const memberNames = new Map<string, string>(
    ((body.people ?? []) as { id: string; first_name: string; last_name: string }[])
      .map(p => [p.id, `${p.first_name} ${p.last_name}`]),
  );
  return {
    conversations,
    summary: body.summary as AdminCareSummary,
    memberNames,
  };
}
