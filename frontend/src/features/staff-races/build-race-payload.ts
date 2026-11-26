import { toWallClock } from '@/lib/zoned-time';
import type { RacePayload, StaffRace, StaffRaceDefaults } from './api/types';
import { DATE_FIELDS, type DateField } from './date-checks';
import { parseJsonform } from './jsonform-text';

/** What the form holds. Numbers stay text while typed; dates are `datetime-local` wall clocks in `time_zone`. */
export interface RaceFormValues extends Record<DateField, string> {
  name: string;
  time_zone: string;
  max_teams: string;
  people_per_team: string;
  jsonform: string;
  filter_field: string[];
  experience_labels_text: string;
  classy_campaign_id: string;
  classy_default_goal: string;
  confirmation_text: string;
}

const text = (value: number | string | null | undefined) => (value === null || value === undefined ? '' : String(value));

/** The form's starting values from a saved race, or from the blank form's defaults. */
export function raceFormValues(race: StaffRace | StaffRaceDefaults): RaceFormValues {
  const zone = race.time_zone;
  return {
    name: text(race.name),
    time_zone: zone,
    max_teams: text(race.max_teams),
    people_per_team: text(race.people_per_team),
    registration_open: toWallClock(race.registration_open, zone),
    registration_close: toWallClock(race.registration_close, zone),
    final_edits_close: toWallClock(race.final_edits_close, zone),
    race_datetime: toWallClock(race.race_datetime, zone),
    jsonform: text(race.jsonform),
    filter_field: [...race.filter_field],
    experience_labels_text: text(race.experience_labels_text),
    classy_campaign_id: text(race.classy_campaign_id),
    classy_default_goal: text(race.classy_default_goal),
    confirmation_text: text(race.confirmation_text),
  };
}

const number = (value: string) => (value.trim() === '' ? null : Number(value));
const blankToNull = (value: string) => (value.trim() === '' ? null : value);

/** How each non-date field goes into the payload. */
const FIELDS: { [K in Exclude<keyof RacePayload, DateField | 'time_zone'>]-?: (values: RaceFormValues) => RacePayload[K] } = {
  name: (v) => v.name,
  max_teams: (v) => number(v.max_teams),
  people_per_team: (v) => number(v.people_per_team),
  // Blank text and JSON that defines no questions are both a race without questions, which the server stores as null.
  jsonform: (v) => {
    const parsed = parseJsonform(v.jsonform);
    return parsed.ok && parsed.jsonform === null ? null : v.jsonform;
  },
  experience_labels_text: (v) => v.experience_labels_text,
  classy_campaign_id: (v) => number(v.classy_campaign_id),
  classy_default_goal: (v) => number(v.classy_default_goal),
  confirmation_text: (v) => blankToNull(v.confirmation_text),
  filter_field: (v) => [...v.filter_field],
};

/**
 * The request body. A new race sends everything; an edit sends the fields that changed. A zone change
 * re-reads every date in the new zone, so the server needs all four with it.
 */
export function buildRacePayload(initial: RaceFormValues, current: RaceFormValues, isNew: boolean): RacePayload {
  const payload: RacePayload = {};
  const changed = (key: keyof RaceFormValues) => JSON.stringify(initial[key]) !== JSON.stringify(current[key]);

  for (const key of Object.keys(FIELDS) as (keyof typeof FIELDS)[]) {
    if (isNew || changed(key)) Object.assign(payload, { [key]: FIELDS[key](current) });
  }

  const zoneChanged = !isNew && changed('time_zone');
  if (isNew || zoneChanged) payload.time_zone = current.time_zone;
  for (const field of DATE_FIELDS) {
    if (isNew || zoneChanged || changed(field)) payload[field] = current[field];
  }
  return payload;
}
