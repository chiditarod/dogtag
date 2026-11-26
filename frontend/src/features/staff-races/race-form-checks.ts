import { t } from '@/locales/en';
import type { RaceFormValues } from './build-race-payload';
import { DATE_FIELDS, checkDates, type DateChecks } from './date-checks';
import { parseJsonform } from './jsonform-text';

/** Characters as the server counts them (code points, not UTF-16 units). */
export const confirmationLength = (text: string) => Array.from(text).length;

export type FormField =
  | 'name'
  | 'time_zone'
  | 'max_teams'
  | 'people_per_team'
  | 'classy_campaign_id'
  | 'classy_default_goal';

export interface FormChecks {
  /** Problems in the plain fields, by field. */
  fields: Partial<Record<FormField, string>>;
  dates: DateChecks;
  /** The questions text does not parse (the editor says where). */
  jsonformBroken: boolean;
  confirmationTooLong: boolean;
  /** Any of the above: Save must not send. */
  blocked: boolean;
}

const POSITIVE_INTEGER = /^[1-9]\d*$/;

/** The client-side checks before a save; the server still has the last word. */
export function checkRaceForm(values: RaceFormValues, confirmationMaxLength: number, now?: Date): FormChecks {
  const fields: FormChecks['fields'] = {};
  if (values.name.trim() === '') fields.name = t('staff.races.form.nameRequired');
  if (values.time_zone === '') fields.time_zone = t('staff.races.dates.timeZoneRequired');
  // The server requires both of these; the Classy ones are optional.
  for (const key of ['max_teams', 'people_per_team'] as const) {
    if (!POSITIVE_INTEGER.test(values[key].trim())) fields[key] = t('staff.races.form.wholeNumber');
  }
  for (const key of ['classy_campaign_id', 'classy_default_goal'] as const) {
    const text = values[key].trim();
    if (text !== '' && !POSITIVE_INTEGER.test(text)) fields[key] = t('staff.races.form.wholeNumber');
  }

  const dates = checkDates(
    Object.fromEntries(DATE_FIELDS.map((field) => [field, values[field]])) as Parameters<typeof checkDates>[0],
    values.time_zone,
    now,
  );
  const jsonformBroken = !parseJsonform(values.jsonform).ok;
  const confirmationTooLong = confirmationLength(values.confirmation_text) > confirmationMaxLength;

  return {
    fields,
    dates,
    jsonformBroken,
    confirmationTooLong,
    blocked:
      Object.keys(fields).length > 0 ||
      Object.keys(dates.errors).length > 0 ||
      jsonformBroken ||
      confirmationTooLong,
  };
}
