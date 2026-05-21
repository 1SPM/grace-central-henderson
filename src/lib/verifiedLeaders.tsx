import { useEffect, useState } from 'react';
import { BookOpen, Star, ShieldCheck, X, Heart } from 'lucide-react';
import { supabase } from './supabase';

export interface AnchorLeader {
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

export type LoadStatus = 'loading' | 'ready' | 'error';

export function useVerifiedLeaders(): { leaders: AnchorLeader[]; status: LoadStatus } {
  const [leaders, setLeaders] = useState<AnchorLeader[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');

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

  return { leaders, status };
}

export function initialsOf(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function Avatar({ leader, size = 16 }: { leader: AnchorLeader; size?: number }) {
  const px = size * 4;
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

export function Tag({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'amber' | 'indigo' }) {
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

export function Rating({ leader }: { leader: AnchorLeader }) {
  if (!leader.rating_avg || leader.rating_count === 0) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-slate-500">
      <Star size={12} className="fill-amber-400 text-amber-400" />
      {leader.rating_avg.toFixed(1)}
      <span className="text-slate-400">({leader.rating_count})</span>
    </span>
  );
}

export function LeaderDetailModal({ leader, onClose }: { leader: AnchorLeader; onClose: () => void }) {
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
