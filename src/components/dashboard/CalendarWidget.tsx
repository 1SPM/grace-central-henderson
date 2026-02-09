import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ArrowRight, MapPin } from 'lucide-react';
import { CalendarEvent } from '../../types';

const categoryColors: Record<string, string> = {
  service: 'bg-indigo-500',
  meeting: 'bg-amber-500',
  event: 'bg-green-500',
  'small-group': 'bg-purple-500',
  holiday: 'bg-rose-500',
  other: 'bg-gray-500'
};

interface CalendarWidgetProps {
  events: CalendarEvent[];
  onViewCalendar?: () => void;
}

export function CalendarWidget({ events, onViewCalendar }: CalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = useMemo(() => new Date(), []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDay = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= totalDays; day++) {
    calendarDays.push(day);
  }

  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.startDate.startsWith(dateStr));
  };

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    return events
      .filter(e => {
        const eventDate = new Date(e.startDate);
        return eventDate >= now && eventDate <= weekFromNow;
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 4);
  }, [events]);

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white dark:bg-dark-700 rounded-lg flex items-center justify-center shadow-sm">
              <Calendar className="text-indigo-600 dark:text-indigo-400" size={18} />
            </div>
            <div>
              <h2 className="font-medium text-gray-900 dark:text-dark-100">Calendar</h2>
              <span className="text-xs text-gray-500 dark:text-dark-400">{upcomingEvents.length} upcoming</span>
            </div>
          </div>
          {onViewCalendar && (
            <button
              onClick={onViewCalendar}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              View all
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              <ChevronLeft size={16} className="text-gray-500 dark:text-dark-400" />
            </button>
            <span className="text-sm font-medium text-gray-900 dark:text-dark-100">
              {monthName} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              <ChevronRight size={16} className="text-gray-500 dark:text-dark-400" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {days.map((day, i) => (
              <div key={i} className="text-center text-[10px] font-medium text-gray-400 dark:text-dark-500 py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              const dayEvents = day !== null ? getEventsForDay(day) : [];
              const isTodayDay = day !== null && isToday(day);
              return (
                <div
                  key={i}
                  className={`relative text-center text-xs py-1.5 rounded-md ${
                    day === null
                      ? ''
                      : isTodayDay
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-gray-700 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-700'
                  }`}
                >
                  {day}
                  {day !== null && dayEvents.length > 0 && !isTodayDay && (
                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {dayEvents.slice(0, 2).map((e, idx) => (
                        <div
                          key={idx}
                          className={`w-1 h-1 rounded-full ${categoryColors[e.category] || 'bg-gray-400'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {upcomingEvents.length > 0 && (
          <div className="border-t border-gray-100 dark:border-dark-700 pt-3">
            <h3 className="text-xs font-medium text-gray-500 dark:text-dark-400 uppercase tracking-wider mb-2">
              Coming Up
            </h3>
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-dark-850"
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${categoryColors[event.category] || 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                      {event.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500 dark:text-dark-400">
                        {new Date(event.startDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                        {!event.allDay && ` · ${new Date(event.startDate).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}`}
                      </span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={8} className="text-gray-400 dark:text-dark-500" />
                        <span className="text-[10px] text-gray-400 dark:text-dark-500 truncate">
                          {event.location}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {upcomingEvents.length === 0 && (
          <div className="text-center py-4">
            <p className="text-xs text-gray-400 dark:text-dark-500">No upcoming events this week</p>
          </div>
        )}
      </div>
    </div>
  );
}
