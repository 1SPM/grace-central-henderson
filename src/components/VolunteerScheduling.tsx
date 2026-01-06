import { useState } from 'react';
import { Calendar, Plus, Check, X, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { Person, CalendarEvent } from '../types';

interface VolunteerRole {
  id: string;
  name: string;
  description?: string;
  minVolunteers: number;
  maxVolunteers: number;
  color: string;
}

interface VolunteerAssignment {
  id: string;
  eventId: string;
  roleId: string;
  personId: string;
  status: 'confirmed' | 'pending' | 'declined';
}

interface VolunteerSchedulingProps {
  people: Person[];
  events: CalendarEvent[];
  assignments: VolunteerAssignment[];
  onAssign: (eventId: string, roleId: string, personId: string) => void;
  onUpdateStatus: (assignmentId: string, status: VolunteerAssignment['status']) => void;
  onRemove: (assignmentId: string) => void;
}

// Default volunteer roles
const defaultRoles: VolunteerRole[] = [
  { id: 'greeter', name: 'Greeter', description: 'Welcome guests at the door', minVolunteers: 2, maxVolunteers: 4, color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  { id: 'usher', name: 'Usher', description: 'Help seat guests and collect offering', minVolunteers: 2, maxVolunteers: 4, color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  { id: 'worship', name: 'Worship Team', description: 'Lead worship music', minVolunteers: 3, maxVolunteers: 8, color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
  { id: 'av', name: 'A/V Tech', description: 'Run sound and projection', minVolunteers: 1, maxVolunteers: 3, color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
  { id: 'childcare', name: 'Children\'s Ministry', description: 'Lead children\'s programs', minVolunteers: 2, maxVolunteers: 6, color: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400' },
  { id: 'parking', name: 'Parking Team', description: 'Direct traffic and parking', minVolunteers: 1, maxVolunteers: 3, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
  { id: 'hospitality', name: 'Hospitality', description: 'Prepare refreshments', minVolunteers: 2, maxVolunteers: 4, color: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400' },
];

export function VolunteerScheduling({
  people,
  events,
  assignments,
  onAssign,
  onUpdateStatus: _onUpdateStatus,
  onRemove,
}: VolunteerSchedulingProps) {
  // Note: _onUpdateStatus is available for future use to confirm/decline volunteer assignments
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignRole, setAssignRole] = useState<string>('');
  const [assignPerson, setAssignPerson] = useState<string>('');
  const [weekOffset, setWeekOffset] = useState(0);

  // Get start of current week
  const getWeekStart = (offset: number) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek + (offset * 7));
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const weekStart = getWeekStart(weekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // Filter events for the selected week
  const weekEvents = events.filter((event) => {
    const eventDate = new Date(event.startDate);
    return eventDate >= weekStart && eventDate <= weekEnd;
  }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const getEventAssignments = (eventId: string) => {
    return assignments.filter((a) => a.eventId === eventId);
  };

  const getRoleAssignments = (eventId: string, roleId: string) => {
    return assignments.filter((a) => a.eventId === eventId && a.roleId === roleId);
  };

  const getAvailableVolunteers = (_roleId: string, eventId: string) => {
    const currentAssignments = assignments
      .filter((a) => a.eventId === eventId)
      .map((a) => a.personId);
    return people.filter(
      (p) => !currentAssignments.includes(p.id) && (p.status === 'member' || p.status === 'leader')
    );
  };

  const handleAssign = () => {
    if (!selectedEvent || !assignRole || !assignPerson) return;
    onAssign(selectedEvent.id, assignRole, assignPerson);
    setShowAssignModal(false);
    setAssignRole('');
    setAssignPerson('');
  };

  const openAssignModal = (event: CalendarEvent, roleId?: string) => {
    setSelectedEvent(event);
    setAssignRole(roleId || '');
    setShowAssignModal(true);
  };

  const formatWeekRange = () => {
    const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
    const startDay = weekStart.getDate();
    const endDay = weekEnd.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  };

  const getStatusIcon = (status: VolunteerAssignment['status']) => {
    switch (status) {
      case 'confirmed':
        return <Check size={12} className="text-green-600" />;
      case 'declined':
        return <X size={12} className="text-red-600" />;
      default:
        return <Clock size={12} className="text-amber-600" />;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Volunteer Scheduling</h1>
        <p className="text-gray-500 dark:text-dark-400 mt-1">Manage volunteer assignments for services and events</p>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6 bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
        <button
          onClick={() => setWeekOffset((prev) => prev - 1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ChevronLeft size={20} className="text-gray-600 dark:text-dark-400" />
        </button>
        <div className="text-center">
          <p className="font-semibold text-gray-900 dark:text-dark-100">{formatWeekRange()}</p>
          <p className="text-sm text-gray-500 dark:text-dark-400">
            {weekOffset === 0 ? 'This Week' : weekOffset > 0 ? `${weekOffset} week${weekOffset > 1 ? 's' : ''} ahead` : `${Math.abs(weekOffset)} week${Math.abs(weekOffset) > 1 ? 's' : ''} ago`}
          </p>
        </div>
        <button
          onClick={() => setWeekOffset((prev) => prev + 1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ChevronRight size={20} className="text-gray-600 dark:text-dark-400" />
        </button>
      </div>

      {/* Events and Volunteer Slots */}
      {weekEvents.length > 0 ? (
        <div className="space-y-6">
          {weekEvents.map((event) => {
            const eventAssignments = getEventAssignments(event.id);
            const totalNeeded = defaultRoles.reduce((sum, r) => sum + r.minVolunteers, 0);
            const totalAssigned = eventAssignments.length;
            const fillPercentage = Math.min((totalAssigned / totalNeeded) * 100, 100);

            return (
              <div
                key={event.id}
                className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 overflow-hidden"
              >
                {/* Event Header */}
                <div className="p-4 border-b border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-800/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-dark-100">{event.title}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-dark-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(event.startDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {new Date(event.startDate).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                        {totalAssigned}/{totalNeeded} volunteers
                      </p>
                      <div className="w-24 h-2 bg-gray-200 dark:bg-dark-700 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            fillPercentage >= 100
                              ? 'bg-green-500'
                              : fillPercentage >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${fillPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Volunteer Roles Grid */}
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {defaultRoles.map((role) => {
                      const roleAssignments = getRoleAssignments(event.id, role.id);
                      const isFull = roleAssignments.length >= role.maxVolunteers;
                      const needsMore = roleAssignments.length < role.minVolunteers;

                      return (
                        <div
                          key={role.id}
                          className={`rounded-xl border p-3 ${
                            needsMore
                              ? 'border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5'
                              : 'border-gray-200 dark:border-dark-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${role.color}`}>
                              {role.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-dark-400">
                              {roleAssignments.length}/{role.minVolunteers}-{role.maxVolunteers}
                            </span>
                          </div>

                          {/* Assigned Volunteers */}
                          <div className="space-y-1.5 mb-2">
                            {roleAssignments.map((assignment) => {
                              const person = people.find((p) => p.id === assignment.personId);
                              if (!person) return null;
                              return (
                                <div
                                  key={assignment.id}
                                  className="flex items-center justify-between text-sm bg-white dark:bg-dark-800 rounded-lg px-2 py-1.5 border border-gray-100 dark:border-dark-700"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                      {person.firstName[0]}
                                    </div>
                                    <span className="text-gray-700 dark:text-dark-300 truncate max-w-[100px]">
                                      {person.firstName} {person.lastName[0]}.
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {getStatusIcon(assignment.status)}
                                    <button
                                      onClick={() => onRemove(assignment.id)}
                                      className="p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded transition-colors"
                                    >
                                      <X size={12} className="text-gray-400" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Add Volunteer Button */}
                          {!isFull && (
                            <button
                              onClick={() => openAssignModal(event, role.id)}
                              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-gray-500 dark:text-dark-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg border border-dashed border-gray-300 dark:border-dark-600 transition-colors"
                            >
                              <Plus size={12} />
                              Add Volunteer
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700">
          <Calendar className="mx-auto text-gray-300 dark:text-dark-600 mb-3\" size={48} />
          <p className="text-gray-500 dark:text-dark-400">No events this week</p>
          <p className="text-sm text-gray-400 dark:text-dark-500 mt-1">
            Use the arrows above to navigate to other weeks
          </p>
        </div>
      )}

      {/* Assign Volunteer Modal */}
      {showAssignModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Assign Volunteer
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                {selectedEvent.title} - {new Date(selectedEvent.startDate).toLocaleDateString()}
              </p>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Role
                </label>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  <option value="">Select a role</option>
                  {defaultRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Volunteer
                </label>
                <select
                  value={assignPerson}
                  onChange={(e) => setAssignPerson(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  disabled={!assignRole}
                >
                  <option value="">Select a volunteer</option>
                  {assignRole &&
                    getAvailableVolunteers(assignRole, selectedEvent.id).map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.firstName} {person.lastName}
                      </option>
                    ))}
                </select>
                {assignRole && getAvailableVolunteers(assignRole, selectedEvent.id).length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    No available volunteers. All members are already assigned.
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setAssignRole('');
                  setAssignPerson('');
                }}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!assignRole || !assignPerson}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
