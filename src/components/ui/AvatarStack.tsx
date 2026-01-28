import { Person } from '../../types';

interface AvatarStackProps {
  people: Person[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  onViewPerson?: (id: string) => void;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

const colors = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-indigo-500',
];

function getColorForPerson(person: Person): string {
  const hash = (person.firstName + person.lastName).split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  return colors[Math.abs(hash) % colors.length];
}

export function AvatarStack({ people, max = 4, size = 'md', onViewPerson }: AvatarStackProps) {
  const displayed = people.slice(0, max);
  const remaining = people.length - max;

  return (
    <div className="flex items-center -space-x-2">
      {displayed.map((person, index) => (
        <button
          key={person.id}
          onClick={() => onViewPerson?.(person.id)}
          className={`${sizeClasses[size]} ${getColorForPerson(person)} rounded-full flex items-center justify-center text-white font-medium ring-2 ring-white dark:ring-dark-800 hover:z-10 hover:scale-110 transition-transform`}
          style={{ zIndex: displayed.length - index }}
          title={`${person.firstName} ${person.lastName}`}
        >
          {person.photo ? (
            <img
              src={person.photo}
              alt={`${person.firstName} ${person.lastName}`}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <>
              {person.firstName[0]}
              {person.lastName[0]}
            </>
          )}
        </button>
      ))}
      {remaining > 0 && (
        <div
          className={`${sizeClasses[size]} bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-medium ring-2 ring-white dark:ring-dark-800`}
          style={{ zIndex: 0 }}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
