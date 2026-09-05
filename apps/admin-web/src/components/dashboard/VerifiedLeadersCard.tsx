import { ShieldCheck, ArrowRight, UserPlus } from 'lucide-react';
import type { LeaderProfile, HelpCategory } from '../../types';

interface VerifiedLeadersCardProps {
  leaders: LeaderProfile[];
  onViewAll: () => void;
  maxVisible?: number;
}

const CATEGORY_LABELS: Record<HelpCategory, string> = {
  'marriage': 'Marriage',
  'addiction': 'Recovery',
  'grief': 'Grief',
  'faith-questions': 'Faith',
  'crisis': 'Crisis',
  'financial': 'Financial',
  'anxiety-depression': 'Mental Health',
  'parenting': 'Parenting',
  'general': 'General',
};

export function VerifiedLeadersCard({ leaders, onViewAll, maxVisible = 5 }: VerifiedLeadersCardProps) {
  const verified = leaders.filter(l => l.isVerified && l.isActive);
  const visible = verified.slice(0, maxVisible);
  const overflow = verified.length - visible.length;

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-stone-200 dark:border-dark-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-dark-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
            <ShieldCheck size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-dark-100 leading-tight">Verified Leaders</h3>
            <p className="text-xs text-gray-500 dark:text-dark-400">{verified.length} active</p>
          </div>
        </div>
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-dark-300 hover:text-slate-900 dark:hover:text-white"
        >
          View all <ArrowRight size={12} />
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <UserPlus size={28} className="mx-auto text-stone-400 dark:text-dark-500 mb-2" />
          <p className="text-sm text-gray-600 dark:text-dark-400 mb-3">No verified leaders yet</p>
          <button
            onClick={onViewAll}
            className="text-xs font-medium px-3 py-1.5 bg-slate-900 hover:bg-slate-950 text-white rounded-md transition-colors"
          >
            Set up leaders
          </button>
        </div>
      ) : (
        <div className="divide-y divide-stone-200 dark:divide-dark-700">
          {visible.map(leader => (
            <LeaderRow key={leader.id} leader={leader} onClick={onViewAll} />
          ))}
          {overflow > 0 && (
            <button
              onClick={onViewAll}
              className="w-full px-5 py-3 text-xs font-medium text-slate-600 dark:text-dark-400 hover:bg-stone-50 dark:hover:bg-dark-900 transition-colors text-left"
            >
              + {overflow} more verified leader{overflow === 1 ? '' : 's'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LeaderRow({ leader, onClick }: { leader: LeaderProfile; onClick: () => void }) {
  const initials = leader.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const topExpertise = leader.expertiseAreas.slice(0, 2);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-stone-50 dark:hover:bg-dark-900 transition-colors text-left"
    >
      <div className="relative shrink-0">
        {leader.photo ? (
          <img src={leader.photo} alt={leader.displayName} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-dark-700 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-dark-200">
            {initials}
          </div>
        )}
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-white dark:border-dark-800 flex items-center justify-center">
          <ShieldCheck size={9} className="text-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-900 dark:text-dark-100 truncate">{leader.displayName}</p>
          {leader.isAvailable && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Available" />
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-dark-400 truncate">
          {leader.title}
          {topExpertise.length > 0 && ' · '}
          {topExpertise.map(e => CATEGORY_LABELS[e]).join(', ')}
        </p>
      </div>
    </button>
  );
}
