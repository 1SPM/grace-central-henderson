import type { GraceMessage, GraceData } from './types';
import { TENANT_DEFAULT_SETTINGS } from '../../config/tenant';

/**
 * v1 was a single un-namespaced key shared by every user on a machine —
 * on a shared workstation, switching staff accounts inherited the
 * previous user's transcript. v2 is namespaced by users.id and is only a
 * fallback now that the server persists conversations (ADR-014); v1
 * transcripts are not migrated, they're simply superseded.
 */
export function messagesStorageKey(userId?: string): string {
  return userId ? `grace-chat-messages-v2:${userId}` : 'grace-chat-messages-v2:anon';
}
export const MESSAGES_PERSIST_LIMIT = 50;

/** sessionStorage key — cleared each browser session, so the full greeting
 *  plays again next time even though chat history persists across sessions. */
export const GRACE_PANEL_SESSION_KEY = 'grace-panel-launched-session';

const RETURN_GREETINGS = [
  "I'm here — what's next?",
  "I'm here.",
  "What's next?",
  "Back again — what can I help with?",
];

/**
 * Short acknowledgment for the 2nd+ panel open in the same session — a
 * live assistant doesn't re-introduce itself every time you glance over.
 */
export function pickReturnGreeting(): GraceMessage {
  const content = RETURN_GREETINGS[Math.floor(Math.random() * RETURN_GREETINGS.length)];
  return { id: `regreet-${Date.now()}`, role: 'assistant', content, source: 'regreet' };
}

function greetingFallback(data: GraceData, salutation?: string): GraceMessage {
  const churchName = data.churchName || TENANT_DEFAULT_SETTINGS.profile.name;
  const opener = salutation
    ? `${salutation}\n\nI'm GRACE — your admin assistant for ${churchName}.`
    : `Hi — I'm GRACE, your admin assistant for ${churchName}.`;
  return {
    id: 'greet',
    role: 'assistant',
    content: `${opener}\n\nAsk me anything about your church data, or pick a starter on the left. I'll make editable action cards before anything is saved.`,
  };
}

/**
 * Compose the assistant's greeting based on live church data — surfaces overdue
 * tasks, new visitors, drifting members, active prayers, and upcoming events
 * when there's something worth flagging. Falls back to the static intro when
 * the church is quiet so the panel doesn't open with awkward emptiness.
 */
export function buildGreeting(data: GraceData, salutation?: string): GraceMessage {
  const { people, tasks, events, prayers, attendance } = data;
  const churchName = data.churchName || TENANT_DEFAULT_SETTINGS.profile.name;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000);

  const overdue = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr).length;
  const newVisitors = people.filter(p => p.status === 'visitor' && p.firstVisit && new Date(p.firstVisit) >= sevenDaysAgo).length;
  const activePrayers = prayers.filter(p => !p.isAnswered).length;
  const eventsSoon = events.filter(e => new Date(e.startDate) >= now && new Date(e.startDate) <= sevenDaysFromNow).length;
  const attendedRecently = new Set(
    attendance.filter(a => new Date(a.date) >= thirtyDaysAgo).map(a => a.personId),
  );
  const inactive = people.filter(p => (p.status === 'member' || p.status === 'regular') && !attendedRecently.has(p.id)).length;

  const lines: string[] = [];
  if (overdue > 0) lines.push(`${overdue} ${overdue === 1 ? 'task is' : 'tasks are'} overdue`);
  if (newVisitors > 0) lines.push(`${newVisitors} new ${newVisitors === 1 ? 'visitor' : 'visitors'} this week`);
  if (inactive > 0) lines.push(`${inactive} ${inactive === 1 ? 'member hasn’t' : 'members haven’t'} attended in 30 days`);
  if (activePrayers > 0) lines.push(`${activePrayers} active prayer ${activePrayers === 1 ? 'request' : 'requests'}`);
  if (eventsSoon > 0) lines.push(`${eventsSoon} ${eventsSoon === 1 ? 'event' : 'events'} in the next 7 days`);

  if (lines.length === 0) return greetingFallback(data, salutation);

  const opener = salutation
    ? `${salutation}\n\nI'm GRACE — your admin assistant for ${churchName}. Here's what needs attention:`
    : `Hi — I'm GRACE, your admin assistant for ${churchName}. Here's what needs attention:`;

  const headline = lines.length === 1
    ? `${lines[0]}.`
    : lines.slice(0, 4).map(l => `• ${l}`).join('\n');

  return {
    id: 'greet',
    role: 'assistant',
    content: `${opener}\n\n${headline}\n\nAsk me anything, or pick a starter on the left.`,
  };
}

/**
 * Restore prior chat messages from localStorage if any. Returns null on missing,
 * empty, or malformed data so the caller can fall back to a fresh greeting.
 *
 * This is now the OFFLINE FALLBACK only — the source of truth is the
 * server (api/grace/_chat.ts GET), which GraceChatContext hydrates from
 * on mount. This still matters for the brief window before that hydrate
 * resolves, and for local dev without the API running.
 */
export function loadStoredMessages(userId?: string): GraceMessage[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(messagesStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as GraceMessage[];
  } catch {
    return null;
  }
}

/**
 * Persist messages to localStorage, trimmed to the most recent N. Storage
 * full or disabled errors are swallowed — chat keeps working in-session.
 */
export function persistMessages(messages: GraceMessage[], userId?: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = messages.length > MESSAGES_PERSIST_LIMIT
    ? messages.slice(-MESSAGES_PERSIST_LIMIT)
    : messages;
  try {
    window.localStorage.setItem(messagesStorageKey(userId), JSON.stringify(trimmed));
  } catch {
    // storage full / disabled — ignore
  }
}
