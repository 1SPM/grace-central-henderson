import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react';
import type { Person } from '../types';
import { sendGraceTurn, hydrateGraceConversation, importBrainEntries } from '../lib/services/graceChat';
import { buildChatActionPrompt } from '../../api/_lib/actionCatalog';
import { parseActions, hydrateAction, isTaskBatchFollowUp, buildTaskCompletionActions, isPastedTaskList, buildAddTaskActionsFromInput, isOverdueTasksQuery, formatOverdueTasksResponse, type PendingAction } from '../lib/grace-actions';
import { useGraceInbox, type InboxMessageInjection } from '../lib/grace-chat/useGraceInbox';
import { useGraceOpsAggregates } from '../lib/grace-chat/useGraceOpsAggregates';
import { buildGreeting, loadStoredMessages, persistMessages, pickReturnGreeting, GRACE_PANEL_SESSION_KEY } from '../lib/grace-chat/persistence';
import { runActionHandler, type ChatHandlers, type ReplyContext as HandlerReplyContext } from '../lib/grace-chat/handlers';
import type { GraceMessage as ChatMessage, GraceData as ChatData, ActionInstance as ChatActionInstance } from '../lib/grace-chat/types';
import { deserializeBrainEntries, GRACE_BRAIN_STORAGE_KEY } from '../lib/grace-brain';
import { getChurchHour, resolveGraceSalutation } from '../lib/greeting';
import { useChurchClock } from '../hooks/useChurchClock';
import { useAISettings } from '../hooks/useAISettings';
import { TENANT_DEFAULT_SETTINGS, TENANT_TIMEZONE } from '../config/tenant';
import { buildAdminPersonaHeader } from '../lib/grace-chat/adminPersona';
import { GRACE_ADMIN_QUICK_TAGS, mergeQuickTags, MONDAY_BRIEF_PROMPT, type GraceQuickTag } from '../lib/grace-chat/adminQuickTags';
import { computeGroupCommunityStats, getDemoCommunityDataForCRM } from '../lib/services/community';

/**
 * Map any backend/transport failure to a graceful assistant reply.
 * Raw error strings ("Not found", "401", HTML error bodies) must never
 * render as if Grace said them (see UX review 2026-07-06, P0-1).
 */
function friendlyAIFailure(error?: string): string {
  const e = (error || '').toLowerCase();
  if (e.includes('401') || e.includes('unauthorized') || e.includes('session')) {
    return "I couldn't verify your session just now. Everything on your dashboard still works — try signing out and back in, or ask me again in a moment.";
  }
  return "I couldn't reach my knowledge service just now. While I reconnect, the starters on the left — Overdue tasks, New visitors, Needs care — work offline, or try me again in a moment.";
}

export type { PendingAction } from '../lib/grace-actions';
export type ActionInstance = ChatActionInstance;
export type GraceMessage = ChatMessage;
export type GraceData = ChatData;

export type GraceHandlers = ChatHandlers;

export type ReplyContext = HandlerReplyContext;

interface GraceChatContextValue {
  messages: GraceMessage[];
  loading: boolean;
  panelOpen: boolean;
  openPanel: (seed?: string) => void;
  closePanel: () => void;
  sendMessage: (query: string) => Promise<void>;
  clearMessages: () => void;
  updateAction: (messageId: string, actionId: string, patch: Partial<PendingAction>) => void;
  executeAction: (messageId: string, actionId: string) => Promise<void>;
  dismissAction: (messageId: string, actionId: string) => void;
  setReplyContext: (ctx: ReplyContext | null) => void;
  replyContext: ReplyContext | null;
  people: Person[];
  suggestions: string[];
  quickTags: GraceQuickTag[];
  salutation: string;
}

const GraceChatContext = createContext<GraceChatContextValue | null>(null);

function buildDataContext(data: GraceData, voiceMode?: boolean): string {
  const { people, tasks, giving, events, groups, prayers, attendance, churchName, churchProfile, graceFacts, userFirstName, userRole } = data;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  // Calendar month-to-date, matching the Dashboard's "Impact MTD" tile
  // (src/lib/dashboardSummary.ts) — kept separate from the rolling 30-day
  // window below so Grace can answer "this month" questions with a figure
  // that actually agrees with what the user sees on the Dashboard, instead
  // of silently substituting the 30-day number for it.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const recentGiving = giving.filter(g => new Date(g.date) >= thirtyDaysAgo);
  const mtdGiving = giving.filter(g => new Date(g.date) >= monthStart);
  const totalsByPerson = new Map<string, number>();
  for (const g of recentGiving) {
    if (g.personId) totalsByPerson.set(g.personId, (totalsByPerson.get(g.personId) ?? 0) + g.amount);
  }
  const topDonors = [...totalsByPerson.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([pid, amt]) => {
      const p = people.find(x => x.id === pid);
      return p ? `${p.firstName} ${p.lastName}: $${amt.toLocaleString()}` : null;
    })
    .filter(Boolean);

  const attendedRecently = new Set(
    attendance.filter(a => new Date(a.date) >= thirtyDaysAgo).map(a => a.personId)
  );
  const inactivePeople = people
    .filter(p => p.status === 'member' || p.status === 'regular')
    .filter(p => !attendedRecently.has(p.id))
    .slice(0, 15)
    .map(p => `${p.firstName} ${p.lastName}`);

  const upcomingEvents = events
    .filter(e => new Date(e.startDate) >= now && new Date(e.startDate) <= sevenDaysFromNow)
    .slice(0, 10)
    .map(e => `${e.title} — ${new Date(e.startDate).toLocaleDateString()}`);

  const upcomingBirthdays = people
    .filter(p => {
      if (!p.birthDate) return false;
      const bd = new Date(p.birthDate);
      const thisYear = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
      return thisYear >= now && thisYear <= sevenDaysFromNow;
    })
    .map(p => `${p.firstName} ${p.lastName} (${new Date(p.birthDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`);

  const openTasks = tasks.filter(t => !t.completed).slice(0, 15);
  const activePrayers = prayers.filter(p => !p.isAnswered).slice(0, 10);

  const { posts: communityPosts, connections: communityConnections } = getDemoCommunityDataForCRM();
  const groupActivityLines = groups.slice(0, 8).map(g => {
    const stats = computeGroupCommunityStats(g, people, communityPosts, [], communityConnections);
    const inactive = stats.inactiveMembers.length;
    return `${g.name} (${g.members?.length ?? 0} members, ${stats.posts7d} posts this week${inactive ? `, ${inactive} inactive` : ''})`;
  });

  const totalGiving = recentGiving.reduce((s, g) => s + g.amount, 0);
  const mtdTotal = mtdGiving.reduce((s, g) => s + g.amount, 0);
  const recentCheckIns = attendance.filter(a => new Date(a.date) >= thirtyDaysAgo).length;

  const resolvedChurch = churchName || TENANT_DEFAULT_SETTINGS.profile.name;
  const profileLines: string[] = [];
  if (churchProfile) {
    const p = churchProfile;
    if (p.address || p.city) {
      profileLines.push(`Address: ${[p.address, p.city, p.state, p.zip].filter(Boolean).join(', ')}`);
    }
    if (p.phone) profileLines.push(`Phone: ${p.phone}`);
    if (p.email) profileLines.push(`Email: ${p.email}`);
    if (p.website) profileLines.push(`Website: ${p.website}`);
    if (p.serviceTimes?.length) {
      profileLines.push(`Service times: ${p.serviceTimes.map(st => `${st.day} ${st.time}${st.name ? ` (${st.name})` : ''}`).join('; ')}`);
    }
  }
  const profileBlock = profileLines.length
    ? `\n== CHURCH PROFILE ==\n${profileLines.join('\n')}`
    : '';
  const factsBlock = graceFacts?.trim()
    ? `\n== CHURCH FACTS (cite these for location, service times, ministries, policies) ==\n${graceFacts.trim()}`
    : '';

  const personaHeader = buildAdminPersonaHeader({
    churchName: resolvedChurch,
    operatorFirstName: userFirstName,
    userRole,
    profileBlock,
    factsBlock,
    voiceMode,
  });

  return `${personaHeader}

TONE EXAMPLES — match the moment; don't sound the same every reply:
- Celebratory (first gift, baptism, a goal hit): "That's a big one — first gift from the Riveras. Logged it."
- Soft (grief, crisis, hard pastoral moment): "I'm sorry. I've added the prayer request and a task to check on her Friday."
- Efficient (routine confirm, quick lookup): "Done — task closed." / "Three: Bennett, Cruz, Tran."
- Warm (faith or "why" questions): answer plainly, no sermon, no cold "I'm just an AI" wall.
- Practical (numbers, reports): lead with the number. "$4,200 from 18 gifts last month. Top: the Bennetts at $900."
Vary your closers. Most replies need no follow-up question at all.

ACTIONS — when the user asks to add or update CRM records, respond with one <action> block per item. The user reviews and confirms before saving. Status enum: visitor|regular|member|leader|inactive. Priority: low|medium|high. Date: YYYY-MM-DD.

${buildChatActionPrompt()}

If user says "do tasks" / "do them" / "handle these" after seeing a task list, emit mark_task_done blocks for the listed tasks (cap at 10). Don't claim done until they Execute. Never invent names — for prayer/note/update actions, personName must match the People list below.

Church: ${resolvedChurch} · Today: ${now.toLocaleDateString()}
People: ${people.length} total (${people.filter(p => p.status === 'visitor').length} visitor, ${people.filter(p => p.status === 'regular').length} regular, ${people.filter(p => p.status === 'member').length} member)
Giving this month (MTD, matches the Dashboard Impact MTD tile): $${mtdTotal.toLocaleString()} from ${mtdGiving.length} gifts
Giving last 30d (rolling window, NOT the same as "this month" — use MTD above for month-scoped questions): $${totalGiving.toLocaleString()} from ${recentGiving.length} gifts. Top: ${topDonors.length ? topDonors.slice(0, 5).join('; ') : 'none'}
Check-ins last 30d: ${recentCheckIns}. Inactive members/regulars: ${inactivePeople.slice(0, 8).join(', ') || 'none'}${inactivePeople.length > 8 ? ` +${inactivePeople.length - 8}` : ''}
Upcoming events (7d): ${upcomingEvents.join(' | ') || 'none'}
Upcoming birthdays (7d): ${upcomingBirthdays.join(', ') || 'none'}
Open tasks (${tasks.filter(t => !t.completed).length}): ${openTasks.map(t => t.title).join('; ') || 'none'}
Groups: ${groupActivityLines.join(', ') || 'none'}
Active prayers (${prayers.filter(p => !p.isAnswered).length}): ${activePrayers.slice(0, 6).map(p => p.content.slice(0, 50)).join(' | ') || 'none'}`;
}

function buildSuggestions(data: GraceData): string[] {
  const { people, tasks, events, prayers, giving, attendance } = data;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000);

  const overdue = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr).length;
  const newVisitors = people.filter(p => p.status === 'visitor' && p.firstVisit && new Date(p.firstVisit) >= sevenDaysAgo).length;
  const activePrayers = prayers.filter(p => !p.isAnswered).length;
  const birthdaysSoon = people.filter(p => {
    if (!p.birthDate) return false;
    const bd = new Date(p.birthDate);
    const thisYear = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
    return thisYear >= now && thisYear <= sevenDaysFromNow;
  }).length;
  const eventsSoon = events.filter(e => new Date(e.startDate) >= now && new Date(e.startDate) <= sevenDaysFromNow).length;
  const recentGiving = giving.filter(g => new Date(g.date) >= thirtyDaysAgo).length;
  const attendedRecently = new Set(
    attendance.filter(a => new Date(a.date) >= thirtyDaysAgo).map(a => a.personId),
  );
  const inactive = people.filter(p => (p.status === 'member' || p.status === 'regular') && !attendedRecently.has(p.id)).length;

  const candidates: Array<{ score: number; text: string }> = [];
  if (overdue > 0) candidates.push({ score: 100, text: `What tasks are overdue?` });
  if (newVisitors > 0) candidates.push({ score: 90, text: `Who visited this week?` });
  if (inactive > 0) candidates.push({ score: 80, text: `Who hasn't attended in 30 days?` });
  if (activePrayers > 0) candidates.push({ score: 70, text: `Show me active prayer requests` });
  if (birthdaysSoon > 0) candidates.push({ score: 60, text: `Whose birthday is this week?` });
  if (eventsSoon > 0) candidates.push({ score: 50, text: `What events are coming up?` });
  if (recentGiving > 0) candidates.push({ score: 40, text: `Who gave the most last month?` });

  // Always-available fallbacks so we always have at least 4
  candidates.push({ score: 10, text: `Add a new visitor` });
  candidates.push({ score: 5, text: `Remind me to follow up tomorrow` });

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(c => c.text);
}

interface GraceChatProviderProps extends GraceData, GraceHandlers {
  children: ReactNode;
}

function computeSalutation(data: GraceData, hour24: number): string {
  return resolveGraceSalutation(hour24, data.userFirstName, data.userRole);
}

export function GraceChatProvider({ children, onAddTask, onAddPrayer, onAddInteraction, onAddPerson, onAddEvent, onToggleTask, onUpdateTask, onDeleteTask, onDeletePerson, onDeletePrayer, onUpdatePersonStatus, onMarkPrayerAnswered, ...data }: GraceChatProviderProps) {
  const tz = data.churchTimezone || TENANT_TIMEZONE;
  const { zoned } = useChurchClock(tz);
  const salutation = useMemo(
    () => computeSalutation(data, zoned.hour24),
    [zoned.hour24, data.userFirstName, data.userRole],
  );

  const [messages, setMessages] = useState<GraceMessage[]>(() => {
    const stored = loadStoredMessages(data.userId);
    if (stored) return stored;
    return [buildGreeting(data, computeSalutation(data, getChurchHour(data.churchTimezone || TENANT_TIMEZONE)))];
  });
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);
  // Server conversation id (ADR-014) — undefined until the first turn or
  // the hydration effect below resolves; cleared by clearMessages to
  // start a fresh server conversation.
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  // Keyed by the userId it hydrated/imported for (not a bare boolean) so a
  // genuine identity change without a full remount — e.g. sign-out then
  // sign-in as a different staff member in the same tab — re-runs both
  // effects instead of silently skipping them for the new user.
  const hydratedForUserRef = useRef<string | null>(null);
  const importedBrainForUserRef = useRef<string | null>(null);
  // Set the instant a real send starts. Guards the hydration effect below:
  // hydration is an async GET fired on mount, and if the user sends a
  // message (e.g. clicking a starter chip, which auto-sends) before that
  // GET resolves, applying the hydrated snapshot afterward would silently
  // wipe the message they just sent back out of view.
  const hasSentRef = useRef(false);

  useEffect(() => {
    persistMessages(messages, data.userId);
  }, [messages, data.userId]);

  // Cross-session recall (ADR-014): on mount, load the caller's most
  // recent server conversation and use it as the transcript instead of
  // the localStorage fallback — this is the actual "close the browser,
  // come back tomorrow" proof. Runs once per userId.
  useEffect(() => {
    if (!data.userId || hydratedForUserRef.current === data.userId) return;
    hydratedForUserRef.current = data.userId;
    let cancelled = false;
    void hydrateGraceConversation().then(result => {
      if (cancelled || result.messages.length === 0 || hasSentRef.current) return;
      setConversationId(result.conversationId ?? undefined);
      setMessages(result.messages.map(m => {
        // Historical assistant replies may contain raw <action> blocks —
        // parseActions strips them to plain text. Deliberately NOT
        // re-attaching the parsed action cards: whether the user already
        // executed them before closing the browser isn't persisted, and
        // offering a stale, possibly-already-run action back up would risk
        // a duplicate CRM write, not just a display glitch.
        const { cleanText } = parseActions(m.content);
        return { id: m.id, role: m.role, content: cleanText };
      }));
    });
    return () => { cancelled = true; };
  }, [data.userId]);

  // One-time migration: the pre-server-memory "remember that…" entries
  // lived only in localStorage (src/lib/grace-brain.ts). Carry them into
  // server memory once so demo continuity isn't lost — the API only
  // accepts this when the user has zero server memories, so it's safe to
  // call unconditionally here.
  useEffect(() => {
    if (!data.userId || importedBrainForUserRef.current === data.userId || typeof window === 'undefined') return;
    const stored = deserializeBrainEntries(window.localStorage.getItem(GRACE_BRAIN_STORAGE_KEY));
    if (stored.length === 0) return;
    importedBrainForUserRef.current = data.userId;
    void importBrainEntries(stored.map(e => e.text)).then(result => {
      if (result && result.imported > 0) {
        window.localStorage.setItem(GRACE_BRAIN_STORAGE_KEY, '[]');
      }
    });
  }, [data.userId]);

  // If the only message is the auto-greeting and live data shifts (e.g., a task is added),
  // refresh it so opening the panel still feels current.
  useEffect(() => {
    setMessages(m => {
      if (m.length !== 1 || m[0].id !== 'greet') return m;
      return [buildGreeting(data, salutation)];
    });
     
  }, [data.tasks.length, data.people.length, data.prayers.length, data.events.length, salutation]);

  // Portal engagement + Impact Card aggregates (Phase D) — lets admins
  // ask GRACE about member-portal activity and the card program.
  const opsContext = useGraceOpsAggregates(data.churchId);

  // Voice read-back preference shapes prompt guidance (flowing sentences
  // over bullet stacks when replies will be spoken aloud).
  const { settings: aiSettings } = useAISettings();
  const voiceMode = aiSettings.voiceReadback;

  // Memoize context so we're not rebuilding this on every keystroke.
  // Depend on the specific fields we read so re-computation tracks the
  // actual inputs, not every new wrapper object identity.
  const dataContext = useMemo(() => {
    const base = buildDataContext(data, voiceMode);
    return opsContext ? `${base}\n${opsContext}` : base;
  }, [
    data.people, data.tasks, data.giving, data.events,
    data.groups, data.prayers, data.attendance, data.churchName,
    data.churchProfile, data.graceFacts, data.userFirstName, data.userRole, data.churchTimezone,
    opsContext, voiceMode,
  ]);

   
  const suggestions = useMemo(() => buildSuggestions(data), [
    data.people, data.tasks, data.events, data.prayers, data.giving, data.attendance,
  ]);

  const quickTags = useMemo(
    () => mergeQuickTags(GRACE_ADMIN_QUICK_TAGS, suggestions),
    [suggestions],
  );

  const openPanel = useCallback((seed?: string) => {
    setPanelOpen(true);
    if (seed && seed.trim()) {
      // Defer to next tick so panel renders before we send
      setTimeout(() => void sendMessage(seed), 0);
      return;
    }
    // Bare launch (no starter prompt) — the full greeting already covers
    // "first time"; a live assistant doesn't repeat the whole spiel every
    // time you glance back over, so re-opens this session get a short
    // acknowledgment instead. Session-scoped (sessionStorage), not
    // forever (chat history itself persists in localStorage across days).
    if (typeof window !== 'undefined') {
      if (window.sessionStorage.getItem(GRACE_PANEL_SESSION_KEY)) {
        setMessages(m => [...m, pickReturnGreeting()]);
      } else {
        window.sessionStorage.setItem(GRACE_PANEL_SESSION_KEY, '1');
      }
    }
  }, []);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  const clearMessages = useCallback(() => {
    setMessages([buildGreeting(data, salutation)]);
    setReplyContext(null);
    // Starting a fresh transcript starts a fresh server conversation too —
    // otherwise the next turn would silently append to the old thread.
    setConversationId(undefined);
  }, [data, salutation]);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim()) return;
    hasSentRef.current = true;
    const userMsgId = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now() + 1}`;
    const isBrief = query.trim() === MONDAY_BRIEF_PROMPT.trim();
    setMessages(m => [
      ...m,
      { id: userMsgId, role: 'user', content: query },
      { id: assistantMsgId, role: 'assistant', content: '', ...(isBrief ? { source: 'brief' as const } : {}) },
    ]);
    setLoading(true);

    // "remember that…" is now handled server-side (api/grace/_chat.ts) so
    // it's written with provenance to grace_memories instead of
    // localStorage — this client short-circuit list keeps only the
    // detections that stay purely local (no persistence involved).
    if (isOverdueTasksQuery(query)) {
      setMessages(m => m.map(msg =>
        msg.id === assistantMsgId
          ? { ...msg, content: formatOverdueTasksResponse(data.tasks) }
          : msg
      ));
      setLoading(false);
      return;
    }

    if (isTaskBatchFollowUp(query)) {
      const actions = buildTaskCompletionActions(data.tasks);
      const assistantUpdate: GraceMessage = actions.length > 0
        ? {
            id: assistantMsgId,
            role: 'assistant',
            content: actions.length === 10 && data.tasks.filter(t => !t.completed).length > 10
              ? 'I prepared the first 10 open tasks for review. Click Execute on each card when you’re ready.'
              : `I prepared ${actions.length} open ${actions.length === 1 ? 'task' : 'tasks'} for review. Click Execute on each card when you’re ready.`,
            actions: actions.map((action, i) => ({ id: `act-${Date.now()}-${i}`, action })),
          }
        : {
            id: assistantMsgId,
            role: 'assistant',
            content: 'There are no open tasks to complete right now.',
          };
      setMessages(m => m.map(msg => msg.id === assistantMsgId ? assistantUpdate : msg));
      setLoading(false);
      return;
    }

    if (isPastedTaskList(query)) {
      const actions = buildAddTaskActionsFromInput(query);
      const assistantUpdate: GraceMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: actions.length === 20
          ? 'I prepared the first 20 pasted tasks for review. Edit anything you want, then click Execute on each card when you’re ready.'
          : `I prepared ${actions.length} pasted ${actions.length === 1 ? 'task' : 'tasks'} for review. Edit anything you want, then click Execute on each card when you’re ready.`,
        actions: actions.map((action, i) => ({ id: `act-${Date.now()}-${i}`, action })),
      };
      setMessages(m => m.map(msg => msg.id === assistantMsgId ? assistantUpdate : msg));
      setLoading(false);
      return;
    }

    try {
      // Server composes memory + conversation history and persists both
      // sides of the turn (ADR-014) — the client sends only the church-data
      // context it already had assembled plus the current conversation id.
      const turnResult = await sendGraceTurn({
        message: query,
        conversationId,
        dataContext,
        onChunk: (chunk) => {
          setMessages(m => m.map(msg =>
            msg.id === assistantMsgId ? { ...msg, content: msg.content + chunk } : msg
          ));
        },
      });

      if (turnResult.conversationId && turnResult.conversationId !== conversationId) {
        setConversationId(turnResult.conversationId);
      }

      if (turnResult.error) {
        // Never surface raw API/transport errors (e.g. "Not found", "401") as
        // if Grace said them — always reply with a graceful, actionable line.
        setMessages(m => m.map(msg =>
          msg.id === assistantMsgId ? { ...msg, content: friendlyAIFailure(turnResult.error) } : msg
        ));
      } else if (!turnResult.streamed) {
        setMessages(m => m.map(msg =>
          msg.id === assistantMsgId ? { ...msg, content: friendlyAIFailure() } : msg
        ));
      }

      // After stream completes, parse actions from the finalized text
      setMessages(m => m.map(msg => {
        if (msg.id !== assistantMsgId) return msg;
        const { cleanText, actions } = parseActions(msg.content);
        if (actions.length === 0) return msg;
        const hydrated: ActionInstance[] = actions.map((a, i) => ({
          id: `act-${Date.now()}-${i}`,
          action: hydrateAction(a, { people: data.people, tasks: data.tasks, prayers: data.prayers }),
        }));
        return { ...msg, content: cleanText, actions: hydrated };
      }));
    } catch {
      setMessages(m => m.map(msg =>
        msg.id === assistantMsgId
          ? { ...msg, content: 'Something went wrong. Try again.' }
          : msg
      ));
    } finally {
      setLoading(false);
    }
  }, [dataContext, conversationId, data.people, data.tasks, data.prayers]);

  const updateAction = useCallback((messageId: string, actionId: string, patch: Partial<PendingAction>) => {
    setMessages(m => m.map(msg =>
      msg.id === messageId && msg.actions
        ? { ...msg, actions: msg.actions.map(a => a.id === actionId ? { ...a, action: { ...a.action, ...patch } } : a) }
        : msg
    ));
  }, []);

  const markActionStatus = useCallback((messageId: string, actionId: string, patch: Partial<ActionInstance>) => {
    setMessages(m => m.map(msg =>
      msg.id === messageId && msg.actions
        ? { ...msg, actions: msg.actions.map(a => a.id === actionId ? { ...a, ...patch } : a) }
        : msg
    ));
  }, []);

  const executeAction = useCallback(async (messageId: string, actionId: string) => {
    const msg = messages.find(m => m.id === messageId);
    const instance = msg?.actions?.find(a => a.id === actionId);
    const action = instance?.action;
    if (!action) return;

    const pushAssistantMessage = (content: string) => {
      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content }]);
    };

    try {
      const ran = await runActionHandler({
        action,
        people: data.people,
        tasks: data.tasks,
        prayers: data.prayers,
        handlers: { onAddTask, onAddPrayer, onAddInteraction, onAddPerson, onAddEvent, onToggleTask, onUpdateTask, onDeleteTask, onDeletePerson, onDeletePrayer, onUpdatePersonStatus, onMarkPrayerAnswered },
        replyContext,
        setReplyContext,
        pushAssistantMessage,
      });
      if (ran) markActionStatus(messageId, actionId, { executed: true });
    } catch {
      pushAssistantMessage('Couldn\'t save that — please try again.');
    }
  }, [messages, data.tasks, data.people, data.prayers, replyContext, markActionStatus, onAddPerson, onAddTask, onAddPrayer, onAddInteraction, onAddEvent, onToggleTask, onUpdateTask, onDeleteTask, onDeletePerson, onDeletePrayer, onUpdatePersonStatus, onMarkPrayerAnswered]);


  const dismissAction = useCallback((messageId: string, actionId: string) => {
    markActionStatus(messageId, actionId, { dismissed: true });
  }, [markActionStatus]);

  // ⌘/ keyboard shortcut to toggle panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setPanelOpen(o => !o);
      }
      if (e.key === 'Escape') {
        setPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useGraceInbox({
    people: data.people,
    tasks: data.tasks,
    prayers: data.prayers,
    onInject: (injections: InboxMessageInjection[]) => {
      setMessages(prev => [
        ...prev,
        ...injections.map(inj => ({
          id: inj.id,
          role: 'assistant' as const,
          content: inj.content,
          actions: inj.actions,
        })),
      ]);
    },
  });

  const value = useMemo<GraceChatContextValue>(() => ({
    messages,
    loading,
    panelOpen,
    openPanel,
    closePanel,
    sendMessage,
    clearMessages,
    updateAction,
    executeAction,
    dismissAction,
    setReplyContext,
    replyContext,
    people: data.people,
    suggestions,
    quickTags,
    salutation,
  }), [messages, loading, panelOpen, openPanel, closePanel, sendMessage, clearMessages, updateAction, executeAction, dismissAction, replyContext, data.people, suggestions, quickTags, salutation]);

  return <GraceChatContext.Provider value={value}>{children}</GraceChatContext.Provider>;
}

export function useGraceChat() {
  const ctx = useContext(GraceChatContext);
  if (!ctx) throw new Error('useGraceChat must be used inside GraceChatProvider');
  return ctx;
}
