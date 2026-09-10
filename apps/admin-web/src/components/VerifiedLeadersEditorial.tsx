import { useMemo, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import {
  type AnchorLeader,
  useVerifiedLeaders,
  Avatar,
  Rating,
  LeaderDetailModal,
} from '../lib/verifiedLeaders';

function LeaderRow({ leader, onOpen }: { leader: AnchorLeader; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group w-full text-left py-8 flex items-start gap-6 hover:bg-stone-50/60 -mx-4 px-4 rounded-lg transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-serif text-2xl text-slate-900 group-hover:underline decoration-1 underline-offset-4">
            {leader.display_name}
          </h3>
          <ShieldCheck size={15} className="text-emerald-600 shrink-0" aria-label="Verified" />
        </div>

        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-sm text-slate-500">
          <span>{leader.title}</span>
          {leader.rating_avg && leader.rating_count > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <Rating leader={leader} />
            </>
          )}
          {leader.years_of_practice ? (
            <>
              <span className="text-slate-300">·</span>
              <span>{leader.years_of_practice} yrs</span>
            </>
          ) : null}
        </div>

        <p className="text-slate-600 mt-3 leading-relaxed line-clamp-2 max-w-2xl">{leader.bio}</p>

        {leader.expertise_areas.length > 0 && (
          <p className="text-xs uppercase tracking-wide text-slate-400 mt-3">
            {leader.expertise_areas.join('  ·  ')}
          </p>
        )}
      </div>

      <div className="shrink-0 hidden sm:block">
        <Avatar leader={leader} size={16} />
      </div>
    </button>
  );
}

export function VerifiedLeadersEditorial() {
  const { leaders, status } = useVerifiedLeaders();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AnchorLeader | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leaders;
    return leaders.filter(l =>
      l.display_name.toLowerCase().includes(q) ||
      l.title.toLowerCase().includes(q) ||
      l.bio.toLowerCase().includes(q) ||
      l.expertise_areas.some(a => a.toLowerCase().includes(q)),
    );
  }, [leaders, query]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        {/* Masthead */}
        <header className="border-b border-slate-200 pb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Grace</p>
          <h1 className="font-serif text-5xl sm:text-6xl text-slate-900 leading-none">Verified Leaders</h1>
          <p className="text-lg text-slate-500 mt-5 max-w-xl leading-relaxed">
            Pastors, counselors, and mentors — each personally verified, each with an AI companion
            trained on their voice. Find the one who understands what you're carrying.
          </p>

          <div className="relative mt-8 max-w-sm">
            <Search size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search leaders…"
              className="w-full pl-7 pr-3 py-2 bg-transparent border-b border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
            />
          </div>
        </header>

        {/* Body */}
        {status === 'loading' && (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-slate-800" />
          </div>
        )}

        {status === 'error' && (
          <p className="text-slate-500 py-24 text-center">
            We couldn't load leaders just now. Please refresh in a moment.
          </p>
        )}

        {status === 'ready' && filtered.length === 0 && (
          <div className="py-20 max-w-md">
            {leaders.length === 0 ? (
              <>
                <h3 className="font-serif text-2xl text-slate-900">Our first leaders are on the way</h3>
                <p className="text-slate-500 mt-3 leading-relaxed">
                  We're hand-verifying the first group now. Check back soon — or if you lead a
                  ministry,{' '}
                  <a href="/leaders" className="text-slate-900 underline underline-offset-4">apply to be one</a>.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-serif text-2xl text-slate-900">Nothing matches that</h3>
                <p className="text-slate-500 mt-3">Try a different search.</p>
              </>
            )}
          </div>
        )}

        {status === 'ready' && filtered.length > 0 && (
          <div className="divide-y divide-slate-200">
            {filtered.map(leader => (
              <LeaderRow key={leader.id} leader={leader} onOpen={() => setSelected(leader)} />
            ))}
          </div>
        )}
      </div>

      {selected && <LeaderDetailModal leader={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
