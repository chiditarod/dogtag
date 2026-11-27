import type { StaffRace, StaffRaceSummary } from './api/types';

/** A short stand-in for the zone list the API sends. */
export const TIME_ZONES = ['America/Chicago', 'America/New_York', 'Europe/London'];

export function staffRaceSummary(overrides: Partial<StaffRaceSummary> = {}): StaffRaceSummary {
  return {
    id: 1,
    name: 'CHIditarod 2027',
    race_datetime: '2027-03-13T17:00:00Z',
    registration_open: '2026-12-07T18:00:00Z',
    registration_close: '2027-02-02T06:00:00Z',
    final_edits_close: '2027-03-02T06:00:00Z',
    time_zone: 'America/Chicago',
    max_teams: 100,
    registration_status: 'open',
    setup_problems: [],
    teams: { finalized: 40, total: 52 },
    ...overrides,
  };
}

const { teams: _summaryTeams, ...summaryBase } = staffRaceSummary();

/** The full race as `GET /staff/races/:id` returns it (an operator's view: no delete). */
export function staffRace(overrides: Partial<StaffRace> = {}): StaffRace {
  return {
    ...summaryBase,
    people_per_team: 5,
    jsonform: JSON.stringify({
      schema: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } } },
      form: ['a', 'b'],
    }),
    classy_campaign_id: 12345,
    classy_default_goal: 1500,
    confirmation_text: 'See you at the start line.',
    confirmation_text_max_length: 5000,
    full: false,
    filter_field: ['racer-type'],
    experience_labels_text: 'New\nVeteran',
    money: { gross_cents: 710000, refunded_cents: 10000, net_cents: 700000 },
    teams: { finalized: 40, total: 52, registering: 12 },
    racer_emails: ['ada@example.com', 'bo@example.com'],
    payment_requirements: [
      {
        id: 9,
        name: 'Registration Fee',
        type: 'PaymentRequirement',
        enabled: true,
        current_price_cents: 11500,
        tier_count: 3,
      },
    ],
    can_destroy: false,
    has_teams: true,
    ...overrides,
  };
}
