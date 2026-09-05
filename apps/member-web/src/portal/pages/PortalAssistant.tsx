/**
 * "Ask GRACE" — the member-facing assistant chat.
 *
 * The AI disclosure banner is permanent (not dismissible), matching the
 * requirement that the assistant always state clearly that it is an AI
 * assistant, not a person. There is no leader-avatar feature in the real
 * Members Portal (previews/grace-companion.js's leader-avatar concept is
 * a scripted preview artifact, not wired here) — GRACE presents plainly
 * as an AI assistant, never as a specific leader.
 */
import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, ShieldAlert, RotateCcw } from 'lucide-react';
import { usePortalAssistant } from '../hooks/usePortalAssistant';

export function PortalAssistant() {
  const { turns, isSending, error, lastMeta, send, reset } = usePortalAssistant();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, isSending]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || isSending) return;
    const toSend = draft;
    setDraft('');
    await send(toSend);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] sm:h-screen max-w-2xl mx-auto">
      <div className="p-4 sm:p-6 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900 flex items-center gap-2">
            <Sparkles size={22} className="text-rose-600" /> Ask GRACE
          </h1>
          {turns.length > 0 && (
            <button onClick={reset} className="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1">
              <RotateCcw size={12} /> New conversation
            </button>
          )}
        </div>
        <div className="mt-2 rounded-xl bg-stone-100 border border-stone-200 px-3 py-2 text-xs text-stone-600" data-testid="assistant-disclosure">
          GRACE is an AI assistant, not a person. It uses approved church materials and is not a live conversation with a leader — you can ask it to request a real person follow up with you at any time.
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 space-y-3">
        {turns.length === 0 && (
          <p className="text-sm text-stone-400 mt-4">
            Ask about upcoming events, groups, volunteering, your giving or Impact Card, or say what you need help with.
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                t.role === 'user' ? 'bg-rose-600 text-white' : 'bg-white border border-stone-200 text-stone-800'
              }`}
              data-testid={t.role === 'user' ? 'assistant-turn-user' : 'assistant-turn-model'}
            >
              {t.text}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 text-sm bg-white border border-stone-200 text-stone-400">GRACE is thinking…</div>
          </div>
        )}
        {lastMeta?.crisisDetected && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800 flex items-start gap-1.5" data-testid="assistant-crisis-banner">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            This has been routed to pastoral care for human follow-up. If you are in immediate danger, call or text 988 or call 911.
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-700" data-testid="assistant-error">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 pt-2 flex items-center gap-2 border-t border-stone-100">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Ask GRACE…"
          disabled={isSending}
          className="flex-1 rounded-full border border-stone-300 px-4 py-2.5 text-sm disabled:opacity-50"
          aria-label="Message to GRACE"
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="p-2.5 rounded-full bg-rose-600 text-white disabled:opacity-50"
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
