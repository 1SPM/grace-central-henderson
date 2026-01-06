import { useState } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Users, Check, X, HelpCircle, Plus } from 'lucide-react';
import { CalendarEvent, Person } from '../types';

interface RSVP {
  eventId: string;
  personId: string;
  status: 'yes' | 'no' | 'maybe';
  guestCount: number;
}

interface CalendarProps {
  events: CalendarEvent[];
  people: Person[];
  rsvps: RSVP[];
  onRSVP: (eventId: string, personId: string, status: RSVP['status'], guestCount?: number) => void;
}

const categoryColors: Record<string, string> = {
  service: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
  meeting: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  event: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20',
  'small-group': 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
  other: 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300 border-gray-200 dark:border-dark-600'
};

export function Calendar({ events, people, rsvps, onRSVP }: CalendarProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showRSVPModal, setShowRSVPModal] = useState(false);
  const [rsvpPersonId, setRsvpPersonId] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<RSVP['status']>('yes');
  const [rsvpGuests, setRsvpGuests] = useState(0);

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  const groupedEvents: Record<string, CalendarEvent[]> = {};
  sortedEvents.forEach((event) => {
    const date = new Date(event.startDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
    if (!groupedEvents[date]) groupedEvents[date] = [];
    groupedEvents[date].push(event);
  });

  const getEventRSVPs = (eventId: string) => {
    return rsvps.filter((r) => r.eventId === eventId);
  };

  const getRSVPCounts = (eventId: string) => {
    const eventRsvps = getEventRSVPs(eventId);
    const yes = eventRsvps.filter((r) => r.status === 'yes');
    const no = eventRsvps.filter((r) => r.status === 'no');
    const maybe = eventRsvps.filter((r) => r.status === 'maybe');
    const totalAttending = yes.reduce((sum, r) => sum + 1 + r.guestCount, 0);
    return { yes: yes.length, no: no.length, maybe: maybe.length, totalAttending };
  };

  const handleRSVP = () => {
    if (!selectedEvent || !rsvpPersonId) return;
    onRSVP(selectedEvent.id, rsvpPersonId, rsvpStatus, rsvpGuests);
    setShowRSVPModal(false);
    setSelectedEvent(null);
    setRsvpPersonId('');
    setRsvpStatus('yes');
    setRsvpGuests(0);
  };

  const openRSVPModal = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowRSVPModal(true);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Calendar</h1>
        <p className="text-gray-500 dark:text-dark-400 mt-1">Upcoming events and services</p>
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
                      <span className="text-xs px-2 py-1 rounded-full bg-white/50 dark:bg-white/10">
                        {event.category}
                      </span>
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
    </div>
  );
}
