import { t } from '@/locales/en';
import { fromWallClock, isInPast } from '@/lib/zoned-time';

export type DateField = 'registration_open' | 'registration_close' | 'final_edits_close' | 'race_datetime';

/** In the order they happen, which is also the order they must be in. */
export const DATE_FIELDS: readonly DateField[] = [
  'registration_open',
  'registration_close',
  'final_edits_close',
  'race_datetime',
];

export const DATE_LABELS: Record<DateField, string> = {
  registration_open: t('staff.races.dates.registration_open'),
  registration_close: t('staff.races.dates.registration_close'),
  final_edits_close: t('staff.races.dates.final_edits_close'),
  race_datetime: t('staff.races.dates.race_datetime'),
};

export interface DateChecks {
  errors: Partial<Record<DateField, string>>;
  warnings: Partial<Record<DateField, string>>;
}

const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** The wall clock as a UTC date, so formatting it needs no time zone. */
function wallAsDate(wall: string): Date | null {
  const match = WALL.exec(wall);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

function formatWall(wall: string, options: Intl.DateTimeFormatOptions): string {
  const date = wallAsDate(wall);
  return date ? new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date) : '';
}

/** `Mar 14` */
export const wallDay = (wall: string) => formatWall(wall, { month: 'short', day: 'numeric' });

/** `2:30 AM` */
export const wallTime = (wall: string) =>
  formatWall(wall, { hour: 'numeric', minute: '2-digit', hour12: true });

/** `Sat, Mar 6, 10:00 AM` */
const wallWhen = (wall: string) =>
  formatWall(wall, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

/**
 * Checks the four race dates (`datetime-local` wall clocks read in `timeZone`). An error blocks a
 * save; a warning does not. Order is checked on adjacent pairs only, and the first failing pair is
 * reported on its earlier field.
 */
export function checkDates(values: Record<DateField, string>, timeZone: string, now: Date = new Date()): DateChecks {
  const errors: DateChecks['errors'] = {};
  const warnings: DateChecks['warnings'] = {};
  const instants: Partial<Record<DateField, number>> = {};

  for (const field of DATE_FIELDS) {
    const wall = values[field];
    if (!wall) {
      errors[field] = t('staff.races.dates.required');
      continue;
    }
    const iso = fromWallClock(wall, timeZone);
    if (iso === null) {
      // A blank zone also gives null; it has no gap to describe, and the zone field reports it.
      if (timeZone && wallAsDate(wall)) {
        errors[field] = t('staff.races.dates.gap', { time: wallTime(wall), day: wallDay(wall), zone: timeZone });
      }
      continue;
    }
    instants[field] = new Date(iso).getTime();
  }

  for (const [index, field] of DATE_FIELDS.slice(0, -1).entries()) {
    const next = DATE_FIELDS[index + 1];
    const [from, to] = [instants[field], instants[next]];
    if (from === undefined || to === undefined || from < to) continue;
    errors[field] = t('staff.races.dates.order', { label: DATE_LABELS[next], when: wallWhen(values[next]) });
    break;
  }

  for (const field of DATE_FIELDS) {
    if (errors[field] || !isInPast(values[field], timeZone, now)) continue;
    warnings[field] = t(field === 'registration_open' ? 'staff.races.dates.pastOpen' : 'staff.races.dates.past');
  }

  return { errors, warnings };
}
