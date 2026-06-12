import { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useChurchClock } from '../../hooks/useChurchClock';
import { calendarDayKey } from '../../lib/calendarEvents';
import { CENTRAL_HENDERSON_TIMEZONE } from '../../config/centralHenderson';

export type DayAgendaEvent = { title: string; time: string };

const MC_DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function AnalogClockSvg({ zoned, className }: { zoned: { hour12: number; minute: number; second: number }; className?: string }) {
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
    <svg viewBox="0 0 100 100" className={className} width="64" height="64" aria-label="Current time">
      <circle cx="50" cy="50" r="47" className="fill-white stroke-stone-300 dark:stroke-dark-600 dark:fill-dark-800" strokeWidth="1" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 - 90) * Math.PI / 180;
        const r1 = i % 3 === 0 ? 38 : 41;
        const r2 = 45;
        return (
          <line
            key={i}
            x1={50 + r1 * Math.cos(a)}
            y1={50 + r1 * Math.sin(a)}
            x2={50 + r2 * Math.cos(a)}
            y2={50 + r2 * Math.sin(a)}
            className={i % 3 === 0 ? 'stroke-gray-400 dark:stroke-dark-400' : 'stroke-gray-300 dark:stroke-dark-600'}
            strokeWidth={i % 3 === 0 ? 1.5 : 1}
          />
        );
      })}
      <line x1="50" y1="50" x2={hr.x2} y2={hr.y2} className="stroke-gray-800 dark:stroke-dark-100" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="50" y1="50" x2={mn.x2} y2={mn.y2} className="stroke-gray-700 dark:stroke-dark-200" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="50" x2={sc.x2} y2={sc.y2} className="stroke-indigo-500" strokeWidth="1" strokeLinecap="round" />
      <circle cx="50" cy="50" r="3" className="fill-indigo-500" />
    </svg>
  );
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
  const first = new Date(viewMonth.getFullYear(), month, 1);
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

  const shiftMonth = (delta: number) => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const selKey = calendarDayKey(selected);
  const agenda = eventsByDay[selKey] ?? [];
  const isToday = (d: Date) => calendarDayKey(d) === churchTodayKey;

  const timeShort = format({ hour: 'numeric', minute: '2-digit' });
  const dateLong = format({ weekday: 'long', month: 'long', day: 'numeric' });
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (variant === 'redesign') {
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
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] gap-0 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 dark:divide-dark-700">
        <div className="flex flex-col items-center justify-center gap-1 px-6 py-5 min-w-[140px]">
          <AnalogClockSvg zoned={zoned} />
          <div className="text-lg font-semibold text-gray-900 dark:text-dark-100 tabular-nums">{timeShort}</div>
          <div className="text-xs text-gray-500 dark:text-dark-400 text-center">{dateLong}</div>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-900 dark:text-dark-100">{monthLabel}</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-dark-800 text-gray-500" title="Previous month">
                <ChevronLeft size={14} />
              </button>
              <button type="button" onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-dark-800 text-gray-500" title="Next month">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {MC_DOW.map((d, i) => (
              <div key={i} className="text-[10px] font-semibold text-gray-400 dark:text-dark-500 py-1">{d}</div>
            ))}
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === month;
              const hasEvent = eventSet.has(calendarDayKey(d));
              const sel = calendarDayKey(d) === selKey;
              const today = isToday(d);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(new Date(d.getFullYear(), d.getMonth(), d.getDate()))}
                  className={`relative aspect-square rounded-lg text-xs font-medium transition-colors ${
                    !inMonth ? 'text-gray-300 dark:text-dark-600' : 'text-gray-700 dark:text-dark-200'
                  } ${today ? 'bg-indigo-500 text-white' : sel ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' : 'hover:bg-stone-100 dark:hover:bg-dark-800'}`}
                >
                  {d.getDate()}
                  {hasEvent && !today && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-400 mb-3">
            {isToday(selected) ? 'Today' : selected.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          {agenda.length > 0 ? (
            <div className="space-y-2 flex-1">
              {agenda.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                  <span className="font-medium text-gray-900 dark:text-dark-100 flex-1 truncate">{e.title}</span>
                  <span className="text-xs text-gray-500 dark:text-dark-400 tabular-nums">{e.time}</span>
                </div>
              ))}
              {onOpenCalendar && (
                <button type="button" onClick={onOpenCalendar} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-1">
                  Open calendar →
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 flex-1">
              <p className="text-sm text-gray-500 dark:text-dark-400">Nothing scheduled for this day.</p>
              {onOpenCalendar && (
                <button type="button" onClick={onOpenCalendar} className="btn btn-primary btn-sm inline-flex items-center gap-1.5">
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
  // Lazy import redesign Icon only when variant is redesign — use inline SVG for arrows to avoid circular deps
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
        <Calendar size={13} />
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
      <Calendar size={13} className="text-indigo-500 flex-shrink-0" />
      <span className="font-medium">{date}</span>
      <span className="text-gray-900 dark:text-dark-100 font-semibold">{time}</span>
    </div>
  );
}
