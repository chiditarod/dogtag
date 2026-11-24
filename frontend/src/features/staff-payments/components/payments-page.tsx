import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { t } from '@/locales/en';
import { usePayments } from '../api/use-payments';
import { usePaymentFilters } from '../use-payment-filters';
import { hasActiveFilters } from '../utils';
import { FilterChips } from './filter-chips';
import { Pagination } from './pagination';
import { PaymentFilters } from './payment-filters';
import { PaymentsTable } from './payments-table';
import { ProgressLine } from './progress-line';

export function PaymentsPage() {
  const { values, setFilter, clearAll } = usePaymentFilters();
  const { data, isPending, isError, refetch } = usePayments(values);
  const active = hasActiveFilters(values);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{t('staff.payments.heading')}</h1>
      <PaymentFilters
        values={values}
        options={data?.filters}
        setFilter={setFilter}
        totalCount={data?.meta.total_count}
        onClearAll={clearAll}
        canClear={active}
      />
      <FilterChips
        values={values}
        options={data?.filters}
        onRemove={(key) => setFilter(key, key === 'status' ? 'all' : key === 'q' ? '' : undefined)}
        onClearAll={clearAll}
      />
      {isPending && <QueryLoading />}
      {isError && !data && <QueryError onRetry={() => void refetch()} />}
      {data && (
        <>
          <ProgressLine summary={data.meta.summary} />
          {data.payments.length === 0 ? (
            <p className="rounded-lg bg-white p-4 text-navy">
              {data.filters.races.length === 0 ? t('staff.payments.noRaces') : t('staff.payments.empty')}
            </p>
          ) : (
            <PaymentsTable payments={data.payments} />
          )}
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.total_pages}
            onPage={(page) => setFilter('page', page)}
          />
        </>
      )}
    </div>
  );
}
