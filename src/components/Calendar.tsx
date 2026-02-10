import { useState, useMemo, useCallback } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Users, Plus, Trash2, Edit2, ChevronLeft, ChevronRight, Filter, Cake, Mail, Phone, Heart, Download, ExternalLink } from 'lucide-react';
import { CalendarEvent, Person } from '../types';
import { downloadICalFile, generateGoogleCalendarUrl, generateOutlookUrl } from '../utils/calendarExport';
import { RSVP, EventCategory, FilterType, categoryColors, categoryLabels } from './calendar/CalendarConstants';
import { EventFormModal, EventFormState } from './calendar/EventFormModal';
import { RSVPModal } from './calendar/RSVPModal';

interface BirthdayItem {
  id: string;
  person: Person;
  date: string;
  age: number;
}

interface AnniversaryItem {
  id: string;
  person: Person;
  date: string;
  years: number;
}

interface CalendarProps {
  events: CalendarEvent[];
  people: Person[];
  rsvps: RSVP[];
  churchName?: string;
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
  onViewPerson?: (personId: string) => void;
}

export function Calendar({ events, people, rsvps, churchName = 'Church', onRSVP, onAddEvent, onUpdateEvent, onDeleteEvent, onViewPerson }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showBirthdays, setShowBirthdays] = useState(true);
  const [showAnniversaries, setShowAnniversaries] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showRSVPModal, setShowRSVPModal] = useState(false);
  const [rsvpPersonId, setRsvpPersonId] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<RSVP['status']>('yes');
  const [rsvpGuests, setRsvpGuests] = useState(0);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [eventForm, setEventForm] = useState<EventFormState>({
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

  const today = useMemo(() => new Date(), []);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDay = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= totalDays; day++) {
    calendarDays.push(day);
  }

  const birthdays = useMemo(() => {
    const birthdayItems: BirthdayItem[] = [];
    people.forEach(person => {
      if (person.birthDate) {
        const birthDate = new Date(person.birthDate);
        const thisYearBirthday = new Date(year, birthDate.getMonth(), birthDate.getDate());
        const age = year - birthDate.getFullYear();
        birthdayItems.push({ id: `birthday-${person.id}`, person, date: thisYearBirthday.toISOString().split('T')[0], age });
      }
    });
    return birthdayItems;
  }, [people, year]);

  const anniversaries = useMemo(() => {
    const anniversaryItems: AnniversaryItem[] = [];
    people.forEach(person => {
      if (person.joinDate) {
        const joinDate = new Date(person.joinDate);
        const thisYearAnniversary = new Date(year, joinDate.getMonth(), joinDate.getDate());
        const years = year - joinDate.getFullYear();
        if (years > 0) {
          anniversaryItems.push({ id: `anniversary-${person.id}`, person, date: thisYearAnniversary.toISOString().split('T')[0], years });
        }
      }
    });
    return anniversaryItems;
  }, [people, year]);

  const filteredEvents = useMemo(() => {
    if (!showEvents) return [];
    if (filterType === 'all' || filterType === 'events') return events;
    if (filterType === 'birthdays') return [];
    return events.filter(e => e.category === filterType);
  }, [events, filterType, showEvents]);

  const filteredBirthdays = useMemo(() => {
    if (!showBirthdays) return [];
    if (filterType === 'events') return [];
    return birthdays;
  }, [birthdays, filterType, showBirthdays]);

  const filteredAnniversaries = useMemo(() => {
    if (!showAnniversaries) return [];
    if (filterType === 'events') return [];
    return anniversaries;
  }, [anniversaries, filterType, showAnniversaries]);

  const getEventsForDay = useCallback((day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredEvents.filter(e => e.startDate.startsWith(dateStr));
  }, [year, month, filteredEvents]);

  const getBirthdaysForDay = useCallback((day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredBirthdays.filter(b => b.date === dateStr);
  }, [year, month, filteredBirthdays]);

  const getAnniversariesForDay = useCallback((day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredAnniversaries.filter(a => a.date === dateStr);
  }, [year, month, filteredAnniversaries]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return filteredEvents
      .filter(e => { const d = new Date(e.startDate); return d >= now && d <= thirtyDaysFromNow; })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [filteredEvents]);

  const upcomingBirthdays = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return filteredBirthdays
      .filter(b => { const d = new Date(b.date); return d >= now && d <= thirtyDaysFromNow; })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredBirthdays]);

  const upcomingAnniversaries = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return filteredAnniversaries
      .filter(a => { const d = new Date(a.date); return d >= now && d <= thirtyDaysFromNow; })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredAnniversaries]);

  const rsvpsByEvent = useMemo(() => {
    const map = new Map<string, RSVP[]>();
    rsvps.forEach(r => {
      const existing = map.get(r.eventId) || [];
      existing.push(r);
      map.set(r.eventId, existing);
    });
    return map;
  }, [rsvps]);

  const getRSVPCounts = useCallback((eventId: string) => {
    const eventRsvps = rsvpsByEvent.get(eventId) || [];
    let yesCount = 0, noCount = 0, maybeCount = 0, totalAttending = 0;
    eventRsvps.forEach(r => {
      if (r.status === 'yes') { yesCount++; totalAttending += 1 + r.guestCount; }
      else if (r.status === 'no') { noCount++; }
      else { maybeCount++; }
    });
    return { yes: yesCount, no: noCount, maybe: maybeCount, totalAttending };
  }, [rsvpsByEvent]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { birthday: birthdays.length, anniversary: anniversaries.length };
    events.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
    return counts;
  }, [events, birthdays.length, anniversaries.length]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear();

  const resetEventForm = useCallback(() => {
    setEventForm({ title: '', description: '', startDate: '', startTime: '', endDate: '', endTime: '', allDay: false, location: '', category: 'event' });
    setEditingEvent(null);
  }, []);

  const openCreateEventModal = useCallback(() => {
    resetEventForm();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setEventForm(prev => ({ ...prev, startDate: tomorrow.toISOString().split('T')[0], startTime: '10:00' }));
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
      ? (eventForm.allDay ? `${eventForm.endDate}T23:59:59` : `${eventForm.endDate}T${eventForm.endTime || '23:59'}:00`)
      : undefined;

    if (editingEvent && onUpdateEvent) {
      onUpdateEvent(editingEvent.id, { title: eventForm.title, description: eventForm.description || undefined, startDate: startDateTime, endDate: endDateTime, allDay: eventForm.allDay, location: eventForm.location || undefined, category: eventForm.category });
    } else if (onAddEvent) {
      onAddEvent({ title: eventForm.title, description: eventForm.description || undefined, startDate: startDateTime, endDate: endDateTime, allDay: eventForm.allDay, location: eventForm.location || undefined, category: eventForm.category });
    }
    setShowEventModal(false);
    resetEventForm();
  }, [eventForm, editingEvent, onAddEvent, onUpdateEvent, resetEventForm]);

  const handleDeleteEvent = useCallback((eventId: string) => {
    if (onDeleteEvent && confirm('Are you sure you want to delete this event?')) {
      onDeleteEvent(eventId);
    }
  }, [onDeleteEvent]);

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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Calendar / Events</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            {events.length} events · {birthdays.length} birthdays · {anniversaries.length} anniversaries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 flex items-center gap-2"
            >
              <Download size={18} />
              Export
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-dark-850 rounded-xl shadow-lg border border-gray-200 dark:border-dark-700 z-50 overflow-hidden">
                  <div className="p-2">
                    <p className="px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-dark-500 uppercase">Export Calendar</p>
                    <button
                      onClick={() => { downloadICalFile(events, churchName); setShowExportMenu(false); }}
                      disabled={events.length === 0}
                      className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-dark-300 hover:bg-gray-50 dark:hover:bg-dark-800 rounded-lg flex items-center gap-2 disabled:opacity-50"
                    >
                      <Download size={16} className="text-gray-400" />
                      Download .ics file
                    </button>
                    <p className="px-3 py-1.5 text-xs text-gray-400 dark:text-dark-500 mt-2">Import into Google Calendar or Outlook</p>
                  </div>
                  {upcomingEvents.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-dark-700 p-2">
                      <p className="px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-dark-500 uppercase">Add Single Event</p>
                      <div className="max-h-48 overflow-y-auto">
                        {upcomingEvents.slice(0, 5).map((event) => (
                          <div key={event.id} className="px-3 py-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">{event.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <a href={generateGoogleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1" onClick={() => setShowExportMenu(false)}>
                                <ExternalLink size={10} /> Google
                              </a>
                              <a href={generateOutlookUrl(event)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1" onClick={() => setShowExportMenu(false)}>
                                <ExternalLink size={10} /> Outlook
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {onAddEvent && (
            <button onClick={openCreateEventModal} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 flex items-center gap-2">
              <Plus size={18} /> Create Event
            </button>
          )}
        </div>
      </div>

      {/* Show/Hide Toggles + Category Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-dark-400">
            <Filter size={16} /><span>Show:</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-indigo-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-dark-300">Events ({events.length})</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showBirthdays} onChange={(e) => setShowBirthdays(e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-pink-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-dark-300 flex items-center gap-1.5">
              <Cake size={14} className="text-pink-500" /> Birthdays ({birthdays.length})
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showAnniversaries} onChange={(e) => setShowAnniversaries(e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-dark-600 text-red-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-dark-300 flex items-center gap-1.5">
              <Heart size={14} className="text-red-500" /> Anniversaries ({anniversaries.length})
            </span>
          </label>
        </div>

        {showEvents && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 dark:text-dark-500 mr-1">Event type:</span>
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterType === 'all' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-dark-400 hover:bg-gray-200 dark:hover:bg-dark-700'
              }`}
            >
              All
            </button>
            {/* Always show primary categories, hide secondary ones if count is 0 */}
            {Object.entries(categoryLabels).filter(([key]) => key !== 'birthday' && key !== 'anniversary').map(([key, label]) => {
              const count = categoryCounts[key] || 0;
              // Always show these primary categories
              const primaryCategories = ['service', 'wedding', 'funeral', 'baptism', 'meeting', 'event', 'small-group'];
              // Hide secondary categories only if they have 0 events
              if (count === 0 && !primaryCategories.includes(key)) return null;
              const colors = categoryColors[key];
              return (
                <button
                  key={key}
                  onClick={() => setFilterType(filterType === key ? 'all' : key as FilterType)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    filterType === key
                      ? `${colors.bg} ${colors.text} ${colors.border} border`
                      : count === 0
                        ? 'bg-gray-50 dark:bg-dark-850 text-gray-400 dark:text-dark-500 hover:bg-gray-100 dark:hover:bg-dark-800'
                        : 'bg-gray-100 dark:bg-dark-800 text-gray-600 dark:text-dark-400 hover:bg-gray-200 dark:hover:bg-dark-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${count === 0 ? 'bg-gray-300 dark:bg-dark-600' : colors.dot}`} />
                  {label} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="xl:col-span-2">
          <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors">
                  <ChevronLeft size={20} className="text-gray-600 dark:text-dark-400" />
                </button>
                <button onClick={nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors">
                  <ChevronRight size={20} className="text-gray-600 dark:text-dark-400" />
                </button>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100 ml-2">{monthName}</h2>
              </div>
              {!isCurrentMonth && (
                <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors">Today</button>
              )}
            </div>

            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-dark-700">
              {days.map((day) => (
                <div key={day} className="py-3 text-center text-sm font-medium text-gray-500 dark:text-dark-400">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                const dayEvents = day !== null ? getEventsForDay(day) : [];
                const dayBirthdays = day !== null ? getBirthdaysForDay(day) : [];
                const dayAnniversaries = day !== null ? getAnniversariesForDay(day) : [];
                const isTodayDay = day !== null && isToday(day);
                const totalItems = dayEvents.length + dayBirthdays.length + dayAnniversaries.length;
                const maxVisible = 3;
                let shown = 0;
                return (
                  <div key={i} className={`min-h-[100px] p-2 border-b border-r border-gray-100 dark:border-dark-700 ${day === null ? 'bg-gray-50 dark:bg-dark-850' : ''} ${i % 7 === 6 ? 'border-r-0' : ''}`}>
                    {day !== null && (
                      <>
                        <div className={`text-sm font-medium mb-1 ${isTodayDay ? 'w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center' : 'text-gray-700 dark:text-dark-300'}`}>{day}</div>
                        <div className="space-y-1">
                          {dayBirthdays.slice(0, maxVisible).map((birthday) => {
                            shown++;
                            const colors = categoryColors.birthday;
                            return (
                              <button key={birthday.id} onClick={() => onViewPerson?.(birthday.person.id)} className={`w-full text-left px-1.5 py-0.5 text-[10px] font-medium rounded truncate ${colors.bg} ${colors.text} flex items-center gap-1`}>
                                <Cake size={8} />{birthday.person.firstName}
                              </button>
                            );
                          })}
                          {shown < maxVisible && dayAnniversaries.slice(0, maxVisible - shown).map((anniversary) => {
                            shown++;
                            const colors = categoryColors.anniversary;
                            return (
                              <button key={anniversary.id} onClick={() => onViewPerson?.(anniversary.person.id)} className={`w-full text-left px-1.5 py-0.5 text-[10px] font-medium rounded truncate ${colors.bg} ${colors.text} flex items-center gap-1`}>
                                <Heart size={8} />{anniversary.person.firstName}
                              </button>
                            );
                          })}
                          {shown < maxVisible && dayEvents.slice(0, maxVisible - shown).map((event) => {
                            shown++;
                            const colors = categoryColors[event.category] || categoryColors.other;
                            return (
                              <button key={event.id} onClick={() => openEditEventModal(event)} className={`w-full text-left px-1.5 py-0.5 text-[10px] font-medium rounded truncate ${colors.bg} ${colors.text}`}>{event.title}</button>
                            );
                          })}
                          {totalItems > maxVisible && <p className="text-[10px] text-gray-500 dark:text-dark-400 pl-1">+{totalItems - maxVisible} more</p>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upcoming Sidebar */}
        <div className="xl:col-span-1 space-y-4">
          {showBirthdays && upcomingBirthdays.length > 0 && (
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-dark-700 bg-pink-50 dark:bg-pink-500/10">
                <div className="flex items-center gap-2">
                  <Cake className="text-pink-500" size={18} />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-dark-100">Upcoming Birthdays</h3>
                    <p className="text-sm text-gray-500 dark:text-dark-400">Next 30 days</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-dark-700 max-h-[300px] overflow-y-auto">
                {upcomingBirthdays.map((birthday) => {
                  const birthdayDate = new Date(birthday.date);
                  return (
                    <div key={birthday.id} className="p-4 hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors cursor-pointer" onClick={() => onViewPerson?.(birthday.person.id)}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-pink-100 dark:bg-pink-500/20 rounded-full flex items-center justify-center text-pink-600 dark:text-pink-400 font-medium text-sm">{birthday.person.firstName[0]}{birthday.person.lastName[0]}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-dark-100 text-sm">{birthday.person.firstName} {birthday.person.lastName}</h4>
                          <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
                            {birthdayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            <span className="mx-1">·</span>Turning {birthday.age}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            {birthday.person.email && <a href={`mailto:${birthday.person.email}`} onClick={(e) => e.stopPropagation()} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"><Mail size={10} /> Email</a>}
                            {birthday.person.phone && <a href={`tel:${birthday.person.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"><Phone size={10} /> Call</a>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showAnniversaries && upcomingAnniversaries.length > 0 && (
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-dark-700 bg-red-50 dark:bg-red-500/10">
                <div className="flex items-center gap-2">
                  <Heart className="text-red-500" size={18} />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-dark-100">Member Anniversaries</h3>
                    <p className="text-sm text-gray-500 dark:text-dark-400">Next 30 days</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-dark-700 max-h-[250px] overflow-y-auto">
                {upcomingAnniversaries.map((anniversary) => {
                  const anniversaryDate = new Date(anniversary.date);
                  return (
                    <div key={anniversary.id} className="p-4 hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors cursor-pointer" onClick={() => onViewPerson?.(anniversary.person.id)}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 font-medium text-sm">{anniversary.person.firstName[0]}{anniversary.person.lastName[0]}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-dark-100 text-sm">{anniversary.person.firstName} {anniversary.person.lastName}</h4>
                          <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
                            {anniversaryDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            <span className="mx-1">·</span>{anniversary.years} year{anniversary.years !== 1 ? 's' : ''} as member
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            {anniversary.person.email && <a href={`mailto:${anniversary.person.email}`} onClick={(e) => e.stopPropagation()} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"><Mail size={10} /> Email</a>}
                            {anniversary.person.phone && <a href={`tel:${anniversary.person.phone}`} onClick={(e) => e.stopPropagation()} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"><Phone size={10} /> Call</a>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showEvents && (
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-dark-700">
                <h3 className="font-semibold text-gray-900 dark:text-dark-100">Upcoming Events</h3>
                <p className="text-sm text-gray-500 dark:text-dark-400">Next 30 days</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-dark-700 max-h-[400px] overflow-y-auto">
                {upcomingEvents.length === 0 ? (
                  <div className="p-8 text-center">
                    <CalendarIcon className="mx-auto text-gray-300 dark:text-dark-600 mb-2" size={32} />
                    <p className="text-gray-500 dark:text-dark-400 text-sm">No upcoming events</p>
                  </div>
                ) : (
                  upcomingEvents.map((event) => {
                    const colors = categoryColors[event.category] || categoryColors.other;
                    const counts = getRSVPCounts(event.id);
                    const eventDate = new Date(event.startDate);
                    return (
                      <div key={event.id} className="p-4 hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${colors.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium text-gray-900 dark:text-dark-100 text-sm">{event.title}</h4>
                              <div className="flex items-center gap-1">
                                {onUpdateEvent && <button onClick={() => openEditEventModal(event)} className="p-1 hover:bg-gray-200 dark:hover:bg-dark-600 rounded"><Edit2 size={12} className="text-gray-400" /></button>}
                                {onDeleteEvent && <button onClick={() => handleDeleteEvent(event.id)} className="p-1 hover:bg-red-100 dark:hover:bg-red-500/10 rounded"><Trash2 size={12} className="text-gray-400 hover:text-red-500" /></button>}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-dark-400">
                              <span className="flex items-center gap-1"><CalendarIcon size={10} />{eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                              {!event.allDay && <span className="flex items-center gap-1"><Clock size={10} />{eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
                            </div>
                            {event.location && <p className="text-xs text-gray-400 dark:text-dark-500 mt-1 flex items-center gap-1"><MapPin size={10} />{event.location}</p>}
                            {counts.yes > 0 && <div className="flex items-center gap-1 mt-2"><Users size={10} className="text-gray-400" /><span className="text-xs text-gray-500 dark:text-dark-400">{counts.totalAttending} attending</span></div>}
                            <button onClick={() => openRSVPModal(event)} className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">Manage RSVPs</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RSVP Modal */}
      {showRSVPModal && selectedEvent && (
        <RSVPModal
          selectedEvent={selectedEvent}
          people={people}
          rsvpPersonId={rsvpPersonId}
          rsvpStatus={rsvpStatus}
          rsvpGuests={rsvpGuests}
          onPersonChange={setRsvpPersonId}
          onStatusChange={setRsvpStatus}
          onGuestsChange={setRsvpGuests}
          onSubmit={handleRSVP}
          onClose={() => { setShowRSVPModal(false); setSelectedEvent(null); }}
        />
      )}

      {/* Event Create/Edit Modal */}
      {showEventModal && (
        <EventFormModal
          eventForm={eventForm}
          editingEvent={editingEvent}
          onFormChange={setEventForm}
          onSave={handleSaveEvent}
          onClose={() => { setShowEventModal(false); resetEventForm(); }}
        />
      )}
    </div>
  );
}
