import { ChevronRight, User, TrendingUp } from 'lucide-react';
import { formatLocalDate } from '../utils/validation';
import type { Person, MemberStatus } from '../types';

interface VisitorPipelineProps {
  people: Person[];
  onViewPerson: (id: string) => void;
}

const stages: { status: MemberStatus; label: string; color: string; bgColor: string; borderColor: string }[] = [
  {
    status: 'visitor',
    label: 'Visitors',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-500/30'
  },
  {
    status: 'regular',
    label: 'Regulars',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30'
  },
  {
    status: 'member',
    label: 'Members',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-500/10',
    borderColor: 'border-green-200 dark:border-green-500/30'
  },
  {
    status: 'leader',
    label: 'Leaders',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-500/10',
    borderColor: 'border-purple-200 dark:border-purple-500/30'
  },
];

const avatarGradients: Record<MemberStatus, string> = {
  visitor: 'from-amber-400 to-orange-500',
  regular: 'from-blue-400 to-cyan-500',
  member: 'from-green-400 to-emerald-500',
  leader: 'from-purple-400 to-pink-500',
  inactive: 'from-gray-400 to-gray-500',
};

export function VisitorPipeline({ people, onViewPerson }: VisitorPipelineProps) {
  // Filter out inactive people for the pipeline
  const activePeople = people.filter(p => p.status !== 'inactive');

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-dark-100">Visitor Pipeline</h2>
            <p className="text-sm text-gray-500 dark:text-dark-400">Track the journey from first visit to leadership</p>
          </div>
        </div>
      </div>

      {/* Pipeline Stats */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {stages.map((stage, index) => {
          const count = activePeople.filter(p => p.status === stage.status).length;
          return (
            <div key={stage.status} className="flex items-center">
              <div className={`px-4 py-2 rounded-full ${stage.bgColor} ${stage.borderColor} border`}>
                <span className={`font-semibold ${stage.color}`}>{count}</span>
                <span className={`ml-1.5 text-sm ${stage.color} opacity-80`}>{stage.label}</span>
              </div>
              {index < stages.length - 1 && (
                <ChevronRight size={20} className="mx-1 text-gray-300 dark:text-dark-600 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-4">
        {stages.map((stage) => {
          const stagePeople = activePeople.filter(p => p.status === stage.status);

          return (
            <div key={stage.status} className="flex flex-col">
              {/* Column Header */}
              <div className={`p-3 rounded-t-xl ${stage.bgColor} border-t border-l border-r ${stage.borderColor}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold ${stage.color}`}>{stage.label}</h3>
                  <span className={`text-sm font-medium ${stage.color} opacity-70`}>
                    {stagePeople.length}
                  </span>
                </div>
              </div>

              {/* Column Content */}
              <div className={`flex-1 min-h-[400px] p-2 bg-gray-50 dark:bg-dark-800/50 rounded-b-xl border border-t-0 ${stage.borderColor} space-y-2`}>
                {stagePeople.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-dark-500">
                    <User size={24} className="mb-2 opacity-50" />
                    <p className="text-xs">No {stage.label.toLowerCase()}</p>
                  </div>
                ) : (
                  stagePeople.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => onViewPerson(person.id)}
                      className="w-full p-3 bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 bg-gradient-to-br ${avatarGradients[person.status]} rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0`}>
                          {person.firstName[0]}{person.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-dark-100 text-sm truncate">
                            {person.firstName} {person.lastName}
                          </p>
                          {person.firstVisit && person.status === 'visitor' && (
                            <p className="text-xs text-gray-500 dark:text-dark-400 truncate">
                              First visit: {formatLocalDate(person.firstVisit)}
                            </p>
                          )}
                          {person.joinDate && person.status === 'member' && (
                            <p className="text-xs text-gray-500 dark:text-dark-400 truncate">
                              Joined: {formatLocalDate(person.joinDate)}
                            </p>
                          )}
                        </div>
                      </div>
                      {person.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {person.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                          {person.tags.length > 2 && (
                            <span className="text-xs text-gray-400">+{person.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
