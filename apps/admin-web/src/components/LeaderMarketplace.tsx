import { useMemo, useState } from 'react';
import { Sparkles, Search, Globe, ShieldCheck } from 'lucide-react';
import {
  type AnchorLeader,
  useVerifiedLeaders,
  Avatar,
  Tag,
  Rating,
  LeaderDetailModal,
} from '../lib/verifiedLeaders';

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
  const { leaders, status } = useVerifiedLeaders();
  const [query, setQuery] = useState('');
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [selected, setSelected] = useState<AnchorLeader | null>(null);

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
