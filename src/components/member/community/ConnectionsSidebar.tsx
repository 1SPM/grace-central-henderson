import { UserPlus, Users, Calendar } from 'lucide-react';
import type { MemberConnectionRequest, Person, SmallGroup, CalendarEvent } from '../../../types';

interface ConnectionsSidebarProps {
  people: Person[];
  connections: Array<{ personAId: string; personBId: string }>;
  requests: MemberConnectionRequest[];
  groups: SmallGroup[];
  events: CalendarEvent[];
  currentPersonId?: string;
  onAcceptRequest: (requestId: string) => void;
}

function getActivePeople(people: Person[], limit = 5): Person[] {
  return people
    .filter(p => p.status === 'member' || p.status === 'regular' || p.status === 'leader')
    .slice(0, limit);
}

export function ConnectionsSidebar({
  people,
  connections,
  requests,
  groups,
  events,
  currentPersonId,
  onAcceptRequest,
}: ConnectionsSidebarProps) {
  const activePeople = getActivePeople(people);
  const upcomingEvents = events
    .filter(e => new Date(e.startDate) >= new Date())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 3);

  const myRequests = currentPersonId
    ? requests.filter(r => r.toPersonId === currentPersonId)
    : requests;

  return (
    <div className="space-y-4">
      {/* Active now */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-400 mb-3">
          Active now
        </h3>
        <div className="flex -space-x-2">
          {activePeople.map(p => (
            p.photo ? (
              <img
                key={p.id}
                src={p.photo}
                alt={`${p.firstName} ${p.lastName}`}
                title={`${p.firstName} ${p.lastName}`}
                className="w-9 h-9 rounded-full border-2 border-white dark:border-dark-850 object-cover"
              />
            ) : (
              <div
                key={p.id}
                title={`${p.firstName} ${p.lastName}`}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-slate-500 border-2 border-white dark:border-dark-850 flex items-center justify-center text-white text-xs font-medium"
              >
                {p.firstName[0]}{p.lastName[0]}
              </div>
            )
          ))}
        </div>
      </div>

      {/* Connection requests */}
      {myRequests.length > 0 && (
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-400 mb-3">
            Connection requests
          </h3>
          <div className="space-y-3">
            {myRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 text-xs font-medium shrink-0">
                    {(req.fromName ?? 'M').charAt(0)}
                  </div>
                  <span className="text-sm text-gray-800 dark:text-dark-200 truncate">{req.fromName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onAcceptRequest(req.id)}
                  className="shrink-0 px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Groups & Events */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-400 mb-3">
          Groups &amp; Events
        </h3>
        <div className="space-y-2">
          {groups.filter(g => g.isActive).slice(0, 3).map(g => (
            <div key={g.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-dark-200">
              <Users size={14} className="text-indigo-500 shrink-0" />
              <span className="truncate">{g.name}</span>
              <span className="text-xs text-gray-400 ml-auto">{g.members.length}</span>
            </div>
          ))}
          {upcomingEvents.map(e => (
            <div key={e.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-dark-200">
              <Calendar size={14} className="text-green-500 shrink-0" />
              <span className="truncate">{e.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* People count */}
      <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-4">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-indigo-500" />
          <span className="text-sm font-medium text-gray-800 dark:text-dark-200">
            {connections.length} connected
          </span>
        </div>
      </div>
    </div>
  );
}
