import { ShieldCheck } from 'lucide-react';
import type { LeaderProfile } from '../../../types';
import { getLeaderPhoto } from '../../../config/centralHendersonLeaders';

export type LeaderAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'hero';

const SIZE_CLASSES: Record<LeaderAvatarSize, { box: string; text: string; badge: string; icon: number }> = {
  xs: { box: 'w-8 h-8', text: 'text-[10px]', badge: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5', icon: 7 },
  sm: { box: 'w-10 h-10', text: 'text-xs', badge: 'w-4 h-4 -bottom-0.5 -right-0.5', icon: 8 },
  md: { box: 'w-12 h-12', text: 'text-sm', badge: 'w-4 h-4 -bottom-0.5 -right-0.5', icon: 9 },
  lg: { box: 'w-14 h-14', text: 'text-base', badge: 'w-5 h-5 -bottom-0.5 -right-0.5', icon: 11 },
  hero: { box: 'w-full aspect-[4/5]', text: 'text-lg', badge: 'w-5 h-5 bottom-2 right-2', icon: 11 },
};

function leaderInitials(displayName: string): string {
  return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function resolvePhoto(leader: Pick<LeaderProfile, 'id' | 'photo' | 'displayName'>): string | undefined {
  return leader.photo ?? getLeaderPhoto(leader.id);
}

interface LeaderAvatarProps {
  leader: Pick<LeaderProfile, 'id' | 'photo' | 'displayName' | 'isVerified'>;
  size?: LeaderAvatarSize;
  showVerified?: boolean;
  className?: string;
  rounded?: 'full' | 'xl';
}

export function LeaderAvatar({
  leader,
  size = 'md',
  showVerified = true,
  className = '',
  rounded = 'full',
}: LeaderAvatarProps) {
  const photo = resolvePhoto(leader);
  const initials = leaderInitials(leader.displayName);
  const styles = SIZE_CLASSES[size];
  const roundClass = rounded === 'xl' ? 'rounded-xl' : 'rounded-full';
  const isHero = size === 'hero';

  return (
    <div className={`relative shrink-0 ${isHero ? 'w-full' : styles.box} ${className}`}>
      {photo ? (
        <img
          src={photo}
          alt={leader.displayName}
          className={`${isHero ? 'w-full h-full' : styles.box} ${roundClass} object-cover object-top`}
        />
      ) : (
        <div
          className={`${isHero ? 'w-full h-full' : styles.box} ${roundClass} bg-slate-200 dark:bg-dark-700 flex items-center justify-center font-semibold text-slate-700 dark:text-dark-200 ${styles.text}`}
        >
          {initials}
        </div>
      )}
      {showVerified && leader.isVerified && (
        <div
          className={`absolute ${styles.badge} rounded-full bg-amber-500 border-2 border-stone-100 dark:border-dark-800 flex items-center justify-center`}
        >
          <ShieldCheck size={styles.icon} className="text-white" />
        </div>
      )}
    </div>
  );
}
