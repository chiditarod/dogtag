import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { BrowseStatus, PaymentFilterValues } from './types';

/** Any other status in the URL (refunding, not_refundable, junk) falls back to all, so no chip mislabels it. */
const STATUSES: BrowseStatus[] = ['paid', 'refunded'];

function positiveInt(value: string | null): number | undefined {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : undefined;
}

type Key = keyof PaymentFilterValues;

/** The page's filters live in the URL query, so a reload or a shared link keeps them. */
export function usePaymentFilters() {
  const [params, setSearchParams] = useSearchParams();
  // useSearchParams hands back a new setter whenever the URL changes. Read it through a ref so setFilter and
  // clearAll keep one identity, and a filter click does not restart the search box's debounce.
  const setParamsRef = useRef(setSearchParams);
  setParamsRef.current = setSearchParams;

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
      setParamsRef.current(
        (previous) => {
          const next = new URLSearchParams(previous);
          const names: Record<Key, string> = {
            raceId: 'race_id',
            paymentType: 'payment_type',
            status: 'status',
            q: 'q',
            page: 'page',
          };
          const empty = value === undefined || value === '' || (key === 'status' && value === 'all');
          if (empty || (key === 'page' && value === 1)) next.delete(names[key]);
          else next.set(names[key], String(value));
          if (key !== 'page') next.delete('page');
          if (key === 'raceId') next.delete('payment_type');
          return next;
        },
        { replace: true },
      );
    },
    [],
  );

  /** Drops every filter except the race. */
  const clearAll = useCallback(() => {
    setParamsRef.current(
      (previous) => {
        const next = new URLSearchParams();
        const race = previous.get('race_id');
        if (race) next.set('race_id', race);
        return next;
      },
      { replace: true },
    );
  }, []);

  return { values, setFilter, clearAll };
}
