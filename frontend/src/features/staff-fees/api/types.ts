import { t } from '@/locales/en';

/** The race a fee belongs to, as the staff fee endpoints send it. */
export interface FeeRace {
  id: number;
  name: string;
  /** IANA zone the prices' start times are read and shown in. */
  time_zone: string;
  /** ISO moment. */
  registration_open: string;
}

/** `current` applies now, `next` is the soonest later one, `past` has been replaced, `later` is after `next`. */
export type FeeTierStatus = 'current' | 'next' | 'past' | 'later';

/** One price of a fee; only prices with a start are listed. */
export interface FeeTier {
  id: number;
  price_cents: number;
  /** ISO moment. */
  begin_at: string;
  status: FeeTierStatus;
  can_destroy: boolean;
  /** Why `can_destroy` is false, or null. */
  destroy_blocked_reason: string | null;
}

export interface FeePrice {
  price_cents: number;
  begin_at: string;
}

export interface Fee {
  id: number;
  race_id: number;
  name: string;
  /** A requirement class name, e.g. `PaymentRequirement`; see `FEE_TYPE_LABELS`. */
  type: string;
  /** False while no price is active. */
  enabled: boolean;
  current_tier: FeePrice | null;
  next_tier: FeePrice | null;
  /** Teams that paid and were not refunded. */
  paid_team_count: number;
  /** Prices in start order. */
  tiers: FeeTier[];
  can_destroy: boolean;
  destroy_blocked_reason: string | null;
}

/** Body of fee show/create/update and of every price write. */
export interface FeeResponse {
  requirement: Fee;
  race: FeeRace;
}

/** `GET /staff/races/:race_id/requirements`; `types` are the type names a new fee may use. */
export interface FeesResponse {
  race: FeeRace;
  requirements: Fee[];
  types: string[];
}

/** A new fee is created with its first price. `price` is cents; `begin_at` an ISO moment. */
export interface NewFeePayload {
  requirement: { name: string; type: string };
  tier: { price: number; begin_at: string };
}

/** Only the keys sent change. `price` is cents. */
export interface TierPayload {
  price?: number;
  begin_at?: string;
}

/** What the type select and the fee list call each requirement type. */
export const FEE_TYPE_LABELS: Record<string, string> = {
  PaymentRequirement: t('staff.fees.typeCard'),
  MockPaymentRequirement: t('staff.fees.typeMock'),
};
