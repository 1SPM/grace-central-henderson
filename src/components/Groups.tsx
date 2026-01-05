import { Users2, MapPin, Clock, User } from 'lucide-react';
import { SmallGroup, Person } from '../types';

interface GroupsProps {
  groups: SmallGroup[];
  people: Person[];
}

export function Groups({ groups, people }: GroupsProps) {
  const activeGroups = groups.filter(g => g.isActive);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Small Groups</h1>
        <p className="text-gray-500 dark:text-dark-400 mt-1">{activeGroups.length} active groups</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {activeGroups.map((group) => {
          const leader = people.find(p => p.id === group.leaderId);
          const members = group.members.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];

          return (
            <div key={group.id} className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">{group.name}</h2>
                  {group.description && (
                    <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">{group.description}</p>
                  )}
                </div>
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <Users2 className="text-purple-600 dark:text-purple-400" size={20} />
                </div>
              </div>

              <div className="space-y-3 text-sm">
                {leader && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-dark-300">
                    <User size={16} className="text-gray-400 dark:text-dark-500" />
                    <span>Led by {leader.firstName} {leader.lastName}</span>
                  </div>
                )}
                {group.meetingDay && group.meetingTime && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-dark-300">
                    <Clock size={16} className="text-gray-400 dark:text-dark-500" />
                    <span>{group.meetingDay}s at {group.meetingTime}</span>
                  </div>
                )}
                {group.location && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-dark-300">
                    <MapPin size={16} className="text-gray-400 dark:text-dark-500" />
                    <span>{group.location}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-700">
                <p className="text-xs text-gray-400 dark:text-dark-500 mb-2">{members.length} members</p>
                <div className="flex -space-x-2">
                  {members.slice(0, 5).map((member) => (
                    <div
                      key={member.id}
                      className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-dark-850"
                      title={`${member.firstName} ${member.lastName}`}
                    >
                      {member.firstName[0]}{member.lastName[0]}
                    </div>
                  ))}
                  {members.length > 5 && (
                    <div className="w-8 h-8 bg-gray-200 dark:bg-dark-700 rounded-full flex items-center justify-center text-gray-500 dark:text-dark-300 text-xs font-medium border-2 border-white dark:border-dark-850">
                      +{members.length - 5}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeGroups.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700">
          <Users2 className="mx-auto text-gray-300 dark:text-dark-600 mb-3" size={48} />
          <p className="text-gray-400 dark:text-dark-400">No small groups yet</p>
        </div>
      )}
    </div>
  );
}
