import { Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { CalendarEvent } from '../types';

interface CalendarProps {
  events: CalendarEvent[];
}

const categoryColors: Record<string, string> = {
  service: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
  meeting: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  event: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20',
  'small-group': 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
  other: 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-dark-300 border-gray-200 dark:border-dark-600'
};

export function Calendar({ events }: CalendarProps) {
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
              {dateEvents.map((event) => (
                <div
                  key={event.id}
                  className={`rounded-xl border p-4 ${categoryColors[event.category]}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
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
                </div>
              ))}
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
    </div>
  );
}
