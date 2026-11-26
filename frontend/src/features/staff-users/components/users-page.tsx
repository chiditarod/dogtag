import { useEffect } from 'react';
import { Pagination } from '@/components/list/pagination';
import { ResultCount } from '@/components/list/result-count';
import { SearchBox } from '@/components/list/search-box';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { t } from '@/locales/en';
import { useStaffUsers } from '../api/use-staff-users';
import { useUserFilters } from '../use-user-filters';
import { UsersTable } from './users-table';

export function UsersPage() {
  const { values, setFilter } = useUserFilters();
  const { data, isPending, isError, isPlaceholderData, refetch } = useStaffUsers(values);

  // A stale link or a shrunken result can ask for a page past the end: go to the last page instead.
  const lastPage = data?.meta.total_pages ?? 0;
  const pastEnd = !!data && !isPlaceholderData && lastPage > 0 && data.meta.page > lastPage;
  useEffect(() => {
    if (pastEnd) setFilter('page', lastPage);
  }, [pastEnd, lastPage, setFilter]);

  const count = isPlaceholderData ? undefined : data?.meta.total_count;
  const range = (page: number) => {
    const { per_page, total_count } = data!.meta;
    const from = (page - 1) * per_page + 1;
    const to = Math.min(page * per_page, total_count);
    return t('staff.users.range', {
      from: from.toLocaleString(),
      to: to.toLocaleString(),
      total: total_count.toLocaleString(),
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{t('staff.users.heading')}</h1>
      <ResultCount
        message={count === undefined ? undefined : t(`staff.users.count_${count === 1 ? 'one' : 'other'}`, { n: count.toLocaleString() })}
      />
      <SearchBox
        value={values.q}
        onSearch={(q) => setFilter('q', q)}
        label={t('staff.users.search')}
        placeholder={t('staff.users.search')}
        className="sm:max-w-sm"
      />
      {isPending && <QueryLoading />}
      {isError && !data && <QueryError onRetry={() => void refetch()} />}
      {data && (
        // While a new search loads, the previous results stay on screen, dimmed and marked busy.
        <div aria-busy={isPlaceholderData} className={`space-y-4 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {data.users.length === 0 ? (
            <p className="rounded-lg bg-white p-4 text-navy">{t('staff.users.empty')}</p>
          ) : (
            <UsersTable users={data.users} />
          )}
          <Pagination
            labels={{
              nav: t('staff.users.pagination'),
              prev: t('staff.users.prev'),
              next: t('staff.users.next'),
              page: (page) => range(page),
            }}
            page={data.meta.page}
            totalPages={data.meta.total_pages}
            onPage={(page) => {
              setFilter('page', page);
              window.scrollTo({ top: 0 });
            }}
          />
          <p className="text-sm text-navy/70">{t('staff.users.caption')}</p>
        </div>
      )}
    </div>
  );
}
