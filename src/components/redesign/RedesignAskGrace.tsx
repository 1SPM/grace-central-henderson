import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import type { GraceData, GPerson } from './useGraceData';
import type { RedesignActions, InteractionType, AttendanceEventType, RedesignEventCategory } from './actions';

interface ActionInstance {
  id: string;
  type: 'add_event' | 'log_interaction' | 'add_prayer' | 'check_in';
  attrs: Record<string, string>;
  status: 'pending' | 'done' | 'skipped' | 'failed';
  error?: string;
}
interface Msg { role: 'user' | 'assistant'; content: string; actions?: ActionInstance[]; }

const SUGGESTIONS: { icon: IconName; title: string; sub: string; prompt: string }[] = [
  { icon: 'calendar', title: 'Schedule an event', sub: 'I can create it for you', prompt: 'Schedule a Sunday Service this Sunday at 10am in the Main Sanctuary.' },
  { icon: 'mail', title: 'Log a note on a member', sub: 'Record an interaction', prompt: "Log a note that I called Cam Deich today about coffee next week." },
  { icon: 'pray', title: 'Add a prayer request', sub: 'For someone in the directory', prompt: 'Add a prayer request for Cam Deich about peace this week.' },
  { icon: 'sparkle', title: 'Summarize this month', sub: 'How are we doing?', prompt: 'Give me a one-paragraph summary of how the church is doing this month.' },
];

/* ============ Action protocol ============ */
/* Find <action ... /> or <action ...></action> blocks in the model's reply. */
function parseActions(text: string): { plain: string; actions: ActionInstance[] } {
  const out: ActionInstance[] = [];
  const tagRe = /<action\s+([^>]*?)(?:\/>|>\s*<\/action>)/g;
  const plain = text.replace(tagRe, (_full, attrsStr) => {
    const attrs: Record<string, string> = {};
    const attrRe = /(\w+)="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrsStr))) attrs[m[1]] = m[2];
    const type = attrs.type as ActionInstance['type'];
    if (!type) return '';
    delete attrs.type;
    out.push({ id: `act-${Date.now()}-${out.length}-${Math.random().toString(36).slice(2, 6)}`, type, attrs, status: 'pending' });
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { plain, actions: out };
}

function resolvePerson(name: string, people: GPerson[]): GPerson | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  return people.find(p => p.name.toLowerCase() === q)
      || people.find(p => p.name.toLowerCase().includes(q))
      || people.find(p => p.firstName.toLowerCase() === q)
      || null;
}

function describeAction(a: ActionInstance): { icon: IconName; line: string } {
  const t = a.attrs;
  if (a.type === 'add_event') {
    const when = t.date ? `${t.date}${t.time ? ' at ' + t.time : ''}` : '(no date)';
    return { icon: 'calendar', line: `Schedule "${t.title || 'event'}" — ${when}${t.location ? ' · ' + t.location : ''}` };
  }
  if (a.type === 'log_interaction') return { icon: 'mail', line: `Log ${t.kind || 'note'} on ${t.person || '?'} — "${(t.content || '').slice(0, 80)}"` };
  if (a.type === 'add_prayer') return { icon: 'pray', line: `Add prayer for ${t.person || '?'} — "${(t.content || '').slice(0, 80)}"` };
  if (a.type === 'check_in') return { icon: 'check', line: `Check in ${t.person || '?'} to ${t.service || 'sunday'} service` };
  return { icon: 'sparkle', line: JSON.stringify(t) };
}

async function runAction(a: ActionInstance, actions: RedesignActions, people: GPerson[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = a.attrs;
  try {
    if (a.type === 'add_event') {
      if (!t.title || !t.date) return { ok: false, error: 'Missing title or date' };
      const startDate = new Date(`${t.date}T${t.time || '09:00'}`).toISOString();
      if (isNaN(Date.parse(startDate))) return { ok: false, error: 'Invalid date/time' };
      await actions.addEvent({ title: t.title, startDate, allDay: false, location: t.location || undefined, category: (t.category as RedesignEventCategory) || 'event' });
      return { ok: true };
    }
    if (a.type === 'log_interaction') {
      const p = resolvePerson(t.person || '', people);
      if (!p) return { ok: false, error: `Person "${t.person}" not found in directory` };
      const kind = (t.kind as InteractionType) || 'note';
      await actions.addInteraction({ personId: p.id, type: kind, content: t.content || '(no content)', createdBy: 'Grace (AI)' });
      return { ok: true };
    }
    if (a.type === 'add_prayer') {
      const p = resolvePerson(t.person || '', people);
      if (!p) return { ok: false, error: `Person "${t.person}" not found in directory` };
      await actions.addPrayer({ personId: p.id, content: t.content || '(no content)', isPrivate: t.private === 'true' });
      return { ok: true };
    }
    if (a.type === 'check_in') {
      const p = resolvePerson(t.person || '', people);
      if (!p) return { ok: false, error: `Person "${t.person}" not found in directory` };
      await actions.checkIn(p.id, (t.service as AttendanceEventType) || 'sunday');
      return { ok: true };
    }
    return { ok: false, error: 'Unknown action type' };
  } catch (e) { return { ok: false, error: (e as Error).message || 'Action failed' }; }
}

/* ============ Component ============ */
export function RedesignAskGrace({ data, actions }: { data: GraceData; actions?: RedesignActions }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, pending]);

  const active = data.people.filter(p => p.status !== 'inactive').length;
  // Compact name list for resolution (cap to keep prompt short)
  const peopleNames = data.people.slice(0, 80).map(p => p.name).join(', ');
  const todayIso = new Date().toISOString().split('T')[0];

  const systemPrompt =
    `You are Grace AI, the in-app assistant for ${data.churchName} on the GRACE Church CRM. ` +
    `Warm but concise; sound like a thoughtful staff member, not a chatbot. ` +
    `Live context: ${data.people.length} people (${active} active, ${data.people.filter(p => p.status === 'visitor').length} visitors), ` +
    `${data.groups.length} small groups, ${data.prayersOpen} open prayer requests. Today is ${todayIso}.\n\n` +
    `=== TOOL USE ===\n` +
    `When the pastor asks you to DO something (create an event, log an interaction, add a prayer, mark someone present), emit a single-line action tag — the user will see a confirm card and approve it before anything saves. Do NOT claim you've done it; say what you'd like to do.\n\n` +
    `Available actions (one per line, self-closing):\n` +
    `<action type="add_event" title="..." date="YYYY-MM-DD" time="HH:MM" location="..." category="service|meeting|event|small-group|class|outreach|other"/>\n` +
    `<action type="log_interaction" person="Full Name" kind="note|call|email|text|visit" content="..."/>\n` +
    `<action type="add_prayer" person="Full Name" content="..." private="false"/>\n` +
    `<action type="check_in" person="Full Name" service="sunday|wednesday|small-group|special"/>\n\n` +
    `Rules:\n` +
    `- Use only these exact full names when emitting actions: ${peopleNames}\n` +
    `- If the user names someone not in that list, ask them to add the person first instead of guessing.\n` +
    `- Resolve relative dates against today's date above (e.g., "this Sunday", "tomorrow").\n` +
    `- Keep narration short; the action card carries the details.\n` +
    `- Replies under ~120 words unless asked for more.`;

  async function ask(text: string) {
    if (!text.trim() || pending) return;
    const next: Msg[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setDraft('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setPending(true);
    try {
      const history = next.map(m => `${m.role === 'user' ? 'Pastor' : 'Grace AI'}: ${m.content}`).join('\n\n');
      const prompt = `${systemPrompt}\n\n--- conversation ---\n${history}\n\n--- end ---\n\nReply as Grace AI to the most recent message. Include any <action .../> tags inline; output only the reply.`;
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, maxTokens: 600 }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'request failed');
      const raw = typeof body.text === 'string' && body.text.trim() ? body.text.trim() : "I'm not sure how to respond — could you rephrase?";
      const { plain, actions: parsed } = parseActions(raw);
      const fallback = plain || (parsed.length ? "Here's what I'd like to do — approve when ready:" : raw);
      setMessages(m => [...m, { role: 'assistant', content: fallback, actions: parsed.length ? parsed : undefined }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: "Sorry, I couldn't reach the model just now. Please try again in a moment." }]);
    } finally {
      setPending(false);
    }
  }

  function updateAction(msgIdx: number, actId: string, patch: Partial<ActionInstance>) {
    setMessages(curr => curr.map((m, i) => i !== msgIdx ? m : { ...m, actions: m.actions?.map(a => a.id === actId ? { ...a, ...patch } : a) }));
  }

  async function confirmAction(msgIdx: number, a: ActionInstance) {
    if (!actions) { updateAction(msgIdx, a.id, { status: 'failed', error: 'Sign in to perform actions.' }); return; }
    updateAction(msgIdx, a.id, { status: 'pending' });
    const r = await runAction(a, actions, data.people);
    if (r.ok) updateAction(msgIdx, a.id, { status: 'done' });
    else updateAction(msgIdx, a.id, { status: 'failed', error: r.error });
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="page" style={{ paddingTop: 14 }}>
      <div className="ai-page">
        <div className="ai-shell">
          <div className="ai-head">
            <div className="ai-avatar"><Icon name="sparkle" size={16} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3>Ask Grace</h3>
              <div className="sub">Online · can act on your church data with your approval</div>
            </div>
            {hasMessages && <button className="btn btn-ghost btn-sm" onClick={() => setMessages([])}><Icon name="plus" size={13} /> New</button>}
          </div>

          <div className="ai-body" ref={scrollRef}>
            {!hasMessages && (
              <>
                <div className="ai-welcome">
                  <div className="ai-greet">How can I help,<br />Pastor?</div>
                  <div className="ai-sub">I can schedule events, log notes, add prayers, and take attendance — with your approval.</div>
                </div>
                <div className="ai-suggestions">
                  {SUGGESTIONS.map(s => (
                    <button key={s.title} className="ai-suggestion" onClick={() => ask(s.prompt)}>
                      <div className="ai-sugg-icon"><Icon name={s.icon} size={12} /></div>
                      <div className="ai-sugg-title">{s.title}</div>
                      <div className="ai-sugg-sub">{s.sub}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
                <div className={`ai-msg ${m.role}`}>
                  <div className="ai-msg-avatar">{m.role === 'assistant' ? <Icon name="sparkle" size={12} /> : 'PT'}</div>
                  <div className="ai-bubble">{m.content}</div>
                </div>
                {m.actions?.map(a => {
                  const { icon, line } = describeAction(a);
                  return (
                    <div key={a.id} className="ai-action-card">
                      <div className="ai-action-icon"><Icon name={icon} size={14} /></div>
                      <div className="ai-action-body">
                        <div className="ai-action-label">{a.type.replace('_', ' ')}</div>
                        <div className="ai-action-line">{line}</div>
                        {a.status === 'failed' && a.error && <div className="ai-action-err">{a.error}</div>}
                      </div>
                      {a.status === 'pending' && (
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn btn-sm" onClick={() => updateAction(i, a.id, { status: 'skipped' })}>Skip</button>
                          <button className="btn btn-sm btn-primary" onClick={() => confirmAction(i, a)}><Icon name="check" size={12} /> Confirm</button>
                        </div>
                      )}
                      {a.status === 'done' && <span className="badge badge-success dot">Done</span>}
                      {a.status === 'skipped' && <span className="badge badge-muted dot">Skipped</span>}
                      {a.status === 'failed' && <button className="btn btn-sm" onClick={() => confirmAction(i, a)}>Retry</button>}
                    </div>
                  );
                })}
              </div>
            ))}
            {pending && (
              <div className="ai-msg assistant">
                <div className="ai-msg-avatar"><Icon name="sparkle" size={12} /></div>
                <div className="ai-bubble" style={{ padding: 0 }}><div className="ai-typing"><span /><span /><span /></div></div>
              </div>
            )}
          </div>

          <div className="ai-input-bar">
            <div className="ai-input-wrap">
              <textarea
                ref={taRef}
                value={draft}
                placeholder="Ask Grace to schedule, log, or pray…"
                rows={1}
                onChange={e => { setDraft(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(draft); } }}
              />
              <button className="ai-send" onClick={() => ask(draft)} disabled={!draft.trim() || pending}><Icon name="arrow_up" size={14} /></button>
            </div>
            <div className="ai-hint">Actions need your confirmation before they save.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
