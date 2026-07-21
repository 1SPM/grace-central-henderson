import { useState, FormEvent } from 'react';
import { X, Home, MessageCircle, Sparkles, Users, ArrowRight } from 'lucide-react';
import { GraceOrb } from './GraceOrb';
import { useGraceChat } from '../../contexts/GraceChatContext';
import { churchShortName } from '../../config/tenant';

interface GraceGettingStartedPanelProps {
  churchName?: string;
  onDismiss: () => void;
}

const FEATURE_CARDS = [
  {
    icon: Home,
    title: 'Navigate',
    description: 'Sidebar — Home, People, Care, Giving, and Sunday Prep.',
  },
  {
    icon: MessageCircle,
    title: 'Ask GRACE',
    description: 'Type below or tap the sidebar orb — I learn your rhythm on this device.',
  },
  {
    icon: Sparkles,
    title: 'Go deeper',
    description: 'Personal conversation stays with your verified leader avatar — siloed from GRACE.',
  },
  {
    icon: Users,
    title: 'Explore',
    description: 'Scroll the dashboard for follow-ups, mail, and your church at a glance.',
  },
] as const;

export function GraceGettingStartedPanel({ churchName = 'Central Henderson Church', onDismiss }: GraceGettingStartedPanelProps) {
  const grace = useGraceChat();
  const [query, setQuery] = useState('');
  const shortName = churchShortName(churchName);

  const submitQuery = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      grace.openPanel();
      return;
    }
    grace.openPanel(trimmed);
    setQuery('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitQuery(query);
  };

  return (
    <section className="mb-6 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-700/50 shadow-xl">
      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.14em] bg-slate-800/80 text-sky-200 border border-sky-500/20">
            Getting started
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Dismiss GRACE getting started"
          >
            <X size={18} />
          </button>
        </div>

        {/* Hero */}
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-8 mb-6">
          <div className="flex justify-center sm:justify-start shrink-0 overflow-visible p-3.5">
            <GraceOrb size="lg" rings />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="serif text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">GRACE</h2>
            <p className="inline-block text-[11px] font-medium text-sky-200 bg-sky-500/15 border border-sky-400/25 rounded px-2 py-1 mb-3">
              Growth · Resource · Assistance · Community · Engagement
            </p>
            <p className="text-sm text-slate-300 leading-relaxed mb-2">
              Your guide to growth, resources, and operations at {shortName}
            </p>
            <p className="text-sm text-slate-400 mb-2">
              New here? A quick orientation to your admin home.
            </p>
            <p className="text-sm text-slate-300 italic leading-relaxed mb-2">
              I&apos;m GRACE — your companion for everyday church operations at {shortName} — people, giving, care, Sunday prep, and more. Tap any GRACE orb to open chat; I can take you anywhere in the app.
            </p>
            <p className="text-sm text-slate-400">
              GRACE helps you navigate church life — for deeper conversation, connect with a leader avatar.
            </p>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {FEATURE_CARDS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700/80 text-sky-300 shrink-0">
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white mb-0.5">{title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chat input */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
            Try it — ask GRACE anything
          </p>
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask GRACE — people, giving, Sunday prep, care…"
              className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-600/50 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40"
            />
            <button
              type="submit"
              className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white shrink-0 transition-colors shadow-lg shadow-rose-500/25"
              aria-label="Send to GRACE"
            >
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
