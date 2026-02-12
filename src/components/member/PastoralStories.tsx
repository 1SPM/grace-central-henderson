import { useState, type CSSProperties } from 'react';
import { MessageCircle, X, Star, Clock, Globe, Heart } from 'lucide-react';
import type { LeaderProfile } from '../../types';
import { DEMO_LEADERS } from './demoLeaders';

interface PastoralStoriesProps {
  leaders?: LeaderProfile[];
  onStartChat?: (leaderId: string) => void;
}

export function PastoralStories({
  leaders = DEMO_LEADERS,
  onStartChat,
}: PastoralStoriesProps) {
  const [selectedLeader, setSelectedLeader] = useState<LeaderProfile | null>(null);
  const activeLeaders = leaders.filter(l => l.isActive);

  if (activeLeaders.length === 0) return null;

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const getShortName = (leader: LeaderProfile) => {
    const firstName = leader.displayName.split(' ').slice(-1)[0]; // last name for "Pastor X" or first for others
    const name = leader.displayName.split(' ')[0];
    if (leader.title.toLowerCase().includes('pastor')) return `Pr. ${firstName}`;
    if (leader.title.toLowerCase().includes('deacon')) return `Dcn. ${name}`;
    if (leader.title.toLowerCase().includes('sister')) return `Sr. ${firstName}`;
    return leader.displayName.split(' ')[0];
  };

  return (
    <>
      <div className="flex-shrink-0 bg-white dark:bg-dark-850 border-b border-gray-100 dark:border-dark-700">
        <div
          className="flex items-start gap-3 px-4 py-3 overflow-x-auto"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' } as CSSProperties}
        >
          {/* "Say Hi" CTA — like the "Your Story" bubble */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[62px]">
            <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 flex items-center justify-center border-2 border-dashed border-amber-300 dark:border-amber-500/30">
              <Heart size={22} className="text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 leading-tight text-center truncate w-full">
              Say Hi
            </span>
          </div>

          {/* Leader bubbles */}
          {activeLeaders.map(leader => {
            const initials = getInitials(leader.displayName);
            const shortName = getShortName(leader);

            return (
              <button
                key={leader.id}
                onClick={() => setSelectedLeader(leader)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[62px] group"
              >
                {/* Ring + Avatar */}
                <div className="relative">
                  <div
                    className={`w-[60px] h-[60px] rounded-full flex items-center justify-center ${
                      leader.isAvailable
                        ? 'bg-gradient-to-tr from-emerald-400 via-green-500 to-teal-500'
                        : 'bg-gradient-to-tr from-gray-200 via-gray-300 to-gray-200 dark:from-dark-600 dark:via-dark-500 dark:to-dark-600'
                    }`}
                  >
                    <div className="w-[54px] h-[54px] rounded-full bg-white dark:bg-dark-850 flex items-center justify-center">
                      {leader.photo ? (
                        <img
                          src={leader.photo}
                          alt={leader.displayName}
                          className="w-[50px] h-[50px] rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm group-hover:from-violet-600 group-hover:to-purple-700 transition-colors">
                          {initials}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Online dot */}
                  {leader.isAvailable && (
                    <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-dark-850">
                      <div className="w-full h-full rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                  )}

                  {/* Verified badge */}
                  {leader.isVerified && (
                    <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-[1.5px] border-white dark:border-dark-850">
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Name */}
                <span className={`text-[10px] leading-tight text-center truncate w-full ${
                  leader.isAvailable
                    ? 'font-medium text-gray-900 dark:text-dark-100'
                    : 'font-normal text-gray-400 dark:text-dark-500'
                }`}>
                  {shortName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pastor Profile Sheet */}
      {selectedLeader && (
        <PastorProfileSheet
          leader={selectedLeader}
          onClose={() => setSelectedLeader(null)}
          onStartChat={(id) => {
            onStartChat?.(id);
            setSelectedLeader(null);
          }}
        />
      )}
    </>
  );
}

/* ── Profile Sheet ─────────────────────────────────────── */

interface PastorProfileSheetProps {
  leader: LeaderProfile;
  onClose: () => void;
  onStartChat: (leaderId: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  marriage: 'Marriage', addiction: 'Recovery', grief: 'Grief',
  'faith-questions': 'Faith', crisis: 'Crisis', financial: 'Financial',
  'anxiety-depression': 'Mental Health', parenting: 'Parenting', general: 'General',
};

function PastorProfileSheet({ leader, onClose, onStartChat }: PastorProfileSheetProps) {
  const initials = leader.displayName
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="absolute inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Sheet — slides up from bottom, sized for mobile */}
      <div className="relative w-full max-h-[80%] overflow-y-auto bg-white dark:bg-dark-850 rounded-t-2xl shadow-xl">
        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-1 bg-white dark:bg-dark-850">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-dark-600" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100/80 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors z-10"
        >
          <X size={14} className="text-gray-500 dark:text-dark-400" />
        </button>

        {/* Avatar + name */}
        <div className="flex flex-col items-center pt-2 pb-3 px-5">
          <div className="relative mb-2">
            {leader.photo ? (
              <img
                src={leader.photo}
                alt={leader.displayName}
                className="w-20 h-20 rounded-full object-cover ring-3 ring-white dark:ring-dark-850 shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
                {initials}
              </div>
            )}

            {leader.isAvailable && (
              <div className="absolute bottom-0.5 right-0.5 w-4.5 h-4.5 rounded-full bg-emerald-500 border-[2.5px] border-white dark:border-dark-850" />
            )}
          </div>

          <h2 className="text-base font-bold text-gray-900 dark:text-dark-50 text-center leading-tight">
            {leader.displayName}
          </h2>
          <p className="text-xs text-gray-500 dark:text-dark-400 text-center mt-0.5">
            {leader.title}
          </p>

          {/* Status */}
          <div className={`mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
            leader.isAvailable
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-dark-400'
          }`}>
            {leader.isAvailable ? 'Available now' : 'Away right now'}
          </div>
        </div>

        {/* Bio */}
        <div className="px-5 pb-3">
          <p className="text-xs text-gray-600 dark:text-dark-300 leading-relaxed text-center">
            {leader.bio}
          </p>
        </div>

        {/* Quick stats */}
        <div className="px-5 pb-3 flex items-center justify-center gap-4">
          {leader.yearsOfPractice && (
            <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-dark-400">
              <Clock size={12} />
              <span>{leader.yearsOfPractice}yr exp</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-dark-400">
            <Globe size={12} />
            <span>{leader.language}</span>
          </div>
          {leader.isVerified && (
            <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
              <Star size={12} className="fill-current" />
              <span>Verified</span>
            </div>
          )}
        </div>

        {/* Expertise tags */}
        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-1 justify-center">
            {leader.expertiseAreas.map(area => (
              <span
                key={area}
                className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 text-[10px] font-medium"
              >
                {CATEGORY_LABELS[area] || area}
              </span>
            ))}
          </div>
        </div>

        {/* Credentials (compact) */}
        {leader.credentials.length > 0 && (
          <div className="px-5 pb-3">
            <p className="text-[10px] text-gray-400 dark:text-dark-500 text-center">
              {leader.credentials.join(' · ')}
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="px-5 pb-5 pt-1">
          <button
            onClick={() => onStartChat(leader.id)}
            className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all ${
              leader.isAvailable
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20'
                : 'bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-dark-500 cursor-not-allowed'
            }`}
            disabled={!leader.isAvailable}
          >
            <MessageCircle size={16} />
            {leader.isAvailable ? 'Start a Conversation' : 'Not available right now'}
          </button>
        </div>
      </div>
    </div>
  );
}
