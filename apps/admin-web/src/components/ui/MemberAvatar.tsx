import { useState } from 'react';
import type { Person } from '../../types';

export type AvatarPerson = Pick<Person, 'firstName' | 'lastName' | 'photo'>;

const SIZE_CLASSES = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-12 h-12 text-lg',
} as const;

export type MemberAvatarSize = keyof typeof SIZE_CLASSES;

interface MemberAvatarProps {
  person: AvatarPerson;
  size?: MemberAvatarSize;
  className?: string;
}

export function memberInitials(person: AvatarPerson): string {
  return `${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`;
}

export function MemberAvatar({ person, size = 'md', className = '' }: MemberAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size];
  const showPhoto = Boolean(person.photo) && !imgFailed;

  if (showPhoto) {
    return (
      <img
        src={person.photo}
        alt={`${person.firstName} ${person.lastName}`}
        className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} bg-gradient-to-br from-indigo-400 to-slate-500 rounded-full flex items-center justify-center text-white font-medium shrink-0 ${className}`}
      aria-hidden
    >
      {memberInitials(person)}
    </div>
  );
}
