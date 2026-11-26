import type { RegistrationStatus } from '@/types/api';

export type PaymentStatus = 'paid' | 'refunding' | 'refunded' | 'not_refundable';

export interface StaffPerson {
  name: string;
  email: string;
}

export interface StaffPayment {
  id: number;
  race: { id: number; name: string };
  team: { id: number; name: string };
  owner: StaffPerson | null;
  paid_by: StaffPerson | null;
  payment_type: string;
  amount_cents: number;
  paid_at: string;
  status: PaymentStatus;
  refunded_at: string | null;
  refunded_by: { name: string } | null;
  /** A reopened payment stays `refunded` (it is history); the team can pay again. */
  reopened_at: string | null;
  reopened_by: { name: string } | null;
}

export interface PaymentsSummary {
  count: number;
  refunded_count: number;
  total_cents: number;
  refunded_cents: number;
}

export interface PaymentsMeta {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
  refund_batch_limit: number;
  summary: PaymentsSummary;
}

export interface PaymentsFilterOptions {
  /** The race the server chose (or `all`); null when no race exists. */
  race_id: number | 'all' | null;
  races: { id: number; name: string; registration_status: RegistrationStatus }[];
  payment_types: { id: number; name: string }[];
}

export interface PaymentsResponse {
  payments: StaffPayment[];
  /** True for operators and admins; refunders may only refund. */
  can_reopen: boolean;
  meta: PaymentsMeta;
  filters: PaymentsFilterOptions;
}

/** The statuses Browse filters on; the server also knows refunding and not_refundable. */
export type BrowseStatus = Extract<PaymentStatus, 'paid' | 'refunded'>;

export interface PaymentFilterValues {
  /** Absent means the server's default race; `all` means every race. */
  raceId?: number | 'all';
  paymentType?: number;
  status: BrowseStatus | 'all';
  q: string;
  page: number;
}

export type RefundItemStatus =
  | 'queued'
  | 'refunded'
  | 'already_refunded'
  | 'failed'
  | 'stalled'
  /** Refunded at Stripe, but reopening the payment failed. */
  | 'reopen_failed';

export interface RefundBatchItem {
  id: number;
  completed_requirement_id: number;
  team_name: string;
  payment_type: string;
  amount_cents: number | null;
  status: RefundItemStatus;
  reopened: boolean;
  error_code: string | null;
  message: string | null;
  finished_at: string | null;
}

export interface RefundBatch {
  id: number;
  created_at: string;
  finished_at: string | null;
  retry_of_id: number | null;
  reopen: boolean;
  items: RefundBatchItem[];
}

export interface CreateRefundBatchVariables {
  ids: number[];
  confirmation: string;
  expectedTotalCents: number;
  /** Refund and reopen the payments so the teams can pay again. */
  reopen: boolean;
}

export interface ReopenPaymentResult {
  id: number;
  message: string;
  reopened_at: string;
  reopened_by: { name: string };
}
