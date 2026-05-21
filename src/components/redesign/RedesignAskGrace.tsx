import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import type { GraceData } from './useGraceData';

interface Msg { role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS: { icon: IconName; title: string; sub: string; prompt: string }[] = [
  { icon: 'users', title: 'Who needs follow-up?', sub: 'Members gone quiet', prompt: 'Which members likely need pastoral follow-up this week, and how should I reach out?' },
  { icon: 'mail', title: 'Draft a welcome email', sub: 'For first-time visitors', prompt: 'Draft a warm, brief welcome email to first-time visitors who attended last Sunday.' },
  { icon: 'sparkle', title: 'Summarize this month', sub: 'How are we doing?', prompt: 'Give me a one-paragraph summary of how the church is doing this month.' },
  { icon: 'pray', title: 'Write a prayer', sub: 'For Bible study', prompt: "Write a short opening prayer (4-6 sentences) for tonight's Wednesday Bible Study." },
];

export function RedesignAskGrace({ data }: { data: GraceData }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages.length, pending]);

  const active = data.people.filter(p => p.status !== 'inactive').length;
  const systemPrompt =
    `You are Grace AI, the in-app assistant for ${data.churchName} on the GRACE Church CRM. ` +
    `Warm but concise; sound like a thoughtful staff member, not a chatbot. Use short paragraphs and bullets when listing. ` +
    `Don't invent specific member names you weren't given. ` +
    `Live church context: ${data.people.length} people (${active} active, ${data.people.filter(p => p.status === 'visitor').length} visitors, ${data.people.filter(p => p.status === 'inactive').length} inactive), ` +
    `${data.groups.length} small groups, ${data.prayersOpen} open prayer requests. ` +
    `Keep replies under ~150 words unless asked for more.`;

  async function ask(text: string) {
    if (!text.trim() || pending) return;
    const next: Msg[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setDraft('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setPending(true);
    try {
      const history = next.map(m => `${m.role === 'user' ? 'Pastor' : 'Grace AI'}: ${m.content}`).join('\n\n');
      const prompt = `${systemPrompt}\n\n--- conversation so far ---\n${history}\n\n--- end ---\n\nReply as Grace AI to the most recent message. Output only the reply.`;
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, maxTokens: 600 }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'request failed');
      const reply = typeof body.text === 'string' && body.text.trim() ? body.text.trim() : "I'm not sure how to respond — could you rephrase?";
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: "Sorry, I couldn't reach the model just now. Please try again in a moment." }]);
    } finally {
      setPending(false);
    }
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
              <div className="sub">Online · grounded in your church data</div>
            </div>
            {hasMessages && <button className="btn btn-ghost btn-sm" onClick={() => setMessages([])}><Icon name="plus" size={13} /> New</button>}
          </div>

          <div className="ai-body" ref={scrollRef}>
            {!hasMessages && (
              <>
                <div className="ai-welcome">
                  <div className="ai-greet">How can I help,<br />Pastor?</div>
                  <div className="ai-sub">Ask about your people, draft a message, or think through the week.</div>
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
              <div key={i} className={`ai-msg ${m.role}`}>
                <div className="ai-msg-avatar">{m.role === 'assistant' ? <Icon name="sparkle" size={12} /> : 'PT'}</div>
                <div className="ai-bubble">{m.content}</div>
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
                placeholder="Ask Grace anything…"
                rows={1}
                onChange={e => { setDraft(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(draft); } }}
              />
              <button className="ai-send" onClick={() => ask(draft)} disabled={!draft.trim() || pending}><Icon name="arrow_up" size={14} /></button>
            </div>
            <div className="ai-hint">Grace AI uses your CRM context. Replies may not always be perfect.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
