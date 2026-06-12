import { useCallback, useEffect, useMemo, useState } from 'react';
import { CENTRAL_HENDERSON_TIMEZONE } from '../config/centralHenderson';

export interface ZonedTimeParts {
  hour12: number;
  hour24: number;
  minute: number;
  second: number;
  year: number;
  month: number;
  day: number;
}

function getZonedTimeParts(date: Date, timeZone: string): ZonedTimeParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date)
      .filter(p => p.type !== 'literal')
      .map(p => [p.type, p.value]),
  );
  const hour24 = parseInt(parts.hour, 10);
  return {
    hour12: hour24 % 12,
    hour24,
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10) - 1,
    day: parseInt(parts.day, 10),
  };
}

export function useChurchClock(timezone: string = CENTRAL_HENDERSON_TIMEZONE) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const zoned = useMemo(() => getZonedTimeParts(now, timezone), [now, timezone]);

  const format = useCallback(
    (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone }).format(now),
    [now, timezone],
  );

  const churchToday = useMemo(
    () => new Date(zoned.year, zoned.month, zoned.day),
    [zoned.year, zoned.month, zoned.day],
  );

  const churchTodayKey = useMemo(
    () => `${zoned.year}-${zoned.month}-${zoned.day}`,
    [zoned.year, zoned.month, zoned.day],
  );

  return { now, timezone, zoned, format, churchToday, churchTodayKey };
}
