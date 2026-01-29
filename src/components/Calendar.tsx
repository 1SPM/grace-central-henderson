import { useState, useMemo, useCallback } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Users, Check, X, HelpCircle, Plus, Trash2, Edit2 } from 'lucide-react';
import { CalendarEvent, Person } from '../types';

interface RSVP {
  eventId: string;
  personId: string;
  status: 'yes' | 'no' | 'maybe';
  guestCount: number;
}

type EventCategory = CalendarEvent['category'];

interface CalendarProps {
  events: CalendarEvent[];
  people: Person[];
  rsvps: RSVP[];
  onRSVP: (eventId: string, personId: string, status: RSVP['status'], guestCount?: number) => void;
  onAddEvent?: (event: {
    title: string;
    description?: string;
    startDate: string;
    endDate?: string;
    allDay: boolean;
    location?: string;
    category: EventCategory;
  }) => void;
  onUpdateEvent?: (eventId: string, updates: Partial<CalendarEvent>) => void;
  onDeleteEvent?: (eventId: string) => void;
}

const categoryColors: Record<string, string> = {
  service: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
  meeting: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  event: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20',
  'small-group': 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
  other: 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300 border-gray-200 dark:border-dark-600'
};

export function Calendar({ events, people, rsvps, onRSVP, onAddEvent, onUpdateEvent, onDeleteEvent }: CalendarProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showRSVPModal, setShowRSVPModal] = useState(false);
  const [rsvpPersonId, setRsvpPersonId] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<RSVP['status']>('yes');
  const [rsvpGuests, setRsvpGuests] = useState(0);

  // Event form state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    allDay: false,
    location: '',
    category: 'event' as EventCategory,
  });

  const resetEventForm = useCallback(() => {
    setEventForm({
      title: '',
      description: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      allDay: false,
      location: '',
      category: 'event',
    });
    setEditingEvent(null);
  }, []);

  const openCreateEventModal = useCallback(() => {
    resetEventForm();
    // Default to tomorrow at 10am
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setEventForm(prev => ({
      ...prev,
      startDate: tomorrow.toISOString().split('T')[0],
      startTime: '10:00',
    }));
    setShowEventModal(true);
  }, [resetEventForm]);

  const openEditEventModal = useCallback((event: CalendarEvent) => {
    const startDate = new Date(event.startDate);
    const endDate = event.endDate ? new Date(event.endDate) : null;
    setEventForm({
      title: event.title,
      description: event.description || '',
      startDate: startDate.toISOString().split('T')[0],
      startTime: startDate.toTimeString().slice(0, 5),
      endDate: endDate ? endDate.toISOString().split('T')[0] : '',
      endTime: endDate ? endDate.toTimeString().slice(0, 5) : '',
      allDay: event.allDay,
      location: event.location || '',
      category: event.category,
    });
    setEditingEvent(event);
    setShowEventModal(true);
  }, []);

  const handleSaveEvent = useCallback(() => {
    if (!eventForm.title || !eventForm.startDate) return;

    const startDateTime = eventForm.allDay
      ? `${eventForm.startDate}T00:00:00`
      : `${eventForm.startDate}T${eventForm.startTime || '00:00'}:00`;

    const endDateTime = eventForm.endDate
      ? (eventForm.allDay
          ? `${eventForm.endDate}T23:59:59`
          : `${eventForm.endDate}T${eventForm.endTime || '23:59'}:00`)
      : undefined;

    if (editingEvent && onUpdateEvent) {
      onUpdateEvent(editingEvent.id, {
        title: eventForm.title,
        description: eventForm.description || undefined,
        startDate: startDateTime,
        endDate: endDateTime,
        allDay: eventForm.allDay,
        location: eventForm.location || undefined,
        category: eventForm.category,
      });
    } else if (onAddEvent) {
      onAddEvent({
        title: eventForm.title,
        description: eventForm.description || undefined,
        startDate: startDateTime,
        endDate: endDateTime,
        allDay: eventForm.allDay,
        location: eventForm.location || undefined,
        category: eventForm.category,
      });
    }

    setShowEventModal(false);
    resetEventForm();
  }, [eventForm, editingEvent, onAddEvent, onUpdateEvent, resetEventForm]);

  const handleDeleteEvent = useCallback((eventId: string) => {
    if (onDeleteEvent && confirm('Are you sure you want to delete this event?')) {
      onDeleteEvent(eventId);
    }
  }, [onDeleteEvent]);

  // Memoize sorted and grouped events
  const groupedEvents = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    const grouped: Record<string, CalendarEvent[]> = {};
    sorted.forEach((event) => {
      const date = new Date(event.startDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(event);
    });
    return grouped;
  }, [events]);

  // Memoize RSVP lookup by event ID
  const rsvpsByEvent = useMemo(() => {
    const map = new Map<string, RSVP[]>();
    rsvps.forEach(r => {
      const existing = map.get(r.eventId) || [];
      existing.push(r);
      map.set(r.eventId, existing);
    });
    return map;
  }, [rsvps]);

  // Get RSVP counts for an event (O(1) lookup)
  const getRSVPCounts = useCallback((eventId: string) => {
    const eventRsvps = rsvpsByEvent.get(eventId) || [];
    let yesCount = 0, noCount = 0, maybeCount = 0, totalAttending = 0;
    eventRsvps.forEach(r => {
      if (r.status === 'yes') {
        yesCount++;
        totalAttending += 1 + r.guestCount;
      } else if (r.status === 'no') {
        noCount++;
      } else {
        maybeCount++;
      }
    });
    return { yes: yesCount, no: noCount, maybe: maybeCount, totalAttending };
  }, [rsvpsByEvent]);

  const handleRSVP = useCallback(() => {
    if (!selectedEvent || !rsvpPersonId) return;
    onRSVP(selectedEvent.id, rsvpPersonId, rsvpStatus, rsvpGuests);
    setShowRSVPModal(false);
    setSelectedEvent(null);
    setRsvpPersonId('');
    setRsvpStatus('yes');
    setRsvpGuests(0);
  }, [selectedEvent, rsvpPersonId, rsvpStatus, rsvpGuests, onRSVP]);

  const openRSVPModal = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowRSVPModal(true);
  }, []);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Calendar</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">Upcoming events and services</p>
        </div>
        {onAddEvent && (
          <button
            onClick={openCreateEventModal}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 flex items-center gap-2"
          >
            <Plus size={18} />
            Create Event
          </button>
        )}
      </div>

      <div className="space-y-6">
        {Object.entries(groupedEvents).map(([date, dateEvents]) => (
          <div key={date}>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-dark-400 mb-3">{date}</h2>
            <div className="space-y-3">
              {dateEvents.map((event) => {
                const counts = getRSVPCounts(event.id);
                return (
                  <div
                    key={event.id}
                    className={`rounded-xl border p-4 ${categoryColors[event.category]}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{event.title}</h3>
                        {event.description && (
                          <p className="text-sm opacity-75 mt-1">{event.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-white/50 dark:bg-white/10">
                          {event.category}
                        </span>
                        {(onUpdateEvent || onDeleteEvent) && (
                          <div className="flex items-center gap-1 ml-2">
                            {onUpdateEvent && (
                              <button
                                onClick={() => openEditEventModal(event)}
                                className="p-1.5 rounded-lg bg-white/30 dark:bg-white/10 hover:bg-white/50 dark:hover:bg-white/20 transition-colors"
                                title="Edit event"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {onDeleteEvent && (
                              <button
                                onClick={() => handleDeleteEvent(event.id)}
                                className="p-1.5 rounded-lg bg-white/30 dark:bg-white/10 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                title="Delete event"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm opacity-75">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(event.startDate).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                        {event.endDate && (
                          <> - {new Date(event.endDate).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}</>
                        )}
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1">
                          <MapPin size={14} />
                          {event.location}
                        </div>
                      )}
                    </div>

                    {/* RSVP Section */}
                    <div className="mt-4 pt-4 border-t border-current/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <Users size={14} />
                            <span className="text-sm font-medium">{counts.totalAttending} attending</span>
                          </div>
                          {counts.yes > 0 && (
                            <span className="text-xs flex items-center gap-1">
                              <Check size={12} className="text-green-600" /> {counts.yes}
                            </span>
                          )}
                          {counts.maybe > 0 && (
                            <span className="text-xs flex items-center gap-1">
                              <HelpCircle size={12} className="text-amber-600" /> {counts.maybe}
                            </span>
                          )}
                          {counts.no > 0 && (
                            <span className="text-xs flex items-center gap-1">
                              <X size={12} className="text-red-600" /> {counts.no}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => openRSVPModal(event)}
                          className="px-3 py-1.5 bg-white/50 dark:bg-white/10 hover:bg-white/70 dark:hover:bg-white/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                        >
                          <Plus size={12} />
                          Add RSVP
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-dark-850 rounded-2xl border border-gray-200 dark:border-dark-700">
          <CalendarIcon className="mx-auto text-gray-300 dark:text-dark-600 mb-3" size={48} />
          <p className="text-gray-400 dark:text-dark-400">No upcoming events</p>
        </div>
      )}

      {/* RSVP Modal */}
      {showRSVPModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                RSVP for {selectedEvent.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                {new Date(selectedEvent.startDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Person
                </label>
                <select
                  value={rsvpPersonId}
                  onChange={(e) => setRsvpPersonId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  <option value="">Select a person</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.firstName} {person.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                  Response
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'yes', label: 'Yes', icon: Check, color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30' },
                    { value: 'maybe', label: 'Maybe', icon: HelpCircle, color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30' },
                    { value: 'no', label: 'No', icon: X, color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30' },
                  ].map(({ value, label, icon: Icon, color }) => (
                    <button
                      key={value}
                      onClick={() => setRsvpStatus(value as RSVP['status'])}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                        rsvpStatus === value
                          ? color
                          : 'bg-gray-50 dark:bg-dark-800 text-gray-500 dark:text-dark-400 border-gray-200 dark:border-dark-600'
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {rsvpStatus === 'yes' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    Additional Guests
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={rsvpGuests}
                    onChange={(e) => setRsvpGuests(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-3">
              <button
                onClick={() => {
                  setShowRSVPModal(false);
                  setSelectedEvent(null);
                }}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleRSVP}
                disabled={!rsvpPersonId}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Submit RSVP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Create/Edit Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                {editingEvent ? 'Edit Event' : 'Create Event'}
              </h2>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter event title"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Description
                </label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter event description"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Category
                </label>
                <select
                  value={eventForm.category}
                  onChange={(e) => setEventForm(prev => ({ ...prev, category: e.target.value as EventCategory }))}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  <option value="service">Service</option>
                  <option value="meeting">Meeting</option>
                  <option value="event">Event</option>
                  <option value="small-group">Small Group</option>
                  <option value="holiday">Holiday</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDay"
                  checked={eventForm.allDay}
                  onChange={(e) => setEventForm(prev => ({ ...prev, allDay: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-indigo-600"
                />
                <label htmlFor="allDay" className="text-sm text-gray-700 dark:text-dark-300">
                  All day event
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  />
                </div>
                {!eventForm.allDay && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={eventForm.startTime}
                      onChange={(e) => setEventForm(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                  />
                </div>
                {!eventForm.allDay && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={eventForm.endTime}
                      onChange={(e) => setEventForm(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={eventForm.location}
                  onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Enter location"
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex gap-3">
              <button
                onClick={() => {
                  setShowEventModal(false);
                  resetEventForm();
                }}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEvent}
                disabled={!eventForm.title || !eventForm.startDate}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {editingEvent ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
