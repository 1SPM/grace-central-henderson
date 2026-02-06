import { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  Check,
  X,
  Repeat,
  CalendarDays,
  UserPlus,
  AlertCircle,
  Search,
  Filter,
  Settings2,
} from 'lucide-react';
import type { CalendarEvent, Person, RecurrenceType } from '../types';

interface Registration {
  id: string;
  eventId: string;
  personId: string;
  status: 'registered' | 'waitlist' | 'cancelled';
  registeredAt: string;
  guestCount: number;
  notes?: string;
}

interface EventRegistrationProps {
  events: CalendarEvent[];
  people: Person[];
  onAddEvent?: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
  onUpdateEvent?: (eventId: string, updates: Partial<CalendarEvent>) => Promise<void>;
  onDeleteEvent?: (eventId: string) => Promise<void>;
  onViewPerson?: (personId: string) => void;
  onBack?: () => void;
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const CATEGORY_OPTIONS: { value: CalendarEvent['category']; label: string; color: string }[] = [
  { value: 'service', label: 'Service', color: 'bg-indigo-500' },
  { value: 'meeting', label: 'Meeting', color: 'bg-amber-500' },
  { value: 'event', label: 'Event', color: 'bg-green-500' },
  { value: 'small-group', label: 'Small Group', color: 'bg-purple-500' },
  { value: 'holiday', label: 'Holiday', color: 'bg-rose-500' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' },
];

// Generate recurring event instances
function generateRecurringInstances(
  event: CalendarEvent,
  fromDate: Date,
  toDate: Date
): CalendarEvent[] {
  if (!event.recurrence || event.recurrence === 'none') {
    return [event];
  }

  const instances: CalendarEvent[] = [];
  const startDate = new Date(event.startDate);
  const endDate = event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : toDate;

  const currentDate = new Date(startDate);
  let instanceIndex = 0;

  while (currentDate <= endDate && currentDate <= toDate) {
    if (currentDate >= fromDate) {
      instances.push({
        ...event,
        id: `${event.id}_${instanceIndex}`,
        startDate: currentDate.toISOString(),
        seriesId: event.id,
      });
    }

    // Move to next occurrence
    switch (event.recurrence) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'biweekly':
        currentDate.setDate(currentDate.getDate() + 14);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'quarterly':
        currentDate.setMonth(currentDate.getMonth() + 3);
        break;
    }
    instanceIndex++;
  }

  return instances;
}

export function EventRegistration({
  events,
  people,
  onAddEvent,
  // onUpdateEvent and onDeleteEvent will be used for edit/delete functionality
  onViewPerson,
}: EventRegistrationProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<CalendarEvent['category'] | 'all'>('all');
  const [showPastEvents, setShowPastEvents] = useState(false);

  // Demo registrations state
  const [registrations, setRegistrations] = useState<Registration[]>([]);

  // Event form state
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '10:00',
    endDate: '',
    endTime: '11:00',
    allDay: false,
    location: '',
    category: 'event' as CalendarEvent['category'],
    recurrence: 'none' as RecurrenceType,
    recurrenceEndDate: '',
    capacity: '',
    registrationDeadline: '',
    requiresRegistration: true,
  });

  // Generate event instances for the next 3 months
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const threeMonthsLater = new Date(now);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    const allInstances: CalendarEvent[] = [];

    events.forEach(event => {
      const instances = generateRecurringInstances(event, now, threeMonthsLater);
      allInstances.push(...instances);
    });

    // Sort by date
    return allInstances.sort((a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = upcomingEvents;

    // Filter by past/upcoming
    if (!showPastEvents) {
      const now = new Date();
      filtered = filtered.filter(e => new Date(e.startDate) >= now);
    }

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter(e => e.category === filterCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        e.location?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [upcomingEvents, showPastEvents, filterCategory, searchQuery]);

  // Get registrations for an event
  const getEventRegistrations = (eventId: string) => {
    const seriesId = eventId.includes('_') ? eventId.split('_')[0] : eventId;
    return registrations.filter(r =>
      r.eventId === eventId || r.eventId === seriesId
    );
  };

  // Handle event creation
  const handleCreateEvent = async () => {
    if (!eventForm.title || !eventForm.startDate) return;

    const startDateTime = eventForm.allDay
      ? eventForm.startDate
      : `${eventForm.startDate}T${eventForm.startTime}:00`;

    const endDateTime = eventForm.endDate
      ? eventForm.allDay
        ? eventForm.endDate
        : `${eventForm.endDate}T${eventForm.endTime}:00`
      : undefined;

    const newEvent: Omit<CalendarEvent, 'id'> = {
      title: eventForm.title,
      description: eventForm.description || undefined,
      startDate: startDateTime,
      endDate: endDateTime,
      allDay: eventForm.allDay,
      location: eventForm.location || undefined,
      category: eventForm.category,
      recurrence: eventForm.recurrence,
      recurrenceEndDate: eventForm.recurrenceEndDate || undefined,
      capacity: eventForm.capacity ? parseInt(eventForm.capacity) : undefined,
      registrationDeadline: eventForm.registrationDeadline || undefined,
      requiresRegistration: eventForm.requiresRegistration,
    };

    if (onAddEvent) {
      await onAddEvent(newEvent);
    }

    // Reset form
    setEventForm({
      title: '',
      description: '',
      startDate: '',
      startTime: '10:00',
      endDate: '',
      endTime: '11:00',
      allDay: false,
      location: '',
      category: 'event',
      recurrence: 'none',
      recurrenceEndDate: '',
      capacity: '',
      registrationDeadline: '',
      requiresRegistration: true,
    });
    setShowCreateModal(false);
  };

  // Handle registration
  const handleRegister = (personId: string, guestCount: number = 0) => {
    if (!selectedEvent) return;

    const newRegistration: Registration = {
      id: `reg_${Date.now()}`,
      eventId: selectedEvent.id,
      personId,
      status: 'registered',
      registeredAt: new Date().toISOString(),
      guestCount,
    };

    setRegistrations(prev => [...prev, newRegistration]);
  };

  // Cancel registration
  const handleCancelRegistration = (registrationId: string) => {
    setRegistrations(prev =>
      prev.map(r => r.id === registrationId ? { ...r, status: 'cancelled' as const } : r)
    );
  };

  // Format date for display
  const formatEventDate = (event: CalendarEvent) => {
    const date = new Date(event.startDate);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    };

    if (!event.allDay) {
      options.hour = 'numeric';
      options.minute = '2-digit';
    }

    return date.toLocaleString('en-US', options);
  };

  // Get category color
  const getCategoryColor = (category: CalendarEvent['category']) => {
    const cat = CATEGORY_OPTIONS.find(c => c.value === category);
    return cat?.color || 'bg-gray-500';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Event Registration</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            {filteredEvents.length} upcoming events
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-medium"
        >
          <Plus size={18} />
          Create Event
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as CalendarEvent['category'] | 'all')}
            className="px-3 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-sm"
          >
            <option value="all">All Categories</option>
            {CATEGORY_OPTIONS.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-dark-800 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            checked={showPastEvents}
            onChange={(e) => setShowPastEvents(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
          />
          <span className="text-sm text-gray-700 dark:text-dark-300">Show past events</span>
        </label>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {filteredEvents.map(event => {
          const eventRegs = getEventRegistrations(event.id);
          const activeRegs = eventRegs.filter(r => r.status === 'registered');
          const totalGuests = activeRegs.reduce((sum, r) => sum + r.guestCount + 1, 0);
          const isAtCapacity = event.capacity !== undefined && event.capacity > 0 && totalGuests >= event.capacity;
          const isPast = new Date(event.startDate) < new Date();

          return (
            <div
              key={event.id}
              className={`bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700 p-5 hover:border-gray-300 dark:hover:border-dark-600 transition-colors ${
                isPast ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Date Badge */}
                <div className="flex-shrink-0 w-14 text-center">
                  <div className="text-sm font-medium text-gray-500 dark:text-dark-400">
                    {new Date(event.startDate).toLocaleString('en-US', { month: 'short' })}
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-dark-100">
                    {new Date(event.startDate).getDate()}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-dark-500">
                    {new Date(event.startDate).toLocaleString('en-US', { weekday: 'short' })}
                  </div>
                </div>

                {/* Event Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-dark-100">
                          {event.title}
                        </h3>
                        <span className={`w-2 h-2 rounded-full ${getCategoryColor(event.category)}`} />
                        {event.recurrence && event.recurrence !== 'none' && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-dark-400">
                            <Repeat size={12} />
                            {RECURRENCE_OPTIONS.find(r => r.value === event.recurrence)?.label}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-gray-500 dark:text-dark-400">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          {formatEventDate(event)}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin size={14} />
                            {event.location}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Registration Info */}
                    <div className="flex items-center gap-3">
                      {event.requiresRegistration && (
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-dark-300">
                            <Users size={14} />
                            {totalGuests}
                            {event.capacity && <span className="text-gray-400">/ {event.capacity}</span>}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-dark-400">
                            registered
                          </div>
                        </div>
                      )}

                      {!isPast && (
                        <button
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowRegistrationModal(true);
                          }}
                          disabled={isAtCapacity}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isAtCapacity
                              ? 'bg-gray-100 dark:bg-dark-800 text-gray-400 cursor-not-allowed'
                              : 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20'
                          }`}
                        >
                          <UserPlus size={16} />
                          {isAtCapacity ? 'Full' : 'Register'}
                        </button>
                      )}
                    </div>
                  </div>

                  {event.description && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-dark-300 line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  {/* Registered People Preview */}
                  {activeRegs.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {activeRegs.slice(0, 5).map(reg => {
                          const person = people.find(p => p.id === reg.personId);
                          if (!person) return null;
                          return person.photo ? (
                            <img
                              key={reg.id}
                              src={person.photo}
                              alt=""
                              className="w-7 h-7 rounded-full border-2 border-white dark:border-dark-850 object-cover"
                              title={`${person.firstName} ${person.lastName}`}
                            />
                          ) : (
                            <div
                              key={reg.id}
                              className="w-7 h-7 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-dark-850"
                              title={`${person.firstName} ${person.lastName}`}
                            >
                              {person.firstName[0]}{person.lastName[0]}
                            </div>
                          );
                        })}
                        {activeRegs.length > 5 && (
                          <div className="w-7 h-7 bg-gray-100 dark:bg-dark-700 rounded-full flex items-center justify-center text-gray-500 dark:text-dark-300 text-xs font-medium border-2 border-white dark:border-dark-850">
                            +{activeRegs.length - 5}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-dark-400">
                        {activeRegs.map(r => people.find(p => p.id === r.personId)?.firstName).filter(Boolean).slice(0, 3).join(', ')}
                        {activeRegs.length > 3 && ` +${activeRegs.length - 3} more`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredEvents.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700">
            <CalendarDays className="mx-auto text-gray-300 dark:text-dark-600 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100 mb-2">
              No events found
            </h3>
            <p className="text-gray-500 dark:text-dark-400 mb-6">
              {searchQuery || filterCategory !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first event to get started'}
            </p>
            {!searchQuery && filterCategory === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-medium"
              >
                <Plus size={18} />
                Create Event
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white dark:bg-dark-850 flex items-center justify-between p-5 border-b border-gray-200 dark:border-dark-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Create Event
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="e.g., Sunday Service, Youth Night"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                  Description
                </label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="Event details..."
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORY_OPTIONS.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setEventForm({ ...eventForm, category: cat.value })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        eventForm.category === cat.value
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400'
                          : 'border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${cat.color}`} />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* All Day Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={eventForm.allDay}
                  onChange={(e) => setEventForm({ ...eventForm, allDay: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-sm text-gray-700 dark:text-dark-300">All day event</span>
              </label>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800"
                    required
                  />
                </div>
                {!eventForm.allDay && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={eventForm.startTime}
                      onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800"
                    />
                  </div>
                )}
              </div>

              {/* End Date & Time (optional) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800"
                  />
                </div>
                {!eventForm.allDay && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={eventForm.endTime}
                      onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800"
                    />
                  </div>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  placeholder="e.g., Main Sanctuary, Fellowship Hall"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800"
                />
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Repeat size={14} />
                    Recurrence
                  </div>
                </label>
                <select
                  value={eventForm.recurrence}
                  onChange={(e) => setEventForm({ ...eventForm, recurrence: e.target.value as RecurrenceType })}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800"
                >
                  {RECURRENCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Recurrence End Date (if recurring) */}
              {eventForm.recurrence !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                    Repeat Until
                  </label>
                  <input
                    type="date"
                    value={eventForm.recurrenceEndDate}
                    onChange={(e) => setEventForm({ ...eventForm, recurrenceEndDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800"
                  />
                  <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                    Leave empty for no end date
                  </p>
                </div>
              )}

              {/* Registration Settings */}
              <div className="pt-4 border-t border-gray-200 dark:border-dark-700">
                <div className="flex items-center gap-2 mb-3">
                  <Settings2 size={16} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-dark-300">
                    Registration Settings
                  </span>
                </div>

                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={eventForm.requiresRegistration}
                    onChange={(e) => setEventForm({ ...eventForm, requiresRegistration: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-dark-300">Require registration</span>
                </label>

                {eventForm.requiresRegistration && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                        Capacity
                      </label>
                      <input
                        type="number"
                        value={eventForm.capacity}
                        onChange={(e) => setEventForm({ ...eventForm, capacity: e.target.value })}
                        placeholder="Unlimited"
                        min="1"
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                        Registration Deadline
                      </label>
                      <input
                        type="date"
                        value={eventForm.registrationDeadline}
                        onChange={(e) => setEventForm({ ...eventForm, registrationDeadline: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 bg-white dark:bg-dark-850 p-5 border-t border-gray-200 dark:border-dark-700 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={!eventForm.title || !eventForm.startDate}
                className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check size={18} />
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Registration Modal */}
      {showRegistrationModal && selectedEvent && (
        <RegistrationModal
          event={selectedEvent}
          people={people}
          registrations={getEventRegistrations(selectedEvent.id)}
          onClose={() => {
            setShowRegistrationModal(false);
            setSelectedEvent(null);
          }}
          onRegister={handleRegister}
          onCancelRegistration={handleCancelRegistration}
          onViewPerson={onViewPerson}
        />
      )}
    </div>
  );
}

// Registration Modal Component
interface RegistrationModalProps {
  event: CalendarEvent;
  people: Person[];
  registrations: Registration[];
  onClose: () => void;
  onRegister: (personId: string, guestCount?: number) => void;
  onCancelRegistration: (registrationId: string) => void;
  onViewPerson?: (personId: string) => void;
}

function RegistrationModal({
  event,
  people,
  registrations,
  onClose,
  onRegister,
  onCancelRegistration,
  onViewPerson,
}: RegistrationModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [guestCount, setGuestCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'register' | 'list'>('list');

  const activeRegs = registrations.filter(r => r.status === 'registered');
  const totalGuests = activeRegs.reduce((sum, r) => sum + r.guestCount + 1, 0);
  const remainingCapacity = event.capacity ? event.capacity - totalGuests : null;

  // People who haven't registered
  const registeredIds = activeRegs.map(r => r.personId);
  const availablePeople = people.filter(p => !registeredIds.includes(p.id));

  // Filter available people
  const filteredPeople = searchQuery
    ? availablePeople.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availablePeople;

  const handleRegister = () => {
    if (!selectedPersonId) return;
    onRegister(selectedPersonId, guestCount);
    setSelectedPersonId('');
    setGuestCount(0);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
              {event.title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-dark-400">
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              {new Date(event.startDate).toLocaleDateString()}
            </div>
            {event.location && (
              <div className="flex items-center gap-1">
                <MapPin size={14} />
                {event.location}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Users size={14} />
              {totalGuests} registered
              {event.capacity && <span> / {event.capacity} capacity</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-dark-700">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'list'
                ? 'text-violet-600 border-b-2 border-violet-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Registrations ({activeRegs.length})
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'register'
                ? 'text-violet-600 border-b-2 border-violet-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Add Registration
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'list' ? (
            <div className="space-y-2">
              {activeRegs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-dark-400">
                  <Users className="mx-auto mb-2 text-gray-300 dark:text-dark-600" size={32} />
                  <p>No registrations yet</p>
                </div>
              ) : (
                activeRegs.map(reg => {
                  const person = people.find(p => p.id === reg.personId);
                  if (!person) return null;
                  return (
                    <div
                      key={reg.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-800 rounded-xl"
                    >
                      {person.photo ? (
                        <img src={person.photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {person.firstName[0]}{person.lastName[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => onViewPerson?.(person.id)}
                          className="font-medium text-gray-900 dark:text-dark-100 hover:text-violet-600 text-left"
                        >
                          {person.firstName} {person.lastName}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-dark-400">
                          {reg.guestCount > 0 ? `+${reg.guestCount} guest${reg.guestCount > 1 ? 's' : ''}` : 'No guests'}
                          {' · '}
                          {new Date(reg.registeredAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => onCancelRegistration(reg.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Cancel registration"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {remainingCapacity !== null && remainingCapacity <= 0 ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
                  <AlertCircle className="text-amber-500 mt-0.5" size={16} />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    This event is at full capacity.
                  </p>
                </div>
              ) : (
                <>
                  {/* Person Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                      Select Person
                    </label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name..."
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-sm"
                      />
                    </div>
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-dark-600 rounded-xl">
                      {filteredPeople.slice(0, 10).map(person => (
                        <button
                          key={person.id}
                          onClick={() => setSelectedPersonId(person.id)}
                          className={`w-full flex items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors text-left ${
                            selectedPersonId === person.id ? 'bg-violet-50 dark:bg-violet-500/10' : ''
                          }`}
                        >
                          {person.photo ? (
                            <img src={person.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                              {person.firstName[0]}{person.lastName[0]}
                            </div>
                          )}
                          <span className="text-sm text-gray-900 dark:text-dark-100">
                            {person.firstName} {person.lastName}
                          </span>
                          {selectedPersonId === person.id && (
                            <Check size={16} className="ml-auto text-violet-600" />
                          )}
                        </button>
                      ))}
                      {filteredPeople.length === 0 && (
                        <p className="p-4 text-sm text-gray-500 text-center">
                          {searchQuery ? 'No matching people' : 'All members already registered'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Guest Count */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1.5">
                      Additional Guests
                    </label>
                    <input
                      type="number"
                      value={guestCount}
                      onChange={(e) => setGuestCount(Math.max(0, parseInt(e.target.value) || 0))}
                      min={0}
                      max={remainingCapacity !== null ? Math.max(0, remainingCapacity - 1) : 10}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800"
                    />
                    <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                      Number of guests coming with this person
                    </p>
                  </div>

                  <button
                    onClick={handleRegister}
                    disabled={!selectedPersonId}
                    className="w-full py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <UserPlus size={18} />
                    Register
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
