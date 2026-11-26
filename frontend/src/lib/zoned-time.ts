// Converts between `datetime-local` wall-clock strings (YYYY-MM-DDTHH:mm) and ISO instants in an
// IANA zone, using only Intl. Race dates are entered and shown in the race's own zone, not the
// browser's.

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, name: 'parts' | 'abbreviation') {
  const key = `${name}|${timeZone}`;
  let format = formatters.get(key);
  if (!format) {
    format =
      name === 'parts'
        ? new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            // h23 so midnight is "00", not the "24" some engines give with h24/hour12: false.
            hourCycle: 'h23',
          })
        : new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' });
    formatters.set(key, format);
  }
  return format;
}

/** The zone's wall clock at an instant, read as if it were UTC. */
function wallClockAsUtc(ms: number, timeZone: string): number {
  const values: Record<string, number> = {};
  for (const part of formatter(timeZone, 'parts').formatToParts(new Date(ms))) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour % 24,
    values.minute,
    values.second,
  );
}

/** offset(t) = wall-clock-of(t in zone) - t, in milliseconds. */
function offsetAt(ms: number, timeZone: string): number {
  // Drop milliseconds: the formatter only has whole seconds.
  const whole = Math.floor(ms / 1000) * 1000;
  return wallClockAsUtc(whole, timeZone) - whole;
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, '0');
}

function parseWallClock(wall: string): number | null {
  const match = WALL_CLOCK.exec(wall);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const ms = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(ms);
  // Date.UTC rolls 2027-02-31 over to March; refuse it instead.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }
  return ms;
}

/** The `datetime-local` value for an instant in the zone; '' for null or an invalid instant. */
export function toWallClock(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const local = new Date(wallClockAsUtc(ms, timeZone));
  return (
    `${pad(local.getUTCFullYear(), 4)}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`
  );
}

/**
 * The ISO instant for a wall clock in the zone. Null when the string is not a wall clock or the
 * time does not exist there (a spring-forward gap). An ambiguous fall-back time gives the earlier
 * instant.
 */
export function fromWallClock(wall: string, timeZone: string): string | null {
  const guess = parseWallClock(wall);
  if (guess === null) return null;

  // The zone's offset before and after the guess; a clock change within a day of it shows up in
  // one of the two. Whatever candidate reads back as the same wall clock is a real instant.
  const candidates = new Set([
    guess - offsetAt(guess - DAY_MS, timeZone),
    guess - offsetAt(guess + DAY_MS, timeZone),
    guess - offsetAt(guess, timeZone),
  ]);
  const valid = [...candidates]
    .map((ms) => new Date(ms).toISOString())
    .filter((iso) => toWallClock(iso, timeZone) === wall)
    .sort();
  return valid[0] ?? null;
}

/** e.g. `CST` or `CDT`; zones without a short English name give something like `GMT+1`. */
export function zoneAbbreviation(wall: string, timeZone: string): string {
  const guess = parseWallClock(wall);
  if (guess === null) return '';
  // A wall clock that does not exist is read as UTC.
  const instant = fromWallClock(wall, timeZone);
  const ms = instant ? new Date(instant).getTime() : guess;
  return (
    formatter(timeZone, 'abbreviation')
      .formatToParts(new Date(ms))
      .find((part) => part.type === 'timeZoneName')?.value ?? ''
  );
}

/** True when the wall clock is before `now`. False for a blank or nonexistent wall clock. */
export function isInPast(wall: string, timeZone: string, now: Date = new Date()): boolean {
  const iso = fromWallClock(wall, timeZone);
  return iso !== null && new Date(iso).getTime() < now.getTime();
}
