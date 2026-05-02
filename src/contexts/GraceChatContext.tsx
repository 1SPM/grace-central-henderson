import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import type { Person, Task, Giving, CalendarEvent, SmallGroup, PrayerRequest, Attendance, Interaction, MemberStatus, EventCategory } from '../types';
import { generateAIText, generateAIStreamed } from '../lib/services/ai';
import { smsService } from '../lib/services/sms';
import { parseActions, hydrateAction, isTaskBatchFollowUp, buildTaskCompletionActions, isPastedTaskList, buildAddTaskActionsFromInput, isOverdueTasksQuery, formatOverdueTasksResponse, type PendingAction } from '../lib/grace-actions';
import { useGraceInbox, type InboxMessageInjection } from '../lib/grace-chat/useGraceInbox';
import { addBrainEntry, buildBrainContext, deserializeBrainEntries, GRACE_BRAIN_STORAGE_KEY, parseBrainDirective, serializeBrainEntries, type GraceBrainEntry } from '../lib/grace-brain';

export type { PendingAction } from '../lib/grace-actions';

export interface ActionInstance {
  id: string;
  action: PendingAction;
  executed?: boolean;
  dismissed?: boolean;
}

export interface GraceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionInstance[];
}

export interface GraceData {
  people: Person[];
  tasks: Task[];
  giving: Giving[];
  events: CalendarEvent[];
  groups: SmallGroup[];
  prayers: PrayerRequest[];
  attendance: Attendance[];
  churchName?: string;
}

export interface GraceHandlers {
  onAddTask?: (task: Omit<Task, 'id' | 'createdAt'>) => void | Promise<void>;
  onAddPrayer?: (prayer: { personId: string; content: string; isPrivate: boolean }) => void | Promise<void>;
  onAddInteraction?: (interaction: Omit<Interaction, 'id' | 'createdAt'>) => void | Promise<void>;
  onAddPerson?: (person: Omit<Person, 'id'>) => void | Promise<void>;
  onAddEvent?: (event: {
    title: string;
    description?: string;
    startDate: string;
    endDate?: string;
    allDay: boolean;
    location?: string;
    category: EventCategory;
  }) => void | Promise<unknown>;
  onToggleTask?: (taskId: string) => void | Promise<unknown>;
  onUpdateTask?: (taskId: string, updates: { title?: string; due_date?: string; priority?: 'low' | 'medium' | 'high' }) => void | Promise<unknown>;
  onDeleteTask?: (taskId: string) => void | Promise<unknown>;
  onDeletePerson?: (personId: string) => void | Promise<unknown>;
  onDeletePrayer?: (prayerId: string) => void | Promise<unknown>;
  onUpdatePersonStatus?: (personId: string, status: MemberStatus) => void | Promise<unknown>;
  onMarkPrayerAnswered?: (prayerId: string, testimony?: string) => void | Promise<unknown>;
}

export interface ReplyContext {
  inbox_message_row_id: string;
  source_inbox_id: string;
  source_message_id: string;
  person_id: string | null;
  sender_label: string;
}

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
}

const GRACE_MESSAGES_STORAGE_KEY = 'grace-chat-messages-v1';
const MESSAGES_PERSIST_LIMIT = 50;

const GRACE_GREETING_FALLBACK: GraceMessage = {
  id: 'greet',
  role: 'assistant',
  content: 'Hi — ask me anything about your church data, or ask me to add, update, or complete CRM work. I’ll make editable action cards before anything is saved.',
};

function buildGreeting(data: GraceData): GraceMessage {
  const { people, tasks, events, prayers, attendance } = data;
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

  if (lines.length === 0) return GRACE_GREETING_FALLBACK;

  const headline = lines.length === 1
    ? `Quick read: ${lines[0]}.`
    : `Quick read:\n• ${lines.slice(0, 4).join('\n• ')}`;

  return {
    id: 'greet',
    role: 'assistant',
    content: `${headline}\n\nAsk me anything, or pick a starter below.`,
  };
}

function loadStoredMessages(): GraceMessage[] | null {
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

const GraceChatContext = createContext<GraceChatContextValue | null>(null);

function buildDataContext(data: GraceData): string {
  const { people, tasks, giving, events, groups, prayers, attendance, churchName } = data;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const recentGiving = giving.filter(g => new Date(g.date) >= thirtyDaysAgo);
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

  const totalGiving = recentGiving.reduce((s, g) => s + g.amount, 0);
  const recentCheckIns = attendance.filter(a => new Date(a.date) >= thirtyDaysAgo).length;

  return `You are Grace, an AI assistant inside a church CRM. Be concise. Bullets for lists. No "Great question!", no padding, no repeating the user back. Don't end every reply with "Want me to show you X?".

Tone: warm, plainspoken. Honor the church's faith without pretending to share it. If asked theology, briefly note you're an AI without belief, then offer something useful. Never preach.

ACTIONS — when the user asks to add or update CRM records, respond with one <action> block per item. The user reviews and confirms before saving. Status enum: visitor|regular|member|leader|inactive. Priority: low|medium|high. Date: YYYY-MM-DD.

Create:
<action>{"type":"add_person","firstName":"X","lastName":"Y","status":"visitor"}</action>
<action>{"type":"add_task","title":"X","personName":"optional","priority":"medium","dueDate":"YYYY-MM-DD"}</action>
<action>{"type":"add_prayer","content":"X","personName":"existing"}</action>
<action>{"type":"add_note","content":"X","personName":"existing"}</action>
<action>{"type":"add_event","title":"X","startDate":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","location":"optional","category":"event"}</action>

Update:
<action>{"type":"mark_task_done","taskTitle":"X","personName":"optional"}</action>
<action>{"type":"update_task","taskTitle":"existing","title":"new title","priority":"low|medium|high","dueDate":"YYYY-MM-DD"}</action>
<action>{"type":"update_person_status","personName":"existing","status":"member"}</action>
<action>{"type":"mark_prayer_answered","personName":"existing","testimony":"optional"}</action>

Delete (destructive — only when user clearly asks to remove/delete):
<action>{"type":"delete_task","taskTitle":"existing"}</action>
<action>{"type":"delete_person","personName":"existing"}</action>
<action>{"type":"delete_prayer","personName":"existing"}</action>

Send (only when user explicitly says email/text/send/message — NOT for "follow up", which is add_task):
<action>{"type":"send_email","personName":"existing","subject":"X","body":"plain-text body, can be multi-line"}</action>
<action>{"type":"send_sms","personName":"existing","message":"short text under 1000 chars"}</action>

If user says "do tasks" / "do them" / "handle these" after seeing a task list, emit mark_task_done blocks for the listed tasks (cap at 10). Don't claim done until they Execute. Never invent names — for prayer/note/update actions, personName must match the People list below.

Church: ${churchName || 'Grace Community Church'} · Today: ${now.toLocaleDateString()}
People: ${people.length} total (${people.filter(p => p.status === 'visitor').length} visitor, ${people.filter(p => p.status === 'regular').length} regular, ${people.filter(p => p.status === 'member').length} member)
Giving last 30d: $${totalGiving.toLocaleString()} from ${recentGiving.length} gifts. Top: ${topDonors.length ? topDonors.slice(0, 5).join('; ') : 'none'}
Check-ins last 30d: ${recentCheckIns}. Inactive members/regulars: ${inactivePeople.slice(0, 8).join(', ') || 'none'}${inactivePeople.length > 8 ? ` +${inactivePeople.length - 8}` : ''}
Upcoming events (7d): ${upcomingEvents.join(' | ') || 'none'}
Upcoming birthdays (7d): ${upcomingBirthdays.join(', ') || 'none'}
Open tasks (${tasks.filter(t => !t.completed).length}): ${openTasks.map(t => t.title).join('; ') || 'none'}
Groups: ${groups.slice(0, 8).map(g => `${g.name} (${g.members?.length ?? 0})`).join(', ') || 'none'}
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

export function GraceChatProvider({ children, onAddTask, onAddPrayer, onAddInteraction, onAddPerson, onAddEvent, onToggleTask, onUpdateTask, onDeleteTask, onDeletePerson, onDeletePrayer, onUpdatePersonStatus, onMarkPrayerAnswered, ...data }: GraceChatProviderProps) {
  const [messages, setMessages] = useState<GraceMessage[]>(() => {
    const stored = loadStoredMessages();
    if (stored) return stored;
    return [buildGreeting(data)];
  });
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);
  const [brainEntries, setBrainEntries] = useState<GraceBrainEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    return deserializeBrainEntries(window.localStorage.getItem(GRACE_BRAIN_STORAGE_KEY));
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(GRACE_BRAIN_STORAGE_KEY, serializeBrainEntries(brainEntries));
  }, [brainEntries]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const trimmed = messages.length > MESSAGES_PERSIST_LIMIT
      ? messages.slice(-MESSAGES_PERSIST_LIMIT)
      : messages;
    try {
      window.localStorage.setItem(GRACE_MESSAGES_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // storage full or disabled — ignore
    }
  }, [messages]);

  // If the only message is the auto-greeting and live data shifts (e.g., a task is added),
  // refresh it so opening the panel still feels current.
  useEffect(() => {
    setMessages(m => {
      if (m.length !== 1 || m[0].id !== 'greet') return m;
      return [buildGreeting(data)];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.tasks.length, data.people.length, data.prayers.length, data.events.length]);

  // Memoize context so we're not rebuilding this on every keystroke
  const dataContext = useMemo(() => buildDataContext(data), [
    data.people, data.tasks, data.giving, data.events,
    data.groups, data.prayers, data.attendance, data.churchName,
  ]);

  const suggestions = useMemo(() => buildSuggestions(data), [
    data.people, data.tasks, data.events, data.prayers, data.giving, data.attendance,
  ]);

  const brainContext = useMemo(() => buildBrainContext(brainEntries), [brainEntries]);

  const openPanel = useCallback((seed?: string) => {
    setPanelOpen(true);
    if (seed && seed.trim()) {
      // Defer to next tick so panel renders before we send
      setTimeout(() => void sendMessage(seed), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  const clearMessages = useCallback(() => {
    setMessages([buildGreeting(data)]);
    setReplyContext(null);
  }, [data]);

  const sendMessage = useCallback(async (query: string) => {
    if (!query.trim()) return;
    const userMsgId = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now() + 1}`;
    setMessages(m => [
      ...m,
      { id: userMsgId, role: 'user', content: query },
      { id: assistantMsgId, role: 'assistant', content: '' },
    ]);
    setLoading(true);

    const memoryToSave = parseBrainDirective(query);
    if (memoryToSave) {
      setBrainEntries(entries => addBrainEntry(entries, memoryToSave));
      setMessages(m => m.map(msg =>
        msg.id === assistantMsgId
          ? { ...msg, content: `Remembered: ${memoryToSave}` }
          : msg
      ));
      setLoading(false);
      return;
    }

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

    const recentHistory = messages
      .filter(m => m.id !== 'greet' && m.content.trim())
      .slice(-6)
      .map(m => `${m.role === 'user' ? 'User' : 'Grace'}: ${m.content}`)
      .join('\n');

    const basePrompt = brainContext
      ? `${dataContext}\n\n${brainContext}`
      : dataContext;

    const prompt = recentHistory
      ? `${basePrompt}\n\nRecent conversation (use to resolve pronouns like "him" / "her" / "that task"):\n${recentHistory}\n\nUser question: ${query}`
      : `${basePrompt}\n\nUser question: ${query}`;

    try {
      let streamed = false;
      await generateAIStreamed({
        prompt,
        maxTokens: 1200,
        onChunk: (chunk) => {
          streamed = true;
          setMessages(m => m.map(msg =>
            msg.id === assistantMsgId ? { ...msg, content: msg.content + chunk } : msg
          ));
        },
      });

      if (!streamed) {
        // Fallback to non-streaming
        const result = await generateAIText({ prompt, maxTokens: 1200 });
        const text = result.success && result.text
          ? result.text
          : result.error || 'Sorry, I couldn\'t answer that. Try rephrasing.';
        setMessages(m => m.map(msg =>
          msg.id === assistantMsgId ? { ...msg, content: text } : msg
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
  }, [dataContext, brainContext, data.people, data.tasks, data.prayers, messages]);

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

    try {
      if (action.type === 'add_person') {
        if (!action.firstName?.trim()) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'A new person needs a first name.' }]);
          return;
        }
        if (onAddPerson) {
          await onAddPerson({
            firstName: action.firstName.trim(),
            lastName: action.lastName?.trim() || '',
            email: action.email?.trim() || '',
            phone: action.phone?.trim() || '',
            status: action.status || 'visitor',
            tags: [],
            smallGroups: [],
          });
        }
      } else if (action.type === 'add_task' && onAddTask) {
        await onAddTask({
          title: action.title || 'Untitled task',
          personId: action.personId,
          priority: action.priority || 'medium',
          dueDate: action.dueDate || new Date(Date.now() + 7 * 86400_000).toISOString().split('T')[0],
          completed: false,
          category: 'follow-up',
        });
      } else if (action.type === 'add_prayer' && onAddPrayer) {
        if (!action.personId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'A prayer request needs a matching person.' }]);
          return;
        }
        await onAddPrayer({
          personId: action.personId,
          content: action.content || '',
          isPrivate: false,
        });
      } else if (action.type === 'add_event' && onAddEvent) {
        if (!action.title?.trim() || !action.startDate) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'An event needs a title and a date.' }]);
          return;
        }
        const allDay = action.allDay ?? !action.startTime;
        const startISO = allDay
          ? action.startDate
          : `${action.startDate}T${action.startTime ?? '09:00'}`;
        const endISO = !allDay && action.endTime
          ? `${action.startDate}T${action.endTime}`
          : undefined;
        await onAddEvent({
          title: action.title.trim(),
          startDate: startISO,
          endDate: endISO,
          allDay,
          location: action.location?.trim() || undefined,
          category: action.category || 'event',
        });
      } else if (action.type === 'add_note' && onAddInteraction) {
        if (!action.personId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'A note needs a matching person.' }]);
          return;
        }
        await onAddInteraction({
          personId: action.personId,
          type: 'note',
          content: action.content || '',
          createdBy: 'Grace',
        });
      } else if (action.type === 'mark_task_done' && onToggleTask) {
        if (!action.taskId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: `I couldn't find an open task matching "${action.taskTitle ?? ''}". Try the exact title.` }]);
          return;
        }
        await onToggleTask(action.taskId);
        const task = data.tasks.find(t => t.id === action.taskId);
        if (task?.personId && onAddInteraction) {
          await onAddInteraction({
            personId: task.personId,
            type: 'note',
            content: `Grace marked task complete: ${task.title}`,
            createdBy: 'Grace',
          });
        }
      } else if (action.type === 'update_person_status' && onUpdatePersonStatus) {
        if (!action.personId || !action.status) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'I need a matching person and a status.' }]);
          return;
        }
        await onUpdatePersonStatus(action.personId, action.status);
        if (onAddInteraction) {
          await onAddInteraction({
            personId: action.personId,
            type: 'note',
            content: `Grace updated status to ${action.status}`,
            createdBy: 'Grace',
          });
        }
      } else if (action.type === 'update_task' && onUpdateTask) {
        if (!action.taskId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: `I couldn't find an open task matching "${action.taskTitle ?? ''}".` }]);
          return;
        }
        const updates: { title?: string; due_date?: string; priority?: 'low' | 'medium' | 'high' } = {};
        if (action.title?.trim()) updates.title = action.title.trim();
        if (action.dueDate) updates.due_date = action.dueDate;
        if (action.priority) updates.priority = action.priority;
        if (Object.keys(updates).length === 0) return;
        await onUpdateTask(action.taskId, updates);
        const task = data.tasks.find(t => t.id === action.taskId);
        if (task?.personId && onAddInteraction) {
          await onAddInteraction({
            personId: task.personId,
            type: 'note',
            content: `Grace updated task: ${task.title}`,
            createdBy: 'Grace',
          });
        }
      } else if (action.type === 'delete_task' && onDeleteTask) {
        if (!action.taskId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: `I couldn't find a task matching "${action.taskTitle ?? ''}".` }]);
          return;
        }
        await onDeleteTask(action.taskId);
      } else if (action.type === 'delete_person' && onDeletePerson) {
        if (!action.personId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: `I couldn't find a matching person.` }]);
          return;
        }
        await onDeletePerson(action.personId);
      } else if (action.type === 'delete_prayer' && onDeletePrayer) {
        if (!action.prayerId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: `I couldn't find an active prayer for that person.` }]);
          return;
        }
        await onDeletePrayer(action.prayerId);
      } else if (action.type === 'send_email') {
        const bodyText = action.body?.trim() || '';
        if (!bodyText) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'Email body is empty.' }]);
          return;
        }

        // If we're in a reply context (pastor opened an inbox row in Grace), thread the
        // response back through AgentMail rather than sending a fresh outbound via Resend.
        if (replyContext) {
          const res = await fetch('/api/agentmail/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inbox_id: replyContext.source_inbox_id,
              message_id: replyContext.source_message_id,
              inbox_message_row_id: replyContext.inbox_message_row_id,
              text: bodyText,
            }),
          });
          const replyData = await res.json().catch(() => ({} as { error?: string }));
          if (!res.ok) {
            setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: `Reply failed: ${replyData.error || `(${res.status})`}` }]);
            return;
          }
          // Server-side already wrote the Interaction + flipped reply_sent_at
          setReplyContext(null);
        } else {
          const person = data.people.find(p => p.id === action.personId);
          if (!person) {
            setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'I need a matching person to send to.' }]);
            return;
          }
          if (!person.email) {
            setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: `${person.firstName} ${person.lastName} doesn't have an email on file.` }]);
            return;
          }
          const subject = action.subject?.trim() || '(no subject)';
          // Route through AgentMail (askgrace@agentmail.to) — same channel as inbound, server-side
          // logs the Interaction itself so we don't double-write here.
          const res = await fetch('/api/agentmail/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ person_id: person.id, subject, text: bodyText }),
          });
          const sendData = await res.json().catch(() => ({} as { error?: string }));
          if (!res.ok) {
            setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: `Email failed: ${sendData.error || `(${res.status})`}` }]);
            return;
          }
        }
      } else if (action.type === 'send_sms') {
        const person = data.people.find(p => p.id === action.personId);
        if (!person) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'I need a matching person to text.' }]);
          return;
        }
        if (!person.phone) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: `${person.firstName} ${person.lastName} doesn't have a phone on file.` }]);
          return;
        }
        const text = action.message?.trim() || '';
        if (!text) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'Text message is empty.' }]);
          return;
        }
        const result = await smsService.send({ to: person.phone, message: text });
        if (!result.success) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: `Text failed: ${result.error || 'unknown error'}` }]);
          return;
        }
        if (onAddInteraction) {
          await onAddInteraction({
            personId: person.id,
            type: 'text',
            content: text,
            createdBy: 'Grace',
            sentVia: 'twilio',
            messageId: result.messageId,
          });
        }
      } else if (action.type === 'mark_prayer_answered' && onMarkPrayerAnswered) {
        if (!action.prayerId) {
          setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'I couldn\'t find an active prayer request for that person.' }]);
          return;
        }
        await onMarkPrayerAnswered(action.prayerId, action.testimony);
        if (action.personId && onAddInteraction) {
          await onAddInteraction({
            personId: action.personId,
            type: 'prayer',
            content: action.testimony
              ? `Grace marked prayer answered: ${action.testimony}`
              : 'Grace marked prayer answered',
            createdBy: 'Grace',
          });
        }
      }
      markActionStatus(messageId, actionId, { executed: true });
    } catch {
      setMessages(m => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: 'Couldn\'t save that — please try again.' }]);
    }
  }, [messages, data.tasks, data.people, replyContext, markActionStatus, onAddPerson, onAddTask, onAddPrayer, onAddInteraction, onAddEvent, onToggleTask, onUpdateTask, onDeleteTask, onDeletePerson, onDeletePrayer, onUpdatePersonStatus, onMarkPrayerAnswered]);

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
  }), [messages, loading, panelOpen, openPanel, closePanel, sendMessage, clearMessages, updateAction, executeAction, dismissAction, replyContext, data.people, suggestions]);

  return <GraceChatContext.Provider value={value}>{children}</GraceChatContext.Provider>;
}

export function useGraceChat() {
  const ctx = useContext(GraceChatContext);
  if (!ctx) throw new Error('useGraceChat must be used inside GraceChatProvider');
  return ctx;
}
