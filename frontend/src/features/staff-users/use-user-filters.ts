import { useCallback, useMemo } from 'react';
import { useUrlFilters } from '@/components/list/use-url-filters';
import type { UserFilterValues } from './api/types';

function positiveInt(value: string | null): number | undefined {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : undefined;
}

/** The users list's search and page live in the URL query, so a reload or a shared link keeps them. */
export function useUserFilters() {
  const { params, setParams, clearParams } = useUrlFilters();

  const values = useMemo<UserFilterValues>(
    () => ({ q: params.get('q') ?? '', page: positiveInt(params.get('page')) ?? 1 }),
    [params],
  );

  /** A new search starts at page 1 (`setParams` drops `page` on any other change). */
  const setFilter = useCallback(
    <K extends keyof UserFilterValues>(key: K, value: UserFilterValues[K]) => {
      const empty = value === '' || (key === 'page' && value === 1);
      setParams({ [key]: empty ? undefined : String(value) });
    },
    [setParams],
  );

  const clearAll = useCallback(() => clearParams([]), [clearParams]);

  return { values, setFilter, clearAll };
}
