import { useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { validateAction, hydrateAction, type PendingAction } from '../grace-actions';
import type { Person, Task, PrayerRequest } from '../../types';

interface InboxRow {
  id: string;
  person_id: string | null;
  from_email: string;
  subject: string | null;
  preview: string | null;
  parsed_actions: unknown[];
  flag: string | null;
  auto_summary: string | null;
  reply_sent_at: string | null;
}

export interface InboxMessageInjection {
  id: string;
  content: string;
  actions: Array<{ id: string; action: PendingAction }>;
}

/**
 * Polls grace_inbox_messages every 60s for unseen AgentMail rows. For each
 * fresh row, builds a renderable Grace assistant message (with hydrated
 * action cards if any) and hands it to onInject. Marks the rows as seen
 * server-side so they don't re-inject across sessions.
 *
 * Decoupled from GraceChatContext so the chat provider doesn't need to know
 * about Supabase polling internals — it just handles the messages it gets.
 */
export function useGraceInbox(args: {
  people: Person[];
  tasks: Task[];
  prayers: PrayerRequest[];
  onInject: (messages: InboxMessageInjection[]) => void;
}) {
  const { people, tasks, prayers, onInject } = args;
  const seenIdsRef = useRef<Set<string>>(new Set());
  const peopleRef = useRef(people);
  const tasksRef = useRef(tasks);
  const prayersRef = useRef(prayers);
  const onInjectRef = useRef(onInject);

  // Keep refs current so the polling closure always reads the latest data
  // without forcing the interval to reset.
  peopleRef.current = people;
  tasksRef.current = tasks;
  prayersRef.current = prayers;
  onInjectRef.current = onInject;

  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    let cancelled = false;

    const fetchInbox = async () => {
      const { data: rows, error } = await sb
        .from('grace_inbox_messages')
        .select('id, person_id, from_email, subject, preview, parsed_actions, flag, auto_summary, reply_sent_at')
        .is('seen_at', null)
        .order('created_at', { ascending: true })
        .limit(20);
      if (cancelled || error || !rows || rows.length === 0) return;

      const fresh = (rows as InboxRow[]).filter(r => !seenIdsRef.current.has(r.id));
      if (fresh.length === 0) return;

      const injections = fresh.map(row => buildInjection(row, peopleRef.current, tasksRef.current, prayersRef.current));
      onInjectRef.current(injections);
      fresh.forEach(r => seenIdsRef.current.add(r.id));

      const ids = fresh.map(r => r.id);
      void sb.from('grace_inbox_messages').update({ seen_at: new Date().toISOString() }).in('id', ids);
    };

    void fetchInbox();
    const interval = setInterval(fetchInbox, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);
}

function buildInjection(row: InboxRow, people: Person[], tasks: Task[], prayers: PrayerRequest[]): InboxMessageInjection {
  const senderPerson = people.find(p => p.id === row.person_id);
  const senderName = senderPerson
    ? `${senderPerson.firstName} ${senderPerson.lastName}`.trim()
    : row.from_email;
  const subjectLine = row.subject || '(no subject)';

  if (row.flag === 'crisis') {
    return {
      id: `inbox-${row.id}`,
      content: `🚨 Flagged email from ${senderName}: "${subjectLine}"\n\n${row.preview || ''}\n\nThis matches sensitive language — Grace did NOT auto-handle anything. Please respond personally.`,
      actions: [],
    };
  }

  const rawActions = Array.isArray(row.parsed_actions) ? row.parsed_actions : [];
  const validated = rawActions
    .map((raw: unknown) => validateAction(raw))
    .filter((a): a is PendingAction => a !== null)
    .map(a => hydrateAction(a, { people, tasks, prayers }));

  const lines: string[] = [`📧 New email from ${senderName}: "${subjectLine}"`];
  if (row.preview) lines.push('', String(row.preview));
  if (row.auto_summary) lines.push('', `✓ Grace already handled: ${row.auto_summary}`);
  if (row.reply_sent_at) lines.push('✓ Auto-reply sent to sender');
  if (validated.length > 0) {
    lines.push('', `${validated.length} more action${validated.length === 1 ? '' : 's'} need your review:`);
  } else if (!row.auto_summary) {
    lines.push('', '(No actions detected — logged as an interaction.)');
  }

  return {
    id: `inbox-${row.id}`,
    content: lines.join('\n'),
    actions: validated.map((action, i) => ({
      id: `inbox-act-${row.id}-${i}`,
      action,
    })),
  };
}
