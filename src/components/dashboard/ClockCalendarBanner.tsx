import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus } from 'lucide-react';
import { useChurchClock } from '../../hooks/useChurchClock';
import { calendarDayKey, type DayAgendaEvent } from '../../lib/calendarEvents';
import { CENTRAL_HENDERSON_TIMEZONE } from '../../config/centralHenderson';

const MC_DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CATEGORY_TONE: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  service: { label: 'Service', dot: 'bg-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300' },
  worship: { label: 'Worship', dot: 'bg-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300' },
  meeting: { label: 'Meeting', dot: 'bg-slate-500', bg: 'bg-slate-50 dark:bg-slate-500/10', text: 'text-slate-700 dark:text-slate-300' },
  outreach: { label: 'Outreach', dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300' },
  class: { label: 'Class', dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300' },
  event: { label: 'Event', dot: 'bg-sky-500', bg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-700 dark:text-sky-300' },
  'small-group': { label: 'Group', dot: 'bg-teal-500', bg: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-700 dark:text-teal-300' },
  holiday: { label: 'Holiday', dot: 'bg-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300' },
  wedding: { label: 'Wedding', dot: 'bg-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300' },
  funeral: { label: 'Funeral', dot: 'bg-stone-500', bg: 'bg-stone-100 dark:bg-stone-500/10', text: 'text-stone-700 dark:text-stone-300' },
  baptism: { label: 'Baptism', dot: 'bg-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-300' },
  dedication: { label: 'Dedication', dot: 'bg-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-700 dark:text-violet-300' },
  ceremony: { label: 'Milestone', dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300' },
  counseling: { label: 'Care', dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300' },
  rehearsal: { label: 'Rehearsal', dot: 'bg-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300' },
  other: { label: 'Other', dot: 'bg-gray-500', bg: 'bg-gray-50 dark:bg-gray-500/10', text: 'text-gray-700 dark:text-gray-300' },
};

function eventTone(category: string) {
  return CATEGORY_TONE[category] ?? CATEGORY_TONE.other;
}

function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month, day);
}

export interface ClockCalendarBannerProps {
  eventDays: string[];
  eventsByDay: Record<string, DayAgendaEvent[]>;
  onOpenCalendar?: () => void;
  timezone?: string;
  variant?: 'classic' | 'redesign';
  className?: string;
}

export function ClockCalendarBanner({
  eventDays,
  eventsByDay,
  onOpenCalendar,
  timezone = CENTRAL_HENDERSON_TIMEZONE,
  variant = 'classic',
  className = '',
}: ClockCalendarBannerProps) {
  const { zoned, format, churchToday, churchTodayKey } = useChurchClock(timezone);
  const [viewMonth, setViewMonth] = useState(() => new Date(churchToday.getFullYear(), churchToday.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(() => new Date(churchToday));

  const eventSet = useMemo(() => new Set(eventDays), [eventDays]);
  const month = viewMonth.getMonth();
  const viewYear = viewMonth.getFullYear();
  const first = new Date(viewYear, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    }),
    [start.getTime()],
  );

  const shiftMonth = (delta: number) => {
    setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };
  const jumpToToday = () => {
    setViewMonth(new Date(churchToday.getFullYear(), churchToday.getMonth(), 1));
    setSelected(new Date(churchToday));
  };

  const selKey = calendarDayKey(selected);
  const agenda = eventsByDay[selKey] ?? [];
  const isToday = (d: Date) => calendarDayKey(d) === churchTodayKey;
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const monthEntries = useMemo(() => {
    return Object.entries(eventsByDay)
      .flatMap(([key, items]) => {
        const day = parseDayKey(key);
        return items.map((event) => ({ key, day, event }));
      })
      .filter(({ day }) => day.getFullYear() === viewYear && day.getMonth() === month)
      .sort((a, b) => new Date(a.event.startDate).getTime() - new Date(b.event.startDate).getTime());
  }, [eventsByDay, viewYear, month]);

  const selectedDayEntries = useMemo(
    () => monthEntries.filter(({ key }) => key === selKey),
    [selKey, monthEntries],
  );

  const upcomingInMonth = useMemo(() => {
    const todayStart = new Date(churchToday.getFullYear(), churchToday.getMonth(), churchToday.getDate()).getTime();
    return monthEntries.filter(({ day }) => day.getTime() >= todayStart).slice(0, 8);
  }, [churchToday, monthEntries]);

  const itineraryEntries = selectedDayEntries.length > 0 ? selectedDayEntries : upcomingInMonth;
  const itineraryTitle = selectedDayEntries.length > 0
    ? selected.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    : monthEntries.length > 0
      ? `Upcoming in ${viewMonth.toLocaleDateString('en-US', { month: 'long' })}`
      : `No activity in ${viewMonth.toLocaleDateString('en-US', { month: 'long' })}`;

  if (variant === 'redesign') {
    const timeShort = format({ hour: 'numeric', minute: '2-digit' });
    const dateLong = format({ weekday: 'long', month: 'long', day: 'numeric' });
    return (
      <RedesignClockCalendar
        zoned={zoned}
        timeShort={timeShort}
        dateLong={dateLong}
        monthLabel={monthLabel}
        cells={cells}
        month={month}
        eventSet={eventSet}
        selKey={selKey}
        selected={selected}
        agenda={agenda}
        isToday={isToday}
        shiftMonth={shiftMonth}
        setSelected={setSelected}
        onOpenCalendar={onOpenCalendar}
        className={className}
      />
    );
  }

  return (
    <div className={`rounded-xl border border-stone-300 dark:border-dark-700 bg-white dark:bg-dark-850 shadow-sm overflow-hidden ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] divide-y lg:divide-y-0 lg:divide-x divide-stone-200 dark:divide-dark-700">
        {/* Single-month calendar */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-dark-400">Church calendar</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-dark-100">{monthLabel}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => shiftMonth(-1)} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-dark-800 text-gray-500" title="Previous month">
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={jumpToToday} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200 hover:bg-stone-200 dark:hover:bg-dark-700">
                Today
              </button>
              <button type="button" onClick={() => shiftMonth(1)} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-dark-800 text-gray-500" title="Next month">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {MC_DOW.map((d, i) => (
              <div key={i} className="text-[10px] font-semibold text-gray-400 dark:text-dark-500 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === month;
              const key = calendarDayKey(d);
              const count = (eventsByDay[key] ?? []).length;
              const sel = key === selKey;
              const today = isToday(d);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (inMonth) setSelected(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
                  }}
                  disabled={!inMonth}
                  className={`relative aspect-square rounded-lg text-sm font-medium transition-colors ${
                    !inMonth
                      ? 'text-transparent pointer-events-none'
                      : today
                        ? 'bg-slate-900 dark:bg-dark-100 text-white dark:text-dark-900'
                        : sel
                          ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                          : count > 0
                            ? 'bg-stone-100 dark:bg-dark-800 text-slate-700 dark:text-dark-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'
                            : 'text-gray-700 dark:text-dark-200 hover:bg-stone-100 dark:hover:bg-dark-800'
                  }`}
                  aria-label={inMonth ? `${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}${count > 0 ? `, ${count} event${count === 1 ? '' : 's'}` : ''}` : undefined}
                >
                  {inMonth ? d.getDate() : ''}
                  {inMonth && count > 0 && (
                    <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${today ? 'bg-white dark:bg-dark-900' : 'bg-indigo-500'}`} />
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-3">
            {monthEntries.length} item{monthEntries.length === 1 ? '' : 's'} this month · holidays, milestones & scheduled events
          </p>
        </div>

        {/* Itinerary rail */}
        <div className="px-5 py-4 flex flex-col min-h-[280px]">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-dark-400">Itinerary</p>
              <h3 className="text-base font-semibold text-slate-900 dark:text-dark-100">{itineraryTitle}</h3>
            </div>
            {onOpenCalendar && (
              <button type="button" onClick={onOpenCalendar} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
                Open calendar
              </button>
            )}
          </div>

          {itineraryEntries.length > 0 ? (
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[340px]">
              {itineraryEntries.map(({ key, day, event }) => {
                const tone = eventTone(event.category);
                return (
                  <button
                    key={`${key}-${event.id}`}
                    type="button"
                    onClick={() => {
                      setSelected(new Date(day));
                      if (day.getMonth() !== month || day.getFullYear() !== viewYear) {
                        setViewMonth(new Date(day.getFullYear(), day.getMonth(), 1));
                      }
                    }}
                    className="w-full p-3 rounded-xl border border-stone-200 dark:border-dark-700 bg-stone-50 dark:bg-dark-800 hover:border-indigo-200 dark:hover:border-indigo-500/40 transition-colors text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-11 rounded-lg bg-white dark:bg-dark-850 border border-stone-200 dark:border-dark-700 px-2 py-1.5 text-center flex-shrink-0">
                        <p className="text-[10px] uppercase text-gray-400 dark:text-dark-500 leading-none">{day.toLocaleDateString('en-US', { month: 'short' })}</p>
                        <p className="text-base font-semibold text-slate-900 dark:text-dark-100 leading-tight">{day.getDate()}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tone.bg} ${tone.text}`}>{tone.label}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-dark-100 truncate">{event.title}</p>
                        <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
                          {event.time}
                          {event.location ? (
                            <span className="inline-flex items-center gap-1 ml-2">
                              <MapPin size={10} /> {event.location}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-start justify-center rounded-xl border border-dashed border-stone-300 dark:border-dark-700 bg-stone-50 dark:bg-dark-900/40 p-4">
              <CalendarDays size={22} className="text-gray-400 dark:text-dark-500 mb-2" />
              <p className="text-sm font-medium text-slate-900 dark:text-dark-100">Nothing scheduled this month yet.</p>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">Scroll to other months to see holidays and church milestones.</p>
              {onOpenCalendar && (
                <button type="button" onClick={onOpenCalendar} className="mt-3 btn btn-primary btn-sm inline-flex items-center gap-1.5">
                  <Plus size={12} /> Schedule an event
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Redesign shell uses grace-v2 CSS classes from redesign.css */
function RedesignClockCalendar({
  zoned,
  timeShort,
  dateLong,
  monthLabel,
  cells,
  month,
  eventSet,
  selKey,
  selected,
  agenda,
  isToday,
  shiftMonth,
  setSelected,
  onOpenCalendar,
  className,
}: {
  zoned: { hour12: number; minute: number; second: number };
  timeShort: string;
  dateLong: string;
  monthLabel: string;
  cells: Date[];
  month: number;
  eventSet: Set<string>;
  selKey: string;
  selected: Date;
  agenda: DayAgendaEvent[];
  isToday: (d: Date) => boolean;
  shiftMonth: (delta: number) => void;
  setSelected: (d: Date) => void;
  onOpenCalendar?: () => void;
  className?: string;
}) {
  return (
    <div className={`card clock-cal-banner ${className}`}>
      <div className="ccb-clock">
        <svg viewBox="0 0 100 100" className="analog-clock" width="64" height="64" aria-label="Current time">
          {(() => {
            const s = zoned.second;
            const m = zoned.minute;
            const h = zoned.hour12;
            const secA = s * 6;
            const minA = m * 6 + s * 0.1;
            const hrA = h * 30 + m * 0.5;
            const hand = (angle: number, len: number) => {
              const rad = (angle - 90) * Math.PI / 180;
              return { x2: 50 + len * Math.cos(rad), y2: 50 + len * Math.sin(rad) };
            };
            const hr = hand(hrA, 26);
            const mn = hand(minA, 36);
            const sc = hand(secA, 40);
            return (
              <>
                <circle cx="50" cy="50" r="47" className="ac-face" />
                {Array.from({ length: 12 }, (_, i) => {
                  const a = (i * 30 - 90) * Math.PI / 180;
                  const r1 = i % 3 === 0 ? 38 : 41;
                  const r2 = 45;
                  return <line key={i} x1={50 + r1 * Math.cos(a)} y1={50 + r1 * Math.sin(a)} x2={50 + r2 * Math.cos(a)} y2={50 + r2 * Math.sin(a)} className={i % 3 === 0 ? 'ac-tick ac-tick-major' : 'ac-tick'} />;
                })}
                <line x1="50" y1="50" x2={hr.x2} y2={hr.y2} className="ac-hand ac-hour" />
                <line x1="50" y1="50" x2={mn.x2} y2={mn.y2} className="ac-hand ac-min" />
                <line x1="50" y1="50" x2={sc.x2} y2={sc.y2} className="ac-hand ac-sec" />
                <circle cx="50" cy="50" r="3" className="ac-pin" />
              </>
            );
          })()}
        </svg>
        <div className="ccb-digital">{timeShort}</div>
        <div className="ccb-date">{dateLong}</div>
      </div>
      <div className="ccb-cal">
        <div className="cc-month">
          <span>{monthLabel}</span>
          <div className="row" style={{ gap: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => shiftMonth(-1)} title="Previous month">‹</button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => shiftMonth(1)} title="Next month">›</button>
          </div>
        </div>
        <div className="mc-grid">
          {MC_DOW.map((d, i) => <div key={i} className="mc-dow">{d}</div>)}
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === month;
            const hasEvent = eventSet.has(calendarDayKey(d));
            const sel = calendarDayKey(d) === selKey;
            return (
              <button
                key={i}
                type="button"
                className={`mc-day${inMonth ? '' : ' other'}${isToday(d) ? ' today' : ''}${sel ? ' sel' : ''}`}
                onClick={() => setSelected(new Date(d.getFullYear(), d.getMonth(), d.getDate()))}
              >
                <span>{d.getDate()}</span>
                {hasEvent && <i className="mc-dot" />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="ccb-agenda">
        <div className="cc-agenda-head">
          {isToday(selected) ? 'Today' : selected.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
        {agenda.length > 0 ? (
          <div className="col" style={{ gap: 8 }}>
            {agenda.map((e, i) => (
              <div key={i} className="cc-agenda-item">
                <i className="mc-dot" style={{ position: 'static' }} />
                <span className="cc-agenda-title">{e.title}</span>
                <span className="mute" style={{ fontSize: 11.5 }}>{e.time}</span>
              </div>
            ))}
            {onOpenCalendar && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginTop: 2 }} onClick={onOpenCalendar}>Open calendar →</button>}
          </div>
        ) : (
          <div className="col" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span className="mute" style={{ fontSize: 12.5 }}>Nothing scheduled for this day.</span>
            {onOpenCalendar && (
              <button type="button" className="btn btn-sm btn-primary" onClick={onOpenCalendar}>+ Schedule an event</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function LiveClockDisplay({
  timezone = CENTRAL_HENDERSON_TIMEZONE,
  variant = 'classic',
  className = '',
}: {
  timezone?: string;
  variant?: 'classic' | 'redesign';
  className?: string;
}) {
  const { format, now } = useChurchClock(timezone);
  const time = format({ hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const date = format({ weekday: 'short', month: 'short', day: 'numeric' });

  if (variant === 'redesign') {
    return (
      <div className={`live-clock ${className}`} title={now.toLocaleString()}>
        <CalendarDays size={13} />
        <span className="lc-date">{date}</span>
        <span className="lc-time">{time}</span>
      </div>
    );
  }

  return (
    <div
      className={`hidden lg:flex items-center gap-2 px-2.5 py-1 text-xs text-gray-600 dark:text-dark-300 bg-stone-100 dark:bg-dark-800 rounded-full border border-stone-200 dark:border-dark-700 tabular-nums ${className}`}
      title={now.toLocaleString()}
    >
      <CalendarDays size={13} className="text-indigo-500 flex-shrink-0" />
      <span className="font-medium">{date}</span>
      <span className="text-gray-900 dark:text-dark-100 font-semibold">{time}</span>
    </div>
  );
}
