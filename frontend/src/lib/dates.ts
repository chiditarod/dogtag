/** Used only when the API response has no `time_zone` (or an unknown one). */
export const DEFAULT_TIME_ZONE = 'America/Chicago';

export type TimeZone = string | null | undefined;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(key: string, options: Intl.DateTimeFormatOptions, timeZone: TimeZone) {
  const zone = timeZone || DEFAULT_TIME_ZONE;
  const cacheKey = `${key}|${zone}`;
  let format = formatters.get(cacheKey);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat('en-US', { ...options, timeZone: zone });
    } catch {
      // RangeError for an unknown zone.
      format = new Intl.DateTimeFormat('en-US', { ...options, timeZone: DEFAULT_TIME_ZONE });
    }
    formatters.set(cacheKey, format);
  }
  return format;
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

const CLOCK_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
};

/** e.g. "Sat, Mar 6, 2027", in the race's time zone. Use for openings and start times. */
export function formatDate(iso: string, timeZone: TimeZone): string {
  return formatter('date', DATE_OPTIONS, timeZone).format(new Date(iso));
}

/** e.g. "Dec 8", in the passed zone. */
export function formatShortDay(iso: string, timeZone: TimeZone): string {
  return formatter('short-day', { month: 'short', day: 'numeric' }, timeZone).format(new Date(iso));
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "just now", "3 hours ago", or from a day on the short day (e.g. "Dec 8"). */
export function formatSince(iso: string, timeZone: TimeZone, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return relative.format(-minutes, 'minute');
  if (elapsed < 24 * 3_600_000) return relative.format(-Math.floor(minutes / 60), 'hour');
  return formatShortDay(iso, timeZone);
}

function isLocalMidnight(date: Date, timeZone: TimeZone): boolean {
  if (date.getUTCMilliseconds() !== 0) return false;
  const parts = formatter('clock', CLOCK_OPTIONS, timeZone).formatToParts(date);
  return ['hour', 'minute', 'second'].every(
    (type) => Number(parts.find((part) => part.type === type)?.value) === 0,
  );
}

/**
 * Like formatDate, for deadlines (e.g. registration close). A deadline at
 * exactly local midnight is shown as the previous day (it ends at 11:59 pm),
 * so "closes Feb 15 00:00" reads as "closes Sun, Feb 14".
 */
export function formatDeadline(iso: string, timeZone: TimeZone): string {
  const date = new Date(iso);
  const shown = isLocalMidnight(date, timeZone) ? new Date(date.getTime() - 60_000) : date;
  return formatter('date', DATE_OPTIONS, timeZone).format(shown);
}
