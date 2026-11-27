import type { Fee, FeeRace, FeeResponse, FeeTier } from './api/types';

export const FEE_ZONE = 'America/Chicago';

export function feeRace(overrides: Partial<FeeRace> = {}): FeeRace {
  return {
    id: 1,
    name: 'CHIditarod 2027',
    time_zone: FEE_ZONE,
    registration_open: '2026-12-07T18:00:00Z',
    ...overrides,
  };
}

export function feeTier(overrides: Partial<FeeTier> = {}): FeeTier {
  return {
    id: 1,
    price_cents: 12000,
    begin_at: '2026-12-07T06:00:00Z',
    status: 'current',
    can_destroy: true,
    destroy_blocked_reason: null,
    ...overrides,
  };
}

/** A card fee with a current $120 price and a later $140 one, no payments. */
export function fee(overrides: Partial<Fee> = {}): Fee {
  const tiers = overrides.tiers ?? [
    feeTier(),
    feeTier({ id: 2, price_cents: 14000, begin_at: '2027-02-01T06:00:00Z', status: 'next' }),
  ];
  return {
    id: 10,
    race_id: 1,
    name: 'Registration Fee',
    type: 'PaymentRequirement',
    enabled: true,
    current_tier: { price_cents: 12000, begin_at: tiers[0]?.begin_at ?? '2026-12-07T06:00:00Z' },
    next_tier: { price_cents: 14000, begin_at: '2027-02-01T06:00:00Z' },
    paid_team_count: 0,
    tiers,
    can_destroy: true,
    destroy_blocked_reason: null,
    ...overrides,
  };
}

export function feeResponse(overrides: Partial<Fee> = {}, race: Partial<FeeRace> = {}): FeeResponse {
  return { requirement: fee(overrides), race: feeRace(race) };
}

export const TIME_ZONES = ['America/Chicago', 'America/New_York', 'Europe/London'];

/** The race as `GET /staff/races/:id` returns it, for tests that land on the race overview. */
export function raceOverview(id: number) {
  return {
    id,
    name: 'CHIditarod 2027',
    race_datetime: '2027-03-13T17:00:00Z',
    registration_open: '2026-12-07T18:00:00Z',
    registration_close: '2027-02-02T06:00:00Z',
    final_edits_close: '2027-03-02T06:00:00Z',
    time_zone: FEE_ZONE,
    max_teams: 100,
    registration_status: 'open',
    setup_problems: [],
    people_per_team: 5,
    jsonform: null,
    classy_campaign_id: null,
    classy_default_goal: null,
    confirmation_text: null,
    confirmation_text_max_length: 5000,
    full: false,
    filter_field: [],
    experience_labels_text: 'New\nVeteran',
    money: { gross_cents: 0, refunded_cents: 0, net_cents: 0 },
    teams: { finalized: 0, total: 0, registering: 0 },
    racer_emails: [],
    payment_requirements: [],
    can_destroy: false,
    has_teams: false,
  };
}
