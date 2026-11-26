import type { RegistrationStatus } from '@/types/api';

/** One race in the staff list (`GET /staff/races`), also the base of the full race. */
export interface StaffRaceSummary {
  id: number;
  name: string;
  /** ISO moments; show them in `time_zone`. */
  race_datetime: string;
  registration_open: string;
  registration_close: string;
  final_edits_close: string;
  /** IANA zone the race's dates are read and shown in. */
  time_zone: string;
  max_teams: number | null;
  registration_status: RegistrationStatus;
  setup_problems: string[];
  /** Counts of teams (the list has no `registering`; the full race adds it). */
  teams: { finalized: number; total: number };
}

export interface StaffRacePaymentRequirement {
  id: number;
  name: string;
  type: string;
  /** False while no tier is active, which is also when `current_price_cents` is null. */
  enabled: boolean;
  current_price_cents: number | null;
  tier_count: number;
}

export interface RaceMoney {
  gross_cents: number;
  refunded_cents: number;
  net_cents: number;
}

/** The full race (`GET /staff/races/:id`, and the body of create and update). */
export interface StaffRace extends Omit<StaffRaceSummary, 'teams'> {
  people_per_team: number | null;
  /** The questions as stored text (a JSON string), not a parsed object. */
  jsonform: string | null;
  classy_campaign_id: number | null;
  classy_default_goal: number | null;
  confirmation_text: string | null;
  confirmation_text_max_length: number;
  full: boolean;
  filter_field: string[];
  /** One label per line. */
  experience_labels_text: string;
  money: RaceMoney;
  teams: { finalized: number; total: number; registering: number };
  /** Distinct emails of racers on finalized teams. */
  racer_emails: string[];
  payment_requirements: StaffRacePaymentRequirement[];
  can_destroy: boolean;
  has_teams: boolean;
}

/**
 * The body of `POST /staff/races` and `PUT /staff/races/:id` (sent as `{ race }`). Dates are wall-clock
 * strings (`2026-12-07T12:00`) read in `time_zone`; when the zone of a saved race changes, send every date.
 * Fields left out are left unchanged.
 */
export interface RacePayload {
  name?: string;
  time_zone?: string;
  max_teams?: number | null;
  people_per_team?: number | null;
  jsonform?: string | null;
  experience_labels_text?: string;
  classy_campaign_id?: number | null;
  classy_default_goal?: number | null;
  confirmation_text?: string | null;
  registration_open?: string;
  registration_close?: string;
  final_edits_close?: string;
  race_datetime?: string;
  filter_field?: string[];
}
