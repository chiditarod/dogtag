import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { CreateRefundBatchVariables, RefundBatch } from '../types';

/** Queues the reviewed payments; the server checks the cap, the typed confirmation and the total again. */
export function useCreateRefundBatch() {
  return useMutation({
    mutationFn: async ({ ids, confirmation, expectedTotalCents, reopen }: CreateRefundBatchVariables) =>
      (
        await apiFetch<{ batch: RefundBatch }>('/staff/refund_batches', {
          method: 'POST',
          json: {
            completed_requirement_ids: ids,
            confirmation,
            expected_total_cents: expectedTotalCents,
            reopen,
          },
        })
      ).batch,
  });
}
