import { useState, useMemo } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  Check,
  X,
  HelpCircle,
} from 'lucide-react';
import type { CalendarEvent } from '../../types';

interface MemberEventsPageProps {
  events: CalendarEvent[];
  rsvps?: { eventId: string; personId: string; status: 'yes' | 'no' | 'maybe'; guestCount: number }[];
  personId?: string;
  onRSVP?: (eventId: string, personId: string, status: 'yes' | 'no' | 'maybe', guestCount?: number) => void;
}

type EventCategory = 'all' | 'service' | 'event' | 'small-group' | 'meeting';

const categoryColors: Record<CalendarEvent['category'], { bg: string; text: string; label: string }> = {
  service: { bg: 'bg-blue-100 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', label: 'Service' },
  event: { bg: 'bg-purple-100 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', label: 'Event' },
  'small-group': { bg: 'bg-green-100 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400', label: 'Small Group' },
  meeting: { bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', label: 'Meeting' },
  holiday: { bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', label: 'Holiday' },
  other: { bg: 'bg-gray-100 dark:bg-gray-500/10', text: 'text-gray-600 dark:text-gray-400', label: 'Other' },
};

export function MemberEventsPage({ events, rsvps = [], personId, onRSVP }: MemberEventsPageProps) {
  const [filter, setFilter] = useState<EventCategory>('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Get upcoming events (next 30 days)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return events
      .filter(e => {
        const eventDate = new Date(e.startDate);
        return eventDate >= now && eventDate <= thirtyDaysFromNow;
      })
      .filter(e => filter === 'all' || e.category === filter)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [events, filter]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};
    upcomingEvents.forEach(event => {
      const dateKey = new Date(event.startDate).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(event);
    });
    return groups;
  }, [upcomingEvents]);

  // Get my RSVP for an event
  const getMyRSVP = (eventId: string) => {
    if (!personId) return null;
    return rsvps.find(r => r.eventId === eventId && r.personId === personId);
  };

  if (selectedEvent) {
    return (
      <EventDetails
        event={selectedEvent}
        rsvp={getMyRSVP(selectedEvent.id)}
        personId={personId}
        onRSVP={onRSVP}
        onBack={() => setSelectedEvent(null)}
      />
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          Upcoming Events
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {upcomingEvents.length} events in the next 30 days
        </p>
      </div>

      {/* Filter */}
      <div className="mb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-2">
          {(['all', 'service', 'event', 'small-group'] as EventCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-dark-400'
              }`}
            >
              {cat === 'all' ? 'All' : categoryColors[cat]?.label || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      {upcomingEvents.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No upcoming events</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([dateKey, dateEvents]) => {
            const date = new Date(dateKey);
            const isToday = date.toDateString() === new Date().toDateString();
            const isTomorrow = date.toDateString() === new Date(Date.now() + 86400000).toDateString();

            return (
              <div key={dateKey}>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-300 mb-2 sticky top-0 bg-gray-50 dark:bg-dark-900 py-1">
                  {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric'
                  })}
                </h3>
                <div className="space-y-3">
                  {dateEvents.map(event => {
                    const myRsvp = getMyRSVP(event.id);
                    const colors = categoryColors[event.category];

                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="w-full bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4 text-left active:scale-[0.99] transition-transform"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                            <Calendar className={colors.text} size={20} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                                {event.title}
                              </h4>
                              {myRsvp && (
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  myRsvp.status === 'yes'
                                    ? 'bg-green-100 dark:bg-green-500/10 text-green-600'
                                    : myRsvp.status === 'maybe'
                                    ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600'
                                    : 'bg-gray-100 dark:bg-dark-700 text-gray-500'
                                }`}>
                                  {myRsvp.status === 'yes' ? 'Going' : myRsvp.status === 'maybe' ? 'Maybe' : 'Not going'}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-dark-400">
                              <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {new Date(event.startDate).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </span>
                              {event.location && (
                                <span className="flex items-center gap-1 truncate">
                                  <MapPin size={14} />
                                  {event.location}
                                </span>
                              )}
                            </div>
                          </div>

                          <ChevronRight className="text-gray-400 flex-shrink-0" size={20} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Event Details Component
function EventDetails({
  event,
  rsvp,
  personId,
  onRSVP,
  onBack
}: {
  event: CalendarEvent;
  rsvp?: { eventId: string; personId: string; status: 'yes' | 'no' | 'maybe'; guestCount: number } | null;
  personId?: string;
  onRSVP?: (eventId: string, personId: string, status: 'yes' | 'no' | 'maybe', guestCount?: number) => void;
  onBack: () => void;
}) {
  const [guestCount, setGuestCount] = useState(rsvp?.guestCount || 0);
  const colors = categoryColors[event.category];
  const eventDate = new Date(event.startDate);

  const handleRSVP = (status: 'yes' | 'no' | 'maybe') => {
    if (personId && onRSVP) {
      onRSVP(event.id, personId, status, status === 'yes' ? guestCount : 0);
    }
  };

  return (
    <div className="p-4">
      <button
        onClick={onBack}
        className="text-sm text-gray-500 mb-4"
      >
        ← Back to events
      </button>

      {/* Event Header */}
      <div className={`${colors.bg} rounded-2xl p-5 mb-6`}>
        <span className={`text-xs font-semibold ${colors.text} uppercase tracking-wider`}>
          {colors.label}
        </span>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-2">
          {event.title}
        </h2>
      </div>

      {/* Event Details */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 dark:bg-dark-800 rounded-lg flex items-center justify-center">
            <Calendar className="text-gray-500" size={20} />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {eventDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
            <p className="text-sm text-gray-500 dark:text-dark-400">
              {eventDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
              })}
              {event.endDate && ` - ${new Date(event.endDate).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
              })}`}
            </p>
          </div>
        </div>

        {event.location && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 dark:bg-dark-800 rounded-lg flex items-center justify-center">
              <MapPin className="text-gray-500" size={20} />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{event.location}</p>
            </div>
          </div>
        )}

        {event.description && (
          <div className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4">
            <p className="text-gray-700 dark:text-dark-300 text-sm leading-relaxed">
              {event.description}
            </p>
          </div>
        )}
      </div>

      {/* RSVP Section */}
      {personId && onRSVP && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Will you attend?</h3>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={() => handleRSVP('yes')}
              className={`py-3 px-4 rounded-xl flex flex-col items-center gap-1 transition-all ${
                rsvp?.status === 'yes'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-400'
              }`}
            >
              <Check size={20} />
              <span className="text-sm font-medium">Yes</span>
            </button>
            <button
              onClick={() => handleRSVP('maybe')}
              className={`py-3 px-4 rounded-xl flex flex-col items-center gap-1 transition-all ${
                rsvp?.status === 'maybe'
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-400'
              }`}
            >
              <HelpCircle size={20} />
              <span className="text-sm font-medium">Maybe</span>
            </button>
            <button
              onClick={() => handleRSVP('no')}
              className={`py-3 px-4 rounded-xl flex flex-col items-center gap-1 transition-all ${
                rsvp?.status === 'no'
                  ? 'bg-gray-500 text-white'
                  : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-400'
              }`}
            >
              <X size={20} />
              <span className="text-sm font-medium">No</span>
            </button>
          </div>

          {rsvp?.status === 'yes' && (
            <div>
              <label className="block text-sm text-gray-600 dark:text-dark-400 mb-2">
                <Users size={16} className="inline mr-1" />
                Bringing guests?
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setGuestCount(Math.max(0, guestCount - 1))}
                  className="w-10 h-10 bg-gray-100 dark:bg-dark-700 rounded-lg flex items-center justify-center text-gray-600 dark:text-dark-400"
                >
                  -
                </button>
                <span className="font-semibold text-gray-900 dark:text-white w-8 text-center">
                  {guestCount}
                </span>
                <button
                  onClick={() => setGuestCount(guestCount + 1)}
                  className="w-10 h-10 bg-gray-100 dark:bg-dark-700 rounded-lg flex items-center justify-center text-gray-600 dark:text-dark-400"
                >
                  +
                </button>
                <span className="text-sm text-gray-500 dark:text-dark-400">guests</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
