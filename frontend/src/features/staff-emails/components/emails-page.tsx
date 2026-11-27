import { useEffect } from 'react';
import { FilterChips } from '@/components/list/filter-chips';
import { Pagination } from '@/components/list/pagination';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { t } from '@/locales/en';
import { useSentEmails } from '../api/use-sent-emails';
import { kindLabel } from '../kinds';
import { useEmailFilters } from '../use-email-filters';
import { EmailFilters } from './email-filters';
import { EmailsTable } from './emails-table';

type ChipKey = 'teamId' | 'status' | 'kind';

export function EmailsPage() {
  const { values, setFilter, clearAll } = useEmailFilters();
  const { data, isPending, isError, isPlaceholderData, refetch } = useSentEmails(values);

  // A stale link or a shrunken result can ask for a page past the end: go to the last page instead.
  const lastPage = data?.meta.total_pages ?? 0;
  const pastEnd = !!data && !isPlaceholderData && lastPage > 0 && data.meta.page > lastPage;
  useEffect(() => {
    if (pastEnd) setFilter('page', lastPage);
  }, [pastEnd, lastPage, setFilter]);

  const count = isPlaceholderData ? undefined : data?.meta.total_count;
  const range = (page: number) => {
    const { per_page, total_count } = data!.meta;
    return t('staff.emails.range', {
      from: ((page - 1) * per_page + 1).toLocaleString(),
      to: Math.min(page * per_page, total_count).toLocaleString(),
      total: total_count.toLocaleString(),
    });
  };

  const chips: { key: ChipKey; label: string }[] = [];
  if (values.teamId !== undefined) {
    const name = data?.filters.team?.name ?? `#${values.teamId}`;
    chips.push({ key: 'teamId', label: t('staff.emails.filters.teamChip', { name }) });
  }
  if (values.status !== 'any') {
    chips.push({
      key: 'status',
      label: t('staff.emails.filters.statusChip', { status: t(`staff.emails.filters.${values.status}`) }),
    });
  }
  if (values.kind) chips.push({ key: 'kind', label: t('staff.emails.filters.kindChip', { kind: kindLabel(values.kind) }) });
  const canClear = chips.length > 0 || values.recipient !== '';

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{t('staff.emails.heading')}</h1>
      <EmailFilters
        values={values}
        kinds={data?.filters.kinds ?? []}
        setFilter={setFilter}
        countMessage={count === undefined ? undefined : t(`staff.emails.count_${count === 1 ? 'one' : 'other'}`, { n: count.toLocaleString() })}
        canClear={canClear}
        onClearAll={clearAll}
      />
      <FilterChips
        chips={chips}
        onRemove={(key) => setFilter(key as ChipKey, undefined as never)}
        onClearAll={clearAll}
        label={t('staff.emails.filters.active')}
        removeLabel={(label) => t('staff.emails.filters.remove', { label })}
        clearAllLabel={t('staff.emails.filters.clearAll')}
      />
      {isPending && <QueryLoading />}
      {isError && !data && <QueryError onRetry={() => void refetch()} />}
      {data && (
        // While new filters load, the previous results stay on screen, dimmed and marked busy.
        <div aria-busy={isPlaceholderData} className={`space-y-4 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {/* Keyed on the total, not the rows: a stale page past the end has no rows but is not "no emails". */}
          {data.meta.total_count === 0 ? (
            <p className="rounded-lg bg-white p-4 text-navy">{t('staff.emails.empty')}</p>
          ) : (
            data.sent_emails.length > 0 && <EmailsTable emails={data.sent_emails} />
          )}
          <Pagination
            labels={{
              nav: t('staff.emails.pagination'),
              prev: t('staff.emails.prev'),
              next: t('staff.emails.next'),
              page: (page) => range(page),
            }}
            page={data.meta.page}
            totalPages={data.meta.total_pages}
            onPage={(page) => {
              setFilter('page', page);
              window.scrollTo({ top: 0 });
            }}
          />
          <p className="text-sm text-navy/70">{t('staff.emails.caption')}</p>
        </div>
      )}
    </div>
  );
}
