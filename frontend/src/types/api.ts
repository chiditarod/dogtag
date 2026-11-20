/** Shared shapes returned by /api/v1. */

export interface PaymentRequirement {
  id: number;
  name: string;
  type: string;
  current_price_cents: number | null;
  next_tier: { price_cents: number; begins_at: string } | null;
}

export type RegistrationStatus = 'open' | 'waitlist' | 'closed' | 'not_yet_open';

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
  /** Server-decided group: open, waitlist, closed (registration over) or not_yet_open. */
  registration_status: RegistrationStatus;
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
  instagram: string | null;
  tiktok: string | null;
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
  /** The race's confirmation text rendered to safe HTML, or null when it has none. */
  confirmation_html: string | null;
  /** The captain has not yet seen the completion confirmation. */
  show_confirmation: boolean;
}

export interface Team {
  id: number;
  name: string;
  description: string | null;
  experience: number | null;
  /** Not finalized and nothing paid, so it can still be deleted. */
  deletable: boolean;
  race: Race;
  people: Person[];
  checklist: Checklist;
}
