import { useCallback, useEffect, useId, useState } from 'react';
import { Pagination } from '@/components/list/pagination';
import { Button } from '@/components/ui/button';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { t } from '@/locales/en';
import type { RefundBatch, StaffPayment } from '../types';
import { usePayments } from '../api/use-payments';
import { useActiveBatch } from '../use-active-batch';
import { usePaymentFilters } from '../use-payment-filters';
import { useSelection } from '../use-selection';
import { hasActiveFilters, raceNotFound } from '../utils';
import { FilterChips } from './filter-chips';
import { PaymentFilters } from './payment-filters';
import { PaymentsTable } from './payments-table';
import { ProgressLine } from './progress-line';
import { BatchResults } from './batch-results';
import { ConfirmRefundDialog } from './confirm-refund-dialog';
import { RefundBar } from './refund-bar';

type Mode = 'browse' | 'refund';

export function PaymentsPage() {
  const { values, setFilter, clearAll } = usePaymentFilters();
  const { data, isPending, isError, isPlaceholderData, refetch } = usePayments(values);
  // Refund mode is local state, not in the URL, so a reload returns to Browse.
  const [mode, setMode] = useState<Mode>('browse');
  const refundMode = mode === 'refund';
  const limit = data?.meta.refund_batch_limit ?? 0;
  const selection = useSelection(limit);
  const capNoteId = useId();
  // The rows shown in the confirmation dialog: a snapshot taken when it opened.
  const [reviewing, setReviewing] = useState<StaffPayment[] | null>(null);
  const { batchId, setBatchId } = useActiveBatch();
  const { clear: clearSelection } = selection;

  // A selection belongs to one race: the one in the URL, or (with no race_id, e.g. a team link or the
  // default) the race the server resolved, which can change when team_id is dropped.
  const effectiveRaceId = data?.filters.race_id ?? null;
  useEffect(() => clearSelection(), [values.raceId, effectiveRaceId, clearSelection]);
  // Refund mode only ever works on paid rows (a shared link or Back may have changed the status).
  useEffect(() => {
    if (refundMode && values.status !== 'paid') setFilter('status', 'paid');
  }, [refundMode, values.status, setFilter]);

  // Bumped by Clear all so the search box starts over, dropping text still waiting on its debounce.
  const [searchReset, setSearchReset] = useState(0);
  const clearEverything = useCallback(() => {
    clearAll(refundMode);
    setSearchReset((n) => n + 1);
  }, [clearAll, refundMode]);

  // A stale link or a shrunken result can ask for a page past the end: go to the last page instead.
  const lastPage = data?.meta.total_pages ?? 0;
  const pastEnd = !!data && !isPlaceholderData && lastPage > 0 && data.meta.page > lastPage;
  useEffect(() => {
    if (pastEnd) setFilter('page', lastPage);
  }, [pastEnd, lastPage, setFilter]);

  const active = hasActiveFilters(refundMode ? { ...values, status: 'all' } : values);
  const selectedRows = [...selection.selected.values()];
  // keepPreviousData leaves the old filters' rows on screen while new ones load; they must not be ticked
  // (a selection belongs to one race) and Select next must not read them.
  const nextCount = isPlaceholderData
    ? 0
    : Math.min(
        limit - selection.selected.size,
        data?.payments.filter((row) => row.status === 'paid' && !selection.selected.has(row.id)).length ?? 0,
      );
  const totalCents = selectedRows.reduce((sum, row) => sum + row.amount_cents, 0);

  function enterRefundMode() {
    setMode('refund');
    setFilter('status', 'paid');
  }

  function confirmed(created: RefundBatch) {
    setReviewing(null);
    setBatchId(created.id);
  }

  // Done: refunded rows leave the Paid view, the selection is spent and the page goes back to Browse.
  function finished() {
    setBatchId(null);
    cancelRefundMode();
  }

  function cancelRefundMode() {
    clearSelection();
    setMode('browse');
  }

  return (
    <div className={`space-y-4 ${refundMode ? 'border-t-4 border-star pb-28 pt-3' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">
          {t(refundMode ? 'staff.payments.refundMode.title' : 'staff.payments.heading')}
        </h1>
        {refundMode ? (
          <Button variant="secondary" onClick={cancelRefundMode}>
            {t('staff.payments.refundMode.cancel')}
          </Button>
        ) : (
          <Button onClick={enterRefundMode}>{t('staff.payments.refundMode.enter')}</Button>
        )}
      </div>
      {refundMode && (
        <div className="flex flex-col gap-2 rounded-lg border border-star bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-starText">
            {t('staff.payments.refundMode.banner', { limit })}
          </p>
          <Button
            variant="secondary"
            disabled={nextCount <= 0}
            onClick={() => data && selection.selectNext(data.payments)}
          >
            {t('staff.payments.refundMode.selectNext', { n: Math.max(nextCount, 0) })}
          </Button>
        </div>
      )}
      <PaymentFilters
        values={values}
        options={data?.filters}
        setFilter={setFilter}
        totalCount={isPlaceholderData ? undefined : data?.meta.total_count}
        onClearAll={clearEverything}
        canClear={active}
        searchReset={searchReset}
        statusLocked={refundMode}
      />
      <FilterChips
        values={values}
        options={data?.filters}
        onRemove={(key) => setFilter(key, key === 'status' ? 'all' : key === 'q' ? '' : undefined)}
        onClearAll={clearEverything}
        hideStatus={refundMode}
      />
      {isPending && <QueryLoading />}
      {isError && !data && <QueryError onRetry={() => void refetch()} />}
      {data && (
        // While new filters load, the previous results stay on screen, dimmed and marked busy.
        <div
          aria-busy={isPlaceholderData}
          className={`space-y-4 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}
        >
          <ProgressLine summary={data.meta.summary} />
          {refundMode && selection.isFull && (
            <p id={capNoteId} className="text-sm font-semibold text-starText">
              {t('staff.payments.capReached', { limit })}
            </p>
          )}
          {data.payments.length === 0 ? (
            <p className="rounded-lg bg-white p-4 text-navy">
              {data.filters.races.length === 0
                ? t('staff.payments.noRaces')
                : raceNotFound(values, data.filters)
                  ? t('staff.payments.raceNotFound')
                  : t('staff.payments.empty')}
            </p>
          ) : (
            <PaymentsTable
              payments={data.payments}
              refund={
                refundMode
                  ? {
                      selected: selection.selected,
                      onToggle: selection.toggle,
                      isFull: selection.isFull,
                      stale: isPlaceholderData,
                      capNoteId,
                    }
                  : undefined
              }
            />
          )}
          <Pagination
            labels={{
              nav: t('staff.payments.pagination'),
              prev: t('staff.payments.prev'),
              next: t('staff.payments.next'),
              page: (page, total) => t('staff.payments.page', { page, total }),
            }}
            page={data.meta.page}
            totalPages={data.meta.total_pages}
            onPage={(page) => {
              setFilter('page', page);
              window.scrollTo({ top: 0 });
            }}
          />
        </div>
      )}
      {refundMode && (
        <RefundBar
          count={selectedRows.length}
          limit={limit}
          totalCents={totalCents}
          onReview={() => setReviewing(selectedRows)}
        />
      )}
      {batchId !== null && <BatchResults batchId={batchId} onBatchChange={setBatchId} onFinished={finished} />}
      {reviewing && (
        <ConfirmRefundDialog
          snapshot={reviewing}
          current={selection.selected}
          latestRows={data?.payments ?? []}
          onConfirmed={confirmed}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}
