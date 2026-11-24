import { useCallback, useEffect, useState } from 'react';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { t } from '@/locales/en';
import { usePayments } from '../api/use-payments';
import { usePaymentFilters } from '../use-payment-filters';
import { hasActiveFilters, raceNotFound } from '../utils';
import { FilterChips } from './filter-chips';
import { Pagination } from './pagination';
import { PaymentFilters } from './payment-filters';
import { PaymentsTable } from './payments-table';
import { ProgressLine } from './progress-line';

export function PaymentsPage() {
  const { values, setFilter, clearAll } = usePaymentFilters();
  const { data, isPending, isError, isPlaceholderData, refetch } = usePayments(values);
  const active = hasActiveFilters(values);
  // Bumped by Clear all so the search box starts over, dropping text still waiting on its debounce.
  const [searchReset, setSearchReset] = useState(0);
  const clearEverything = useCallback(() => {
    clearAll();
    setSearchReset((n) => n + 1);
  }, [clearAll]);

  // A stale link or a shrunken result can ask for a page past the end: go to the last page instead.
  const lastPage = data?.meta.total_pages ?? 0;
  const pastEnd = !!data && !isPlaceholderData && lastPage > 0 && data.meta.page > lastPage;
  useEffect(() => {
    if (pastEnd) setFilter('page', lastPage);
  }, [pastEnd, lastPage, setFilter]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{t('staff.payments.heading')}</h1>
      <PaymentFilters
        values={values}
        options={data?.filters}
        setFilter={setFilter}
        totalCount={isPlaceholderData ? undefined : data?.meta.total_count}
        onClearAll={clearEverything}
        canClear={active}
        searchReset={searchReset}
      />
      <FilterChips
        values={values}
        options={data?.filters}
        onRemove={(key) => setFilter(key, key === 'status' ? 'all' : key === 'q' ? '' : undefined)}
        onClearAll={clearEverything}
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
          {data.payments.length === 0 ? (
            <p className="rounded-lg bg-white p-4 text-navy">
              {data.filters.races.length === 0
                ? t('staff.payments.noRaces')
                : raceNotFound(values, data.filters)
                  ? t('staff.payments.raceNotFound')
                  : t('staff.payments.empty')}
            </p>
          ) : (
            <PaymentsTable payments={data.payments} />
          )}
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.total_pages}
            onPage={(page) => setFilter('page', page)}
          />
        </div>
      )}
    </div>
  );
}
