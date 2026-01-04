import { Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { CalendarEvent } from '../types';

interface CalendarProps {
  events: CalendarEvent[];
}

const categoryColors: Record<string, string> = {
  service: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  meeting: 'bg-amber-100 text-amber-700 border-amber-200',
  event: 'bg-green-100 text-green-700 border-green-200',
  'small-group': 'bg-purple-100 text-purple-700 border-purple-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200'
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
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-500 mt-1">Upcoming events and services</p>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedEvents).map(([date, dateEvents]) => (
          <div key={date}>
            <h2 className="text-sm font-semibold text-gray-500 mb-3">{date}</h2>
            <div className="space-y-3">
              {dateEvents.map((event) => (
                <div
                  key={event.id}
                  className={`bg-white rounded-xl border p-4 ${categoryColors[event.category]}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{event.title}</h3>
                      {event.description && (
                        <p className="text-sm opacity-75 mt-1">{event.description}</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/50">
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
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <CalendarIcon className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-400">No upcoming events</p>
        </div>
      )}
    </div>
  );
}
