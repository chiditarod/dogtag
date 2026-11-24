import { useCallback, useMemo } from 'react';
import { useUrlFilters, type UrlChanges } from '@/components/list/use-url-filters';
import type { BrowseStatus, PaymentFilterValues } from './types';

/** Any other status in the URL (refunding, not_refundable, junk) falls back to all, so no chip mislabels it. */
const STATUSES: BrowseStatus[] = ['paid', 'refunded'];

function positiveInt(value: string | null): number | undefined {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : undefined;
}

type Key = keyof PaymentFilterValues;

const NAMES: Record<Key, string> = {
  raceId: 'race_id',
  paymentType: 'payment_type',
  status: 'status',
  q: 'q',
  page: 'page',
};

/** The page's filters live in the URL query, so a reload or a shared link keeps them. */
export function usePaymentFilters() {
  const { params, setParams, clearParams } = useUrlFilters();

  const values = useMemo<PaymentFilterValues>(() => {
    const race = params.get('race_id');
    const status = params.get('status');
    return {
      raceId: race === 'all' ? 'all' : positiveInt(race),
      paymentType: positiveInt(params.get('payment_type')),
      status: STATUSES.includes(status as BrowseStatus) ? (status as BrowseStatus) : 'all',
      q: params.get('q') ?? '',
      page: positiveInt(params.get('page')) ?? 1,
    };
  }, [params]);

  const setFilter = useCallback(
    <K extends Key>(key: K, value: PaymentFilterValues[K]) => {
      const empty = value === undefined || value === '' || (key === 'status' && value === 'all');
      const changes: UrlChanges = {
        [NAMES[key]]: empty || (key === 'page' && value === 1) ? undefined : String(value),
      };
      // Another race has other payment types.
      if (key === 'raceId') changes.payment_type = undefined;
      setParams(changes);
    },
    [setParams],
  );

  /** Drops every filter except the race (and the status, when `keepStatus`: Refund mode locks it). */
  const clearAll = useCallback(
    (keepStatus = false) => clearParams(keepStatus ? ['race_id', 'status'] : ['race_id']),
    [clearParams],
  );

  return { values, setFilter, clearAll };
}
