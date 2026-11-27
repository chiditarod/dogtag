import { describe, expect, it } from 'vitest';
import { buildRacePayload, raceFormValues, type RaceFormValues } from './build-race-payload';
import { staffRace } from './test-fixtures';

const initial = raceFormValues(staffRace());

describe('raceFormValues', () => {
  it('reads the dates as wall clocks in the race zone and the numbers as text', () => {
    expect(initial).toMatchObject({
      name: 'CHIditarod 2027',
      time_zone: 'America/Chicago',
      registration_open: '2026-12-07T12:00',
      registration_close: '2027-02-02T00:00',
      race_datetime: '2027-03-13T11:00',
      max_teams: '100',
      people_per_team: '5',
      classy_campaign_id: '12345',
      classy_default_goal: '1500',
      filter_field: ['racer-type'],
    });
  });

  it('turns nulls into blanks', () => {
    const values = raceFormValues(
      staffRace({ max_teams: null, jsonform: null, confirmation_text: null, classy_campaign_id: null }),
    );

    expect(values).toMatchObject({ max_teams: '', jsonform: '', confirmation_text: '', classy_campaign_id: '' });
  });
});

describe('buildRacePayload', () => {
  it('sends only the name for an edit that changed only the name, with no dates', () => {
    const payload = buildRacePayload(initial, { ...initial, name: 'Renamed' }, false);

    expect(payload).toEqual({ name: 'Renamed' });
  });

  it('sends nothing for an unchanged edit', () => {
    expect(buildRacePayload(initial, { ...initial }, false)).toEqual({});
  });

  it('sends a changed date as a wall-clock string, and only that date', () => {
    const payload = buildRacePayload(initial, { ...initial, race_datetime: '2027-03-14T10:00' }, false);

    expect(payload).toEqual({ race_datetime: '2027-03-14T10:00' });
  });

  it('sends the zone and all four dates when the zone changed', () => {
    const payload = buildRacePayload(initial, { ...initial, time_zone: 'America/New_York' }, false);

    expect(payload).toEqual({
      time_zone: 'America/New_York',
      registration_open: '2026-12-07T12:00',
      registration_close: '2027-02-02T00:00',
      final_edits_close: '2027-03-02T00:00',
      race_datetime: '2027-03-13T11:00',
    });
  });

  it('sends filter_field as an array when it changed', () => {
    const payload = buildRacePayload(initial, { ...initial, filter_field: ['a', 'b'] }, false);

    expect(payload).toEqual({ filter_field: ['a', 'b'] });
  });

  it('sends numbers, and null for a blank number or blank text', () => {
    const current: RaceFormValues = {
      ...initial,
      max_teams: '',
      people_per_team: '6',
      classy_default_goal: ' 500 ',
      jsonform: '',
      confirmation_text: '',
    };

    expect(buildRacePayload(initial, current, false)).toEqual({
      max_teams: null,
      people_per_team: 6,
      classy_default_goal: 500,
      jsonform: null,
      confirmation_text: null,
    });
  });

  it('sends everything for a new race', () => {
    const payload = buildRacePayload(initial, initial, true);

    expect(Object.keys(payload).sort()).toEqual(
      [
        'name',
        'time_zone',
        'max_teams',
        'people_per_team',
        'jsonform',
        'experience_labels_text',
        'classy_campaign_id',
        'classy_default_goal',
        'confirmation_text',
        'registration_open',
        'registration_close',
        'final_edits_close',
        'race_datetime',
        'filter_field',
      ].sort(),
    );
    expect(payload.filter_field).toEqual(['racer-type']);
    expect(payload.max_teams).toBe(100);
  });
});
