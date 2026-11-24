import type { PaymentsResponse, StaffPayment } from './types';

export function payment(overrides: Partial<StaffPayment> = {}): StaffPayment {
  return {
    id: 1,
    race: { id: 4, name: 'CHIditarod 2026' },
    team: { id: 11, name: 'The Secret Gents' },
    owner: { name: 'Ada Owner', email: 'ada@example.com' },
    paid_by: { name: 'Ada Owner', email: 'ada@example.com' },
    payment_type: 'Cart Deposit',
    amount_cents: 5000,
    paid_at: '2026-11-01T18:00:00Z',
    status: 'paid',
    refunded_at: null,
    refunded_by: null,
    ...overrides,
  };
}

export const emptyPayments: PaymentsResponse = {
  payments: [],
  meta: {
    page: 1,
    per_page: 25,
    total_count: 0,
    total_pages: 0,
    refund_batch_limit: 5,
    summary: { count: 0, refunded_count: 0, total_cents: 0, refunded_cents: 0 },
  },
  filters: {
    race_id: 4,
    races: [
      { id: 4, name: 'CHIditarod 2026', registration_status: 'open' },
      { id: 3, name: 'CHIditarod 2025', registration_status: 'closed' },
    ],
    payment_types: [
      { id: 7, name: 'Cart Deposit' },
      { id: 8, name: 'Registration' },
    ],
  },
};
