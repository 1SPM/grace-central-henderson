import { useState, useMemo } from 'react';
import {
  Search,
  UserCheck,
  Users,
  Clock,
  Calendar,
  ChevronDown,
  CheckCircle2,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import type { Person, Attendance } from '../types';

interface AttendanceCheckInProps {
  people: Person[];
  attendance: Attendance[];
  onCheckIn: (personId: string, eventType: Attendance['eventType'], eventName?: string) => void;
}

type EventType = Attendance['eventType'];

const eventTypeLabels: Record<EventType, string> = {
  sunday: 'Sunday Service',
  wednesday: 'Wednesday Service',
  'small-group': 'Small Group',
  special: 'Special Event',
};

const eventTypeColors: Record<EventType, string> = {
  sunday: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  wednesday: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  'small-group': 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  special: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
};

export function AttendanceCheckIn({ people, attendance, onCheckIn }: AttendanceCheckInProps) {
  const [search, setSearch] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<EventType>('sunday');
  const [eventName, setEventName] = useState('');
  const [showEventDropdown, setShowEventDropdown] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Get today's check-ins for the selected event type
  const todaysCheckIns = useMemo(() => {
    return attendance.filter(
      (a) => a.date === today && a.eventType === selectedEventType
    );
  }, [attendance, today, selectedEventType]);

  const checkedInIds = new Set(todaysCheckIns.map((a) => a.personId));

  // Filter people by search
  const filteredPeople = useMemo(() => {
    if (!search.trim()) return [];
    const searchLower = search.toLowerCase();
    return people
      .filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchLower) ||
          p.email.toLowerCase().includes(searchLower) ||
          p.phone.includes(search)
      )
      .slice(0, 10);
  }, [people, search]);

  // Recently checked in (last 10)
  const recentCheckIns = useMemo(() => {
    return todaysCheckIns
      .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime())
      .slice(0, 10)
      .map((a) => ({
        ...a,
        person: people.find((p) => p.id === a.personId),
      }));
  }, [todaysCheckIns, people]);

  // Stats
  const stats = useMemo(() => {
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisWeekStr = thisWeek.toISOString().split('T')[0];

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 14);
    const lastWeekStr = lastWeek.toISOString().split('T')[0];

    const thisWeekCount = attendance.filter(
      (a) => a.date >= thisWeekStr && a.eventType === selectedEventType
    ).length;

    const lastWeekCount = attendance.filter(
      (a) => a.date >= lastWeekStr && a.date < thisWeekStr && a.eventType === selectedEventType
    ).length;

    const trend = lastWeekCount > 0 ? ((thisWeekCount - lastWeekCount) / lastWeekCount) * 100 : 0;

    return {
      today: todaysCheckIns.length,
      thisWeek: thisWeekCount,
      trend: Math.round(trend),
    };
  }, [attendance, todaysCheckIns, selectedEventType]);

  const handleCheckIn = (personId: string) => {
    if (checkedInIds.has(personId)) return;
    onCheckIn(personId, selectedEventType, eventName || undefined);
    setSearch('');
  };

  const handleQuickCheckIn = (person: Person) => {
    handleCheckIn(person.id);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Attendance</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            Check in members for today's events
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-400">
          <Calendar size={16} />
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <UserCheck className="text-indigo-600 dark:text-indigo-400" size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500 dark:text-dark-400">Today</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">{stats.today}</p>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">checked in</p>
        </div>

        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-xl flex items-center justify-center">
              <Users className="text-green-600 dark:text-green-400" size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500 dark:text-dark-400">This Week</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-dark-100">{stats.thisWeek}</p>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">total attendance</p>
        </div>

        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-amber-600 dark:text-amber-400" size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500 dark:text-dark-400">Trend</span>
          </div>
          <p className={`text-3xl font-bold ${stats.trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {stats.trend >= 0 ? '+' : ''}{stats.trend}%
          </p>
          <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">vs last week</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check-In Panel */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <UserCheck className="text-white" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-dark-100">Quick Check-In</h2>
              <p className="text-sm text-gray-500 dark:text-dark-400">Search and check in members</p>
            </div>
          </div>

          {/* Event Type Selector */}
          <div className="relative mb-4">
            <button
              onClick={() => setShowEventDropdown(!showEventDropdown)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl text-left"
            >
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${eventTypeColors[selectedEventType]}`}>
                  {eventTypeLabels[selectedEventType]}
                </span>
              </div>
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${showEventDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showEventDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-xl shadow-lg z-10 overflow-hidden">
                {(Object.keys(eventTypeLabels) as EventType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedEventType(type);
                      setShowEventDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors ${
                      selectedEventType === type ? 'bg-gray-50 dark:bg-dark-800' : ''
                    }`}
                  >
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${eventTypeColors[type]}`}>
                      {eventTypeLabels[type]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Event Name (for special events) */}
          {selectedEventType === 'special' && (
            <input
              type="text"
              placeholder="Event name (e.g., Easter Service)"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full px-4 py-3 mb-4 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          )}

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
              autoFocus
            />
          </div>

          {/* Search Results */}
          {search && (
            <div className="mt-4 space-y-2">
              {filteredPeople.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-dark-400 py-4">
                  No members found
                </p>
              ) : (
                filteredPeople.map((person) => {
                  const isCheckedIn = checkedInIds.has(person.id);
                  return (
                    <button
                      key={person.id}
                      onClick={() => handleQuickCheckIn(person)}
                      disabled={isCheckedIn}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                        isCheckedIn
                          ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 cursor-default'
                          : 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                          {person.firstName[0]}{person.lastName[0]}
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900 dark:text-dark-100">
                            {person.firstName} {person.lastName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-dark-400">{person.email}</p>
                        </div>
                      </div>
                      {isCheckedIn ? (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle2 size={20} />
                          <span className="text-sm font-medium">Checked In</span>
                        </div>
                      ) : (
                        <div className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
                          Check In
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Recent Check-Ins */}
        <div className="bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-xl flex items-center justify-center">
              <Clock className="text-green-600 dark:text-green-400" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-dark-100">Recent Check-Ins</h2>
              <p className="text-sm text-gray-500 dark:text-dark-400">Today's attendance for {eventTypeLabels[selectedEventType]}</p>
            </div>
          </div>

          {recentCheckIns.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="mx-auto text-gray-300 dark:text-dark-600 mb-3" size={40} />
              <p className="text-gray-500 dark:text-dark-400">No check-ins yet today</p>
              <p className="text-sm text-gray-400 dark:text-dark-500 mt-1">
                Search for a member to check them in
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCheckIns.map((checkIn) => (
                <div
                  key={checkIn.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-800 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {checkIn.person?.firstName[0]}{checkIn.person?.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-dark-100 text-sm">
                        {checkIn.person?.firstName} {checkIn.person?.lastName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        {new Date(checkIn.checkedInAt).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 size={18} className="text-green-500" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weekly Attendance Chart */}
      <div className="mt-6 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/20 rounded-xl flex items-center justify-center">
            <BarChart3 className="text-purple-600 dark:text-purple-400" size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-dark-100">Weekly Overview</h2>
            <p className="text-sm text-gray-500 dark:text-dark-400">Attendance for the past 7 days</p>
          </div>
        </div>

        <WeeklyChart attendance={attendance} selectedEventType={selectedEventType} />
      </div>
    </div>
  );
}

// Weekly Chart Component
function WeeklyChart({ attendance, selectedEventType }: { attendance: Attendance[]; selectedEventType: EventType }) {
  const days = useMemo(() => {
    const result = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = attendance.filter(
        (a) => a.date === dateStr && a.eventType === selectedEventType
      ).length;

      result.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
        isToday: i === 0,
      });
    }

    return result;
  }, [attendance, selectedEventType]);

  const maxCount = Math.max(...days.map((d) => d.count), 1);

  return (
    <div className="flex items-end justify-between gap-2 h-48">
      {days.map((day, index) => (
        <div key={index} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full flex flex-col items-center justify-end h-32">
            <span className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-1">
              {day.count}
            </span>
            <div
              className={`w-full rounded-t-lg transition-all ${
                day.isToday
                  ? 'bg-gradient-to-t from-indigo-500 to-purple-500'
                  : 'bg-gray-200 dark:bg-dark-700'
              }`}
              style={{
                height: `${Math.max((day.count / maxCount) * 100, 8)}%`,
                minHeight: '8px',
              }}
            />
          </div>
          <div className="text-center">
            <p className={`text-xs font-medium ${day.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-dark-300'}`}>
              {day.day}
            </p>
            <p className="text-xs text-gray-400 dark:text-dark-500">{day.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
