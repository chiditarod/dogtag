import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { RefundBatch } from '../types';

/** Re-queues a batch's failed and stalled items as a new batch (one retry per batch, not per row). */
export function useRetryRefundBatch() {
  return useMutation({
    mutationFn: async (batchId: number) =>
      (await apiFetch<{ batch: RefundBatch }>(`/staff/refund_batches/${batchId}/retry`, { method: 'POST' })).batch,
  });
}
