import { useEffect, useState, useCallback, useMemo } from 'react';
import { Mail, AlertTriangle, CheckCircle2, Clock, Loader2, Inbox, Trash2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validateAction, hydrateAction, type PendingAction } from '../lib/grace-actions';
import { useGraceChat } from '../contexts/GraceChatContext';
import type { Person, Task, PrayerRequest } from '../types';

interface MailRow {
  id: string;
  person_id: string | null;
  from_email: string;
  subject: string | null;
  preview: string | null;
  body_text: string | null;
  parsed_actions: unknown[];
  flag: string | null;
  auto_summary: string | null;
  reply_sent_at: string | null;
  seen_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  source_inbox_id: string | null;
  source_message_id: string;
}

interface MailInboxProps {
  people: Person[];
  tasks: Task[];
  prayers: PrayerRequest[];
}

type FilterKey = 'all' | 'review' | 'auto' | 'crisis';

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function MailInbox({ people, tasks, prayers }: MailInboxProps) {
  const [rows, setRows] = useState<MailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [draftingIds, setDraftingIds] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<Record<string, string>>({});
  const chat = useGraceChat();

  const fetchRows = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('grace_inbox_messages')
      .select('id, person_id, from_email, subject, preview, body_text, parsed_actions, flag, auto_summary, reply_sent_at, seen_at, dismissed_at, created_at, source_inbox_id, source_message_id')
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) setRows(data as unknown as MailRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRows();
    const interval = setInterval(fetchRows, 60_000);
    return () => clearInterval(interval);
  }, [fetchRows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter === 'crisis') return r.flag === 'crisis';
      if (filter === 'auto') return Boolean(r.auto_summary || r.reply_sent_at);
      if (filter === 'review') return !r.flag && !r.auto_summary && !r.reply_sent_at && (r.parsed_actions?.length ?? 0) > 0;
      return true;
    });
  }, [rows, filter]);

  const counts = useMemo(() => ({
    all: rows.length,
    crisis: rows.filter(r => r.flag === 'crisis').length,
    auto: rows.filter(r => r.auto_summary || r.reply_sent_at).length,
    review: rows.filter(r => !r.flag && !r.auto_summary && !r.reply_sent_at && (r.parsed_actions?.length ?? 0) > 0).length,
  }), [rows]);

  const markSeen = useCallback(async (id: string) => {
    if (!supabase) return;
    await supabase.from('grace_inbox_messages').update({ seen_at: new Date().toISOString() }).eq('id', id);
    setRows(prev => prev.map(r => r.id === id ? { ...r, seen_at: new Date().toISOString() } : r));
  }, []);

  const dismiss = useCallback(async (id: string) => {
    if (!supabase) return;
    await supabase.from('grace_inbox_messages').update({ dismissed_at: new Date().toISOString() }).eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
    if (openId === id) setOpenId(null);
  }, [openId]);

  const sendToGrace = useCallback((row: MailRow) => {
    const senderPerson = people.find(p => p.id === row.person_id);
    const senderName = senderPerson ? `${senderPerson.firstName} ${senderPerson.lastName}` : row.from_email;
    if (row.source_inbox_id) {
      chat.setReplyContext({
        inbox_message_row_id: row.id,
        source_inbox_id: row.source_inbox_id,
        source_message_id: row.source_message_id,
        person_id: row.person_id,
        sender_label: senderName,
      });
    }
    void chat.sendMessage(`Draft a reply to ${senderName}'s email: "${row.subject ?? ''}" — ${row.body_text ?? row.preview ?? ''}\n\nUse send_email with body filled — I'll thread it back automatically.`);
    chat.openPanel();
  }, [chat, people]);

  const draftWithGrace = useCallback(async (row: MailRow) => {
    if (draftingIds.has(row.id)) return;
    setDraftingIds(prev => new Set(prev).add(row.id));
    setSendError(prev => ({ ...prev, [row.id]: '' }));

    const callDraft = async () => {
      const r = await fetch('/api/grace/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inbox_message_row_id: row.id }),
      });
      const data = await r.json().catch(() => ({} as { text?: string; error?: string }));
      return { ok: r.ok, status: r.status, ...data } as { ok: boolean; status: number; text?: string; error?: string };
    };

    try {
      let result = await callDraft();
      if (!result.ok || !result.text || result.text.trim().length < 10) {
        console.warn('[draft-grace] first attempt empty/failed, retrying', { error: result.error, len: result.text?.length });
        await new Promise(r => setTimeout(r, 800));
        result = await callDraft();
      }
      if (!result.ok) {
        setSendError(prev => ({ ...prev, [row.id]: result.error || `Draft failed (${result.status})` }));
        return;
      }
      const text = (result.text || '').trim();
      if (!text) {
        setSendError(prev => ({ ...prev, [row.id]: 'Grace returned an empty draft — try again or write it yourself.' }));
        return;
      }
      setReplyDrafts(prev => ({ ...prev, [row.id]: text }));
    } catch (err) {
      console.error('[draft-grace] threw', err);
      setSendError(prev => ({ ...prev, [row.id]: err instanceof Error ? err.message : 'Draft failed' }));
    } finally {
      setDraftingIds(prev => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }, [draftingIds]);

  const sendReply = useCallback(async (row: MailRow) => {
    const text = (replyDrafts[row.id] || '').trim();
    if (!text || !row.source_inbox_id) return;
    setSendingId(row.id);
    setSendError(prev => ({ ...prev, [row.id]: '' }));
    try {
      const res = await fetch('/api/agentmail/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inbox_id: row.source_inbox_id,
          message_id: row.source_message_id,
          inbox_message_row_id: row.id,
          text,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(prev => ({ ...prev, [row.id]: data.error || `Send failed (${res.status})` }));
        return;
      }
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, reply_sent_at: new Date().toISOString() } : r));
      setReplyDrafts(prev => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    } catch (err) {
      setSendError(prev => ({ ...prev, [row.id]: err instanceof Error ? err.message : 'Send failed' }));
    } finally {
      setSendingId(null);
    }
  }, [replyDrafts]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={20} className="text-amber-700 dark:text-amber-400" />
          <h1 className="serif text-3xl text-slate-900 dark:text-dark-100 leading-none">Mail</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-dark-400">Inbound emails to <code className="text-amber-700 dark:text-amber-400">askgrace@agentmail.to</code> — Grace handles what she can, surfaces the rest.</p>
      </header>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {([
          { k: 'all', label: 'All', count: counts.all },
          { k: 'review', label: 'Needs review', count: counts.review },
          { k: 'auto', label: 'Auto-handled', count: counts.auto },
          { k: 'crisis', label: 'Flagged', count: counts.crisis },
        ] as Array<{ k: FilterKey; label: string; count: number }>).map(b => (
          <button
            key={b.k}
            onClick={() => setFilter(b.k)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${filter === b.k
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white/60 dark:bg-dark-800 border-stone-300/70 dark:border-white/10 text-gray-700 dark:text-dark-300 hover:bg-white dark:hover:bg-dark-700'}`}
          >
            {b.label} {b.count > 0 && <span className="ml-1 opacity-70">{b.count}</span>}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-400 py-12 justify-center">
          <Loader2 size={16} className="animate-spin" /> Loading inbox…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 text-sm text-gray-500 dark:text-dark-400 py-16">
          <Inbox size={32} className="text-gray-300 dark:text-dark-600" />
          <span>No emails {filter !== 'all' ? `in ${filter}` : 'yet'}.</span>
          <span className="text-xs">Members who email askgrace@agentmail.to from a known address show up here.</span>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(row => {
          const senderPerson = people.find(p => p.id === row.person_id);
          const senderName = senderPerson ? `${senderPerson.firstName} ${senderPerson.lastName}` : row.from_email;
          const isOpen = openId === row.id;
          const isUnseen = !row.seen_at;
          const validatedActions = (Array.isArray(row.parsed_actions) ? row.parsed_actions : [])
            .map((raw: unknown) => validateAction(raw))
            .filter((a): a is PendingAction => a !== null)
            .map(a => hydrateAction(a, { people, tasks, prayers }));

          const status: { label: string; color: string; icon: React.ReactNode } =
            row.flag === 'crisis'
              ? { label: 'Flagged', color: 'text-rose-700 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200/70 dark:border-rose-500/20', icon: <AlertTriangle size={11} /> }
              : (row.auto_summary || row.reply_sent_at)
                ? { label: 'Auto-handled', color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200/70 dark:border-emerald-500/20', icon: <CheckCircle2 size={11} /> }
                : validatedActions.length > 0
                  ? { label: 'Review', color: 'text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200/70 dark:border-amber-500/20', icon: <Clock size={11} /> }
                  : { label: 'Logged', color: 'text-gray-600 bg-stone-100 dark:bg-dark-800 dark:text-dark-400 border-stone-200/70 dark:border-white/10', icon: <Mail size={11} /> };

          return (
            <div
              key={row.id}
              className={`border rounded-xl overflow-hidden transition-colors ${isUnseen
                ? 'bg-white dark:bg-dark-900 border-stone-300/80 dark:border-white/10'
                : 'bg-white/60 dark:bg-dark-900/40 border-stone-200/60 dark:border-white/5'}`}
            >
              <button
                onClick={() => {
                  const next = isOpen ? null : row.id;
                  setOpenId(next);
                  if (!isOpen && isUnseen) void markSeen(row.id);
                }}
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-stone-50/60 dark:hover:bg-dark-800/40"
              >
                <div className="flex flex-col items-start gap-1 min-w-[120px] shrink-0">
                  <span className={`text-sm ${isUnseen ? 'font-semibold text-slate-900 dark:text-dark-100' : 'text-gray-700 dark:text-dark-300'}`}>
                    {senderName}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-md border ${status.color}`}>
                    {status.icon} {status.label}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${isUnseen ? 'font-medium text-slate-900 dark:text-dark-100' : 'text-gray-700 dark:text-dark-300'}`}>
                    {row.subject || '(no subject)'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-dark-400 truncate">
                    {row.preview || row.body_text?.slice(0, 120) || ''}
                  </div>
                </div>
                <div className="text-xs text-gray-400 dark:text-dark-500 shrink-0">{formatRelativeTime(row.created_at)}</div>
              </button>

              {isOpen && (
                <div className="border-t border-stone-200/70 dark:border-white/5 p-4 space-y-3 bg-stone-50/40 dark:bg-dark-900/30">
                  {row.flag === 'crisis' && (
                    <div className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200/70 dark:border-rose-500/20 text-sm text-rose-800 dark:text-rose-300">
                      🚨 This email matched sensitive language. Grace did NOT auto-handle anything. Please respond personally.
                    </div>
                  )}
                  {row.auto_summary && (
                    <div className="text-xs text-emerald-700 dark:text-emerald-400">✓ Grace handled: {row.auto_summary}</div>
                  )}
                  {row.reply_sent_at && (
                    <div className="text-xs text-emerald-700 dark:text-emerald-400">✓ Auto-reply sent to sender</div>
                  )}
                  {row.body_text && (
                    <pre className="text-sm text-slate-800 dark:text-dark-200 whitespace-pre-wrap font-sans bg-white/60 dark:bg-dark-800/50 border border-stone-200/60 dark:border-white/5 rounded-lg p-3">
{row.body_text}
                    </pre>
                  )}
                  {validatedActions.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-600 dark:text-dark-400">{validatedActions.length} suggested action{validatedActions.length === 1 ? '' : 's'}:</div>
                      {validatedActions.map((action, i) => {
                        const meta = action as PendingAction & { confidence?: number; risk?: string };
                        return (
                          <div key={i} className="text-xs text-slate-700 dark:text-dark-300 px-3 py-2 rounded-lg bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200/70 dark:border-amber-500/20">
                            <span className="font-medium">{action.type.replace(/_/g, ' ')}</span>
                            {action.title && <> — {action.title}</>}
                            {action.content && <> — "{String(action.content).slice(0, 80)}"</>}
                            {typeof meta.confidence === 'number' && <span className="ml-2 opacity-60">conf {meta.confidence.toFixed(2)}</span>}
                            {meta.risk && <span className="ml-2 opacity-60">risk {meta.risk}</span>}
                          </div>
                        );
                      })}
                      <div className="text-[10px] text-gray-500 dark:text-dark-500">Open Ask Grace to execute these — actions appear there as cards.</div>
                    </div>
                  )}
                  {row.source_inbox_id && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-gray-600 dark:text-dark-400">
                          Reply
                          {row.reply_sent_at && <span className="ml-2 text-emerald-700 dark:text-emerald-400">✓ Replied {formatRelativeTime(row.reply_sent_at)} — send another below</span>}
                        </div>
                        <button
                          onClick={() => draftWithGrace(row)}
                          disabled={draftingIds.has(row.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {draftingIds.has(row.id) ? <><Loader2 size={11} className="animate-spin" /> Drafting…</> : <><Sparkles size={11} /> Draft with Grace</>}
                        </button>
                      </div>
                      <textarea
                        value={replyDrafts[row.id] ?? ''}
                        onChange={e => setReplyDrafts(prev => ({ ...prev, [row.id]: e.target.value }))}
                        placeholder={draftingIds.has(row.id)
                          ? '✨ Grace is drafting…'
                          : `Reply to ${senderName}… or click "Draft with Grace"`}
                        rows={5}
                        className={`w-full px-3 py-2 text-sm bg-white dark:bg-dark-800 border rounded-lg outline-none focus:border-amber-400/60 dark:focus:border-amber-400/40 ${draftingIds.has(row.id)
                          ? 'border-amber-300 dark:border-amber-500/30 animate-pulse'
                          : 'border-stone-300 dark:border-dark-700'}`}
                        disabled={sendingId === row.id || draftingIds.has(row.id)}
                      />
                      {sendError[row.id] && (
                        <div className="text-xs text-rose-600 dark:text-rose-400">{sendError[row.id]}</div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => sendReply(row)}
                          disabled={sendingId === row.id || !(replyDrafts[row.id] || '').trim()}
                          className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-950 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors inline-flex items-center gap-1.5"
                        >
                          {sendingId === row.id ? <><Loader2 size={12} className="animate-spin" /> Sending…</> : (row.reply_sent_at ? 'Send again' : 'Send reply')}
                        </button>
                        <button
                          onClick={() => sendToGrace(row)}
                          className="px-3 py-1.5 text-xs text-gray-700 dark:text-dark-300 hover:bg-stone-200/60 dark:hover:bg-dark-800 rounded-md"
                        >
                          Open in Grace
                        </button>
                        <button
                          onClick={() => dismiss(row.id)}
                          className="ml-auto inline-flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 dark:text-dark-400 hover:bg-stone-200/60 dark:hover:bg-dark-800 rounded-md"
                        >
                          <Trash2 size={12} /> Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
