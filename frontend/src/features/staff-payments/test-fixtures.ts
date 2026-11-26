import type { PaymentsResponse, RefundBatch, RefundBatchItem, StaffPayment } from './types';

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
    reopened_at: null,
    reopened_by: null,
    ...overrides,
  };
}

export const emptyPayments: PaymentsResponse = {
  payments: [],
  can_reopen: false,
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

export function batchItem(overrides: Partial<RefundBatchItem> = {}): RefundBatchItem {
  return {
    id: 1,
    completed_requirement_id: 1,
    team_name: 'The Secret Gents',
    payment_type: 'Cart Deposit',
    amount_cents: 5000,
    status: 'queued',
    reopened: false,
    error_code: null,
    message: null,
    finished_at: null,
    ...overrides,
  };
}

export function refundBatch(overrides: Partial<RefundBatch> = {}): RefundBatch {
  return {
    id: 9,
    created_at: '2026-11-24T18:00:00Z',
    finished_at: null,
    retry_of_id: null,
    reopen: false,
    items: [batchItem()],
    ...overrides,
  };
}
