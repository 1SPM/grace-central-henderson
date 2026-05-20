import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Search, BookOpen, Globe, Star, ShieldCheck, X, Heart,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AnchorLeader {
  id: string;
  display_name: string;
  title: string;
  bio: string;
  photo_url: string | null;
  expertise_areas: string[];
  credentials: string[];
  years_of_practice: number | null;
  personality_traits: string[];
  spiritual_focus_areas: string[];
  language: string;
  denomination: string | null;
  anchor_verse: string | null;
  rating_avg: number | null;
  rating_count: number;
  total_sessions_completed: number;
  is_accepting_new_conversations: boolean;
}

const SELECT_COLUMNS =
  'id, display_name, title, bio, photo_url, expertise_areas, credentials, ' +
  'years_of_practice, personality_traits, spiritual_focus_areas, language, ' +
  'denomination, anchor_verse, rating_avg, rating_count, ' +
  'total_sessions_completed, is_accepting_new_conversations';

function initialsOf(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function Avatar({ leader, size = 16 }: { leader: AnchorLeader; size?: number }) {
  const px = size * 4; // tailwind w-16 = 64px
  if (leader.photo_url) {
    return (
      <img
        src={leader.photo_url}
        alt={leader.display_name}
        className="rounded-full object-cover"
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white font-semibold"
      style={{ width: px, height: px, fontSize: size * 0.45 }}
    >
      {initialsOf(leader.display_name)}
    </div>
  );
}

function Tag({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'amber' | 'indigo' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-50 text-amber-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Rating({ leader }: { leader: AnchorLeader }) {
  if (!leader.rating_avg || leader.rating_count === 0) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-slate-500">
      <Star size={12} className="fill-amber-400 text-amber-400" />
      {leader.rating_avg.toFixed(1)}
      <span className="text-slate-400">({leader.rating_count})</span>
    </span>
  );
}

function LeaderDetailModal({ leader, onClose }: { leader: AnchorLeader; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar leader={leader} size={16} />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900">{leader.display_name}</h2>
                  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    <ShieldCheck size={11} /> Verified
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{leader.title}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Rating leader={leader} />
                  {leader.years_of_practice ? (
                    <span className="text-xs text-slate-400">{leader.years_of_practice} yrs</span>
                  ) : null}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X size={20} />
            </button>
          </div>

          <p className="text-sm text-slate-700 mt-5 leading-relaxed whitespace-pre-line">{leader.bio}</p>

          {leader.anchor_verse && (
            <blockquote className="text-sm text-slate-600 italic border-l-2 border-amber-400 pl-3 mt-4">
              {leader.anchor_verse}
            </blockquote>
          )}

          {leader.expertise_areas.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Heart size={13} /> Cares about
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {leader.expertise_areas.map(a => <Tag key={a}>{a}</Tag>)}
              </div>
            </div>
          )}

          {leader.credentials.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <BookOpen size={13} /> Credentials
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {leader.credentials.map(c => <Tag key={c} tone="amber">{c}</Tag>)}
              </div>
            </div>
          )}

          {leader.spiritual_focus_areas.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Spiritual focus</h4>
              <div className="flex flex-wrap gap-1.5">
                {leader.spiritual_focus_areas.map(a => <Tag key={a} tone="indigo">{a}</Tag>)}
              </div>
            </div>
          )}

          {/* Conversation CTA — chat backend not yet built; keep honest, not a dead button */}
          <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
            <p className="text-sm font-medium text-slate-900">Conversations are launching soon</p>
            <p className="text-xs text-slate-600 mt-1">
              {leader.display_name.split(' ')[0]}'s AI companion will be able to pray and talk with
              you here. We'll open it up shortly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaderCard({ leader, onOpen }: { leader: AnchorLeader; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="text-left bg-white rounded-xl border border-stone-200 p-5 hover:shadow-md hover:border-stone-300 transition-all"
    >
      <div className="flex items-start gap-4">
        <Avatar leader={leader} size={14} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-slate-900 truncate">{leader.display_name}</h3>
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0">
              <ShieldCheck size={11} /> Verified
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5 truncate">{leader.title}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <Rating leader={leader} />
            {leader.language && leader.language !== 'English' && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Globe size={11} /> {leader.language}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-3 line-clamp-2">{leader.bio}</p>

      {(leader.expertise_areas.length > 0 || leader.credentials.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {leader.credentials.slice(0, 2).map(c => <Tag key={c} tone="amber">{c}</Tag>)}
          {leader.expertise_areas.slice(0, 4).map(a => <Tag key={a}>{a}</Tag>)}
        </div>
      )}
    </button>
  );
}

export function LeaderMarketplace() {
  const [leaders, setLeaders] = useState<AnchorLeader[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [selected, setSelected] = useState<AnchorLeader | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setStatus('error');
        return;
      }
      try {
        const { data, error } = await supabase
          .from('anchor_leaders')
          .select(SELECT_COLUMNS)
          .eq('is_published', true)
          .eq('is_verified', true)
          .order('rating_avg', { ascending: false, nullsFirst: false });
        if (error) throw error;
        if (!cancelled) {
          setLeaders((data ?? []) as unknown as AnchorLeader[]);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const allAreas = useMemo(() => {
    const set = new Set<string>();
    leaders.forEach(l => l.expertise_areas.forEach(a => set.add(a)));
    return Array.from(set).sort();
  }, [leaders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leaders.filter(l => {
      if (activeArea && !l.expertise_areas.includes(activeArea)) return false;
      if (!q) return true;
      return (
        l.display_name.toLowerCase().includes(q) ||
        l.title.toLowerCase().includes(q) ||
        l.bio.toLowerCase().includes(q) ||
        l.expertise_areas.some(a => a.toLowerCase().includes(q))
      );
    });
  }, [leaders, query, activeArea]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 pt-12 pb-6 text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-amber-600" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Find a leader who gets it</h1>
        <p className="text-lg text-slate-600 mt-3 max-w-xl mx-auto">
          Verified pastors, counselors, and mentors — each with an AI companion trained on their
          voice, ready to pray and talk through what you're carrying.
        </p>
      </div>

      {/* Search + filters */}
      <div className="max-w-5xl mx-auto px-4 sticky top-0 bg-gradient-to-b from-white/90 to-white/60 backdrop-blur-sm py-4 z-10">
        <div className="relative max-w-md mx-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, focus, or what you're facing…"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
        {allAreas.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            <button
              onClick={() => setActiveArea(null)}
              className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                activeArea === null ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              All
            </button>
            {allAreas.map(area => (
              <button
                key={area}
                onClick={() => setActiveArea(area === activeArea ? null : area)}
                className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                  activeArea === area ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 pb-16 pt-2">
        {status === 'loading' && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-20">
            <p className="text-slate-600">We couldn't load leaders just now. Please refresh in a moment.</p>
          </div>
        )}

        {status === 'ready' && filtered.length === 0 && (
          <div className="text-center py-16 max-w-md mx-auto">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-slate-400" />
            </div>
            {leaders.length === 0 ? (
              <>
                <h3 className="text-lg font-semibold text-slate-900">Our first leaders are on the way</h3>
                <p className="text-slate-600 mt-2">
                  We're hand-verifying the first group of leaders now. Check back soon — or if you
                  lead a ministry,{' '}
                  <a href="/leaders" className="text-amber-600 font-medium hover:underline">apply to be one</a>.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-slate-900">No leaders match that</h3>
                <p className="text-slate-600 mt-2">Try a different search or clear your filters.</p>
              </>
            )}
          </div>
        )}

        {status === 'ready' && filtered.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(leader => (
              <LeaderCard key={leader.id} leader={leader} onOpen={() => setSelected(leader)} />
            ))}
          </div>
        )}
      </div>

      {selected && <LeaderDetailModal leader={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
