import type { CSSProperties } from 'react';
import { Plus } from 'lucide-react';
import type { LeaderProfile, MemberPortalTab } from '../../types';
import { DEMO_LEADERS } from './demoLeaders';

interface PastoralStoriesProps {
  leaders?: LeaderProfile[];
  onTapLeader?: (tab: MemberPortalTab) => void;
}

export function PastoralStories({
  leaders = DEMO_LEADERS,
  onTapLeader,
}: PastoralStoriesProps) {
  const activeLeaders = leaders.filter(l => l.isActive);

  if (activeLeaders.length === 0) return null;

  return (
    <div className="flex-shrink-0 bg-white dark:bg-dark-850 border-b border-gray-100 dark:border-dark-700">
      <div
        className="flex items-start gap-3 px-4 py-3 overflow-x-auto"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' } as CSSProperties}
      >
        {/* "Get Help" CTA — like the "Your Story" bubble */}
        <button
          onClick={() => onTapLeader?.('care')}
          className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[62px]"
        >
          <div className="relative">
            <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-500/20 dark:to-purple-500/20 flex items-center justify-center border-2 border-dashed border-violet-300 dark:border-violet-500/40">
              <Plus size={22} className="text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 leading-tight text-center truncate w-full">
            Get Help
          </span>
        </button>

        {/* Leader bubbles */}
        {activeLeaders.map(leader => {
          const initials = leader.displayName
            .split(' ')
            .map(n => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          const firstName = leader.displayName.split(' ')[0];
          // Prepend title prefix for pastors
          const shortName = leader.title.toLowerCase().startsWith('senior')
            ? `Pr. ${firstName}`
            : leader.title.toLowerCase().startsWith('associate')
            ? `Pr. ${firstName}`
            : leader.displayName.split(' ').slice(0, 1).join('');

          return (
            <button
              key={leader.id}
              onClick={() => onTapLeader?.('care')}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[62px] group"
            >
              {/* Ring + Avatar */}
              <div className="relative">
                {/* Gradient ring — green for online, gray for offline */}
                <div
                  className={`w-[60px] h-[60px] rounded-full flex items-center justify-center ${
                    leader.isAvailable
                      ? 'bg-gradient-to-tr from-emerald-400 via-green-500 to-teal-500'
                      : 'bg-gradient-to-tr from-gray-200 via-gray-300 to-gray-200 dark:from-dark-600 dark:via-dark-500 dark:to-dark-600'
                  }`}
                >
                  {/* White gap ring */}
                  <div className="w-[54px] h-[54px] rounded-full bg-white dark:bg-dark-850 flex items-center justify-center">
                    {/* Avatar */}
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

                {/* Verified check */}
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
  );
}
