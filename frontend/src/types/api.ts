/** Shared shapes returned by /api/v1. */

export interface PaymentRequirement {
  id: number;
  name: string;
  type: string;
  current_price_cents: number | null;
  next_tier: { price_cents: number; begins_at: string } | null;
}

export interface Race {
  id: number;
  name: string;
  race_datetime: string;
  registration_open: string;
  registration_close: string;
  final_edits_close: string;
  /** IANA zone the race's dates are shown in, e.g. America/Chicago. */
  time_zone: string;
  open_for_registration: boolean;
  full: boolean;
  people_per_team: number;
  experience_labels: string[];
  jsonform: Record<string, unknown> | null;
  stripe_publishable_key: string | null;
  payment_requirements: PaymentRequirement[];
}

export interface Person {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  zipcode: string | null;
  experience: number | null;
  twitter: string | null;
}

export interface ChecklistNextTier {
  price_cents: number;
  begins_at: string;
}

/** One payment requirement of the fee, e.g. a cart deposit or the race registration. */
export interface FeeItem {
  requirement_id: number;
  name: string;
  done: boolean;
  /** Current price; null once paid or before its first tier opens. */
  amount_due_cents: number | null;
  paid_cents: number;
  /** Upcoming price change; null once paid. */
  next_tier: ChecklistNextTier | null;
}

export interface Checklist {
  racers: { filled: number; total: number; done: boolean };
  questions: { required: boolean; done: boolean };
  fee: {
    done: boolean;
    amount_due_cents: number | null;
    paid_cents: number;
    next_tier: ChecklistNextTier | null;
    requirement_id: number | null;
    items: FeeItem[];
  };
  finalized: boolean;
  remaining: number;
  team_number: number | null;
  classy_fundraising_url: string | null;
  /** The race has a Classy campaign, so a fundraising page will be created. */
  classy_expected: boolean;
}

export interface Team {
  id: number;
  name: string;
  description: string | null;
  experience: number | null;
  race: Race;
  people: Person[];
  checklist: Checklist;
}
