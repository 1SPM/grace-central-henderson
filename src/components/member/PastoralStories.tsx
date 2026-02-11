import { useState, type CSSProperties } from 'react';
import { MessageCircle, Mail, X, Star, Clock, Globe, ChevronRight, Heart } from 'lucide-react';
import type { LeaderProfile } from '../../types';
import { DEMO_LEADERS } from './demoLeaders';

interface PastoralStoriesProps {
  leaders?: LeaderProfile[];
  onStartChat?: (leaderId: string) => void;
  onWriteLetter?: (leaderId: string) => void;
}

export function PastoralStories({
  leaders = DEMO_LEADERS,
  onStartChat,
  onWriteLetter,
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
          onWriteLetter={(id) => {
            onWriteLetter?.(id);
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
  onWriteLetter: (leaderId: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  marriage: 'Marriage', addiction: 'Recovery', grief: 'Grief',
  'faith-questions': 'Faith', crisis: 'Crisis', financial: 'Financial',
  'anxiety-depression': 'Mental Health', parenting: 'Parenting', general: 'General',
};

function PastorProfileSheet({ leader, onClose, onStartChat, onWriteLetter }: PastorProfileSheetProps) {
  const initials = leader.displayName
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-white dark:bg-dark-850 rounded-t-2xl sm:rounded-2xl animate-in slide-in-from-bottom duration-300">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors z-10"
        >
          <X size={16} className="text-gray-500 dark:text-dark-400" />
        </button>

        {/* Header — big avatar + name */}
        <div className="flex flex-col items-center pt-8 pb-4 px-6">
          <div className="relative mb-3">
            {leader.photo ? (
              <img
                src={leader.photo}
                alt={leader.displayName}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-white dark:ring-dark-850 shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                {initials}
              </div>
            )}

            {/* Online indicator */}
            {leader.isAvailable && (
              <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-[3px] border-white dark:border-dark-850">
                <div className="w-full h-full rounded-full bg-emerald-500 animate-pulse" />
              </div>
            )}
          </div>

          <h2 className="text-lg font-bold text-gray-900 dark:text-dark-50 text-center">
            {leader.displayName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-dark-400 text-center mt-0.5">
            {leader.title}
          </p>

          {/* Status pill */}
          <div className={`mt-2.5 px-3 py-1 rounded-full text-xs font-medium ${
            leader.isAvailable
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-dark-400'
          }`}>
            {leader.isAvailable ? 'Available now' : 'Away right now'}
          </div>
        </div>

        {/* Bio */}
        <div className="px-6 pb-4">
          <p className="text-sm text-gray-600 dark:text-dark-300 leading-relaxed text-center">
            {leader.bio}
          </p>
        </div>

        {/* Quick stats */}
        <div className="px-6 pb-4 flex items-center justify-center gap-6">
          {leader.yearsOfPractice && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-dark-400">
              <Clock size={13} />
              <span>{leader.yearsOfPractice} years</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-dark-400">
            <Globe size={13} />
            <span>{leader.language}</span>
          </div>
          {leader.isVerified && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
              <Star size={13} className="fill-current" />
              <span>Verified</span>
            </div>
          )}
        </div>

        {/* Expertise tags */}
        <div className="px-6 pb-4">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {leader.expertiseAreas.map(area => (
              <span
                key={area}
                className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 text-xs font-medium"
              >
                {CATEGORY_LABELS[area] || area}
              </span>
            ))}
          </div>
        </div>

        {/* Personality */}
        {leader.personalityTraits.length > 0 && (
          <div className="px-6 pb-4">
            <p className="text-xs text-gray-400 dark:text-dark-500 text-center">
              {leader.personalityTraits.join(' · ')}
            </p>
          </div>
        )}

        {/* Credentials */}
        {leader.credentials.length > 0 && (
          <div className="px-6 pb-4">
            <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-dark-400 mb-1.5 uppercase tracking-wider">
                Credentials
              </p>
              {leader.credentials.map((cred, i) => (
                <p key={i} className="text-xs text-gray-600 dark:text-dark-300 leading-relaxed">
                  {cred}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="px-6 pb-8 pt-2 flex flex-col gap-2.5">
          <button
            onClick={() => onStartChat(leader.id)}
            className={`flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
              leader.isAvailable
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-dark-500 cursor-not-allowed'
            }`}
            disabled={!leader.isAvailable}
          >
            <MessageCircle size={18} />
            {leader.isAvailable ? 'Start a Conversation' : 'Not available right now'}
            {leader.isAvailable && <ChevronRight size={16} className="ml-auto" />}
          </button>

          <button
            onClick={() => onWriteLetter(leader.id)}
            className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl font-semibold text-sm bg-white dark:bg-dark-800 border-2 border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-200 hover:border-violet-300 dark:hover:border-violet-500/40 hover:text-violet-700 dark:hover:text-violet-400 transition-all"
          >
            <Mail size={18} />
            Write a Letter
            <ChevronRight size={16} className="ml-auto" />
          </button>
        </div>
      </div>
    </div>
  );
}
