import type { GraceMessage, GraceData } from './types';
import { CENTRAL_HENDERSON_DEFAULT_SETTINGS } from '../../config/centralHenderson';

export const GRACE_MESSAGES_STORAGE_KEY = 'grace-chat-messages-v1';
export const MESSAGES_PERSIST_LIMIT = 50;

function greetingFallback(data: GraceData, salutation?: string): GraceMessage {
  const churchName = data.churchName || CENTRAL_HENDERSON_DEFAULT_SETTINGS.profile.name;
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
  const churchName = data.churchName || CENTRAL_HENDERSON_DEFAULT_SETTINGS.profile.name;
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
 */
export function loadStoredMessages(): GraceMessage[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GRACE_MESSAGES_STORAGE_KEY);
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
export function persistMessages(messages: GraceMessage[]): void {
  if (typeof window === 'undefined') return;
  const trimmed = messages.length > MESSAGES_PERSIST_LIMIT
    ? messages.slice(-MESSAGES_PERSIST_LIMIT)
    : messages;
  try {
    window.localStorage.setItem(GRACE_MESSAGES_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // storage full / disabled — ignore
  }
}
