import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import type { Person } from '../types';
import { generateAIText, generateAIStreamed } from '../lib/services/ai';
import { parseActions, hydrateAction, isTaskBatchFollowUp, buildTaskCompletionActions, isPastedTaskList, buildAddTaskActionsFromInput, isOverdueTasksQuery, formatOverdueTasksResponse, type PendingAction } from '../lib/grace-actions';
import { useGraceInbox, type InboxMessageInjection } from '../lib/grace-chat/useGraceInbox';
import { buildGreeting, loadStoredMessages, persistMessages } from '../lib/grace-chat/persistence';
import { runActionHandler, type ChatHandlers, type ReplyContext as HandlerReplyContext } from '../lib/grace-chat/handlers';
import type { GraceMessage as ChatMessage, GraceData as ChatData, ActionInstance as ChatActionInstance } from '../lib/grace-chat/types';
import { addBrainEntry, buildBrainContext, deserializeBrainEntries, GRACE_BRAIN_STORAGE_KEY, parseBrainDirective, serializeBrainEntries, type GraceBrainEntry } from '../lib/grace-brain';

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
    persistMessages(messages);
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
  }), [messages, loading, panelOpen, openPanel, closePanel, sendMessage, clearMessages, updateAction, executeAction, dismissAction, replyContext, data.people, suggestions]);

  return <GraceChatContext.Provider value={value}>{children}</GraceChatContext.Provider>;
}

export function useGraceChat() {
  const ctx = useContext(GraceChatContext);
  if (!ctx) throw new Error('useGraceChat must be used inside GraceChatProvider');
  return ctx;
}
