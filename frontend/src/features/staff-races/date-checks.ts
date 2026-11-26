import { t } from '@/locales/en';
import { fromWallClock, isInPast, wallClockProblem, wallWhen } from '@/lib/zoned-time';

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
    const problem = wallClockProblem(wall, timeZone);
    if (problem) {
      errors[field] = problem;
      continue;
    }
    const iso = fromWallClock(wall, timeZone);
    if (iso === null) continue;
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
