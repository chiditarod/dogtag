import { useCallback, useMemo } from 'react';
import { useUrlFilters, type UrlChanges } from '@/components/list/use-url-filters';
import type { EmailFilterValues, EmailStatusFilter } from './api/types';

/** Any other status in the URL (the unused delivery statuses, junk) reads as `any`, and is never sent. */
const STATUSES: EmailStatusFilter[] = ['sent', 'queued', 'failed'];

function positiveInt(value: string | null): number | undefined {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : undefined;
}

type Key = keyof EmailFilterValues;

const NAMES: Record<Key, string> = {
  teamId: 'team_id',
  status: 'status',
  kind: 'kind',
  recipient: 'recipient',
  page: 'page',
};

/** The page's filters live in the URL query, so a reload or a shared link (e.g. from a team page) keeps them. */
export function useEmailFilters() {
  const { params, setParams, clearParams } = useUrlFilters();

  const values = useMemo<EmailFilterValues>(() => {
    const status = params.get('status');
    return {
      teamId: positiveInt(params.get('team_id')),
      status: STATUSES.includes(status as EmailStatusFilter) ? (status as EmailStatusFilter) : 'any',
      kind: params.get('kind') || undefined,
      recipient: params.get('recipient') ?? '',
      page: positiveInt(params.get('page')) ?? 1,
    };
  }, [params]);

  /** A change to anything but `page` returns to page 1 (`setParams` drops `page`). */
  const setFilter = useCallback(
    <K extends Key>(key: K, value: EmailFilterValues[K]) => {
      const empty = value === undefined || value === '' || (key === 'status' && value === 'any') || (key === 'page' && value === 1);
      const changes: UrlChanges = { [NAMES[key]]: empty ? undefined : String(value) };
      setParams(changes);
    },
    [setParams],
  );

  const clearAll = useCallback(() => clearParams([]), [clearParams]);

  return { values, setFilter, clearAll };
}
