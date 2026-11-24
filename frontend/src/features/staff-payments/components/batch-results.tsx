import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import { isBatchDone, refundBatchQueryKey, useRefundBatch } from '../api/use-refund-batch';
import { useRetryRefundBatch } from '../api/use-retry-refund-batch';
import type { RefundBatch, RefundBatchItem } from '../types';
import { formatMoney } from '../utils';

interface BatchResultsProps {
  batchId: number;
  /** Staff pressed Done (or Escape once the job is over): leave Refund mode and refresh the list. */
  onFinished: () => void;
  /** A retry started a new batch: the page keeps its id in the URL so a reload follows it. */
  onBatchChange?: (batchId: number) => void;
}

const needsAttention = (item: RefundBatchItem) => item.status === 'failed' || item.status === 'stalled';

function itemLabel(item: RefundBatchItem): string {
  switch (item.status) {
    case 'queued':
      return t('staff.refund.queued');
    case 'failed':
      return item.message ? t('staff.refund.item.failed', { message: item.message }) : t('staff.refund.item.failedPlain');
    default:
      return t(`staff.refund.item.${item.status}`);
  }
}

/**
 * The results view of a refund batch, in its own dialog. It polls the batch and cannot be closed while the
 * job runs. A retry is per batch: it re-queues every failed and stalled item as a new batch, and the lines
 * already finished in earlier batches stay on screen.
 */
export function BatchResults({ batchId, onFinished, onBatchChange }: BatchResultsProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const queryClient = useQueryClient();
  const [currentId, setCurrentId] = useState(batchId);
  const [carried, setCarried] = useState<RefundBatchItem[]>([]);
  const { data: batch, isError } = useRefundBatch(currentId);
  const retry = useRetryRefundBatch();

  const done = isBatchDone(batch);
  const items = [...carried, ...(batch?.items ?? [])];
  const finishedCount = items.filter((item) => item.status !== 'queued').length;
  const failed = items.filter(needsAttention);
  const canClose = done || (isError && !batch);

  useEffect(() => titleRef.current?.focus(), []);
  // A finished batch changes the list and the progress line behind the dialog.
  useEffect(() => {
    if (done) void queryClient.invalidateQueries({ queryKey: ['staff', 'payments'] });
  }, [done, currentId, queryClient]);

  function retryFailed(previous: RefundBatch) {
    retry.mutate(previous.id, {
      onSuccess: (next) => {
        // Seed the cache so the retried rows do not flash "2 of 2" while the first poll is on its way.
        queryClient.setQueryData(refundBatchQueryKey(next.id), next);
        setCarried((earlier) => [...earlier, ...previous.items.filter((item) => !needsAttention(item))]);
        setCurrentId(next.id);
        onBatchChange?.(next.id);
      },
    });
  }

  return (
    <DialogSheet labelledBy={titleId} onClose={() => canClose && !retry.isPending && onFinished()} className="sm:max-w-xl">
      <div className="border-b border-flag px-4 py-3">
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="font-display text-xl font-semibold focus:outline-none">
          {done
            ? t('staff.refund.finished')
            : t('staff.refund.running', { done: finishedCount, n: items.length || '…' })}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        {isError && !batch && <p role="alert" className="text-sm font-semibold text-starText">{t('staff.refund.pollError')}</p>}
        <ul aria-label={t('staff.refund.results')} className="divide-y divide-flag">
          {items.map((item) => (
            <li
              key={`${item.id}`}
              data-status={item.status}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2 text-sm"
            >
              <span className="font-semibold [overflow-wrap:anywhere]">{item.team_name}</span>
              <span className="font-semibold">{item.amount_cents === null ? '' : formatMoney(item.amount_cents)}</span>
              <span
                className={`col-span-2 [overflow-wrap:anywhere] ${needsAttention(item) ? 'font-semibold text-starText' : 'text-navy/80'}`}
              >
                {itemLabel(item)}
              </span>
            </li>
          ))}
        </ul>
        {done && failed.length > 0 && (
          <p className="mt-3 text-sm text-navy">
            {t('staff.refund.summary', { ok: items.length - failed.length, bad: failed.length })}
          </p>
        )}
        {retry.isError && (
          <p role="alert" className="mt-2 text-sm font-semibold text-starText">
            {t('staff.refund.retryError', {
              message: retry.error instanceof ApiError ? retry.error.error : t('common.genericError'),
            })}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-flag px-4 py-3 sm:flex-row sm:justify-end">
        {done && batch && failed.length > 0 && (
          <Button variant="secondary" loading={retry.isPending} onClick={() => retryFailed(batch)}>
            {t('staff.refund.retry', { k: batch.items.filter(needsAttention).length })}
          </Button>
        )}
        <Button disabled={!canClose || retry.isPending} onClick={onFinished}>
          {t('staff.refund.done')}
        </Button>
      </div>
    </DialogSheet>
  );
}
