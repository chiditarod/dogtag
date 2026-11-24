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
  races: { id: number; name: string; registration_status: string }[];
  payment_types: { id: number; name: string }[];
}

export interface PaymentsResponse {
  payments: StaffPayment[];
  meta: PaymentsMeta;
  filters: PaymentsFilterOptions;
}

export interface PaymentFilterValues {
  /** Absent means the server's default race; `all` means every race. */
  raceId?: number | 'all';
  paymentType?: number;
  status: PaymentStatus | 'all';
  q: string;
  page: number;
}
