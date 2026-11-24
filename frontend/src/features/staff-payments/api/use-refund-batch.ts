import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { RefundBatch } from '../types';

export const REFUND_POLL_MS = 2000;

export const refundBatchQueryKey = (id: number) => ['staff', 'refund_batch', id] as const;

/**
 * True when nothing more will change: the job set `finished_at`, or no item is still queued (the server
 * reports items stuck queued for 10 minutes as `stalled`, and a dead job never sets `finished_at`).
 */
export function isBatchDone(batch: RefundBatch | undefined): boolean {
  return !!batch && (!!batch.finished_at || batch.items.every((item) => item.status !== 'queued'));
}

/** The batch and its per-item results, polled every 2 s until it is done. */
export function useRefundBatch(id: number | null) {
  return useQuery({
    queryKey: refundBatchQueryKey(id ?? 0),
    queryFn: async () => (await apiFetch<{ batch: RefundBatch }>(`/staff/refund_batches/${id}`)).batch,
    enabled: id != null,
    refetchInterval: (query) => (isBatchDone(query.state.data) ? false : REFUND_POLL_MS),
  });
}
