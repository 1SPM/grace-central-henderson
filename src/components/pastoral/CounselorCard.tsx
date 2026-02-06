import { MessageCircle, Clock, CheckCircle } from 'lucide-react';
import type { LeaderProfile, HelpCategory } from '../../types';

interface CounselorCardProps {
  leader: LeaderProfile;
  onStartChat: (leaderId: string) => void;
  activeConversations?: number;
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

export function CounselorCard({ leader, onStartChat, activeConversations = 0 }: CounselorCardProps) {
  const initials = leader.displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-gray-700/50 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {leader.photo ? (
            <img
              src={leader.photo}
              alt={leader.displayName}
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
              {initials}
            </div>
          )}
          {/* Availability indicator */}
          <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-dark-800 ${
            leader.isAvailable ? 'bg-emerald-500' : 'bg-gray-400'
          }`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {leader.displayName}
            </h3>
            {leader.isAvailable && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{leader.title}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">{leader.bio}</p>
        </div>
      </div>

      {/* Expertise tags */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {leader.expertiseAreas.map(area => (
          <span
            key={area}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400"
          >
            {CATEGORY_LABELS[area]}
          </span>
        ))}
      </div>

      {/* Stats & action */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          {activeConversations > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {activeConversations} active
            </span>
          )}
          <span className="flex items-center gap-1">
            <CheckCircle size={12} />
            Verified Leader
          </span>
        </div>
        <button
          onClick={() => onStartChat(leader.id)}
          className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
        >
          <MessageCircle size={14} />
          Chat
        </button>
      </div>
    </div>
  );
}
