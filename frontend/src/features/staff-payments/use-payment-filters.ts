import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PaymentFilterValues, PaymentStatus } from './types';

const STATUSES: PaymentStatus[] = ['paid', 'refunding', 'refunded', 'not_refundable'];

function positiveInt(value: string | null): number | undefined {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : undefined;
}

type Key = keyof PaymentFilterValues;

/** The page's filters live in the URL query, so a reload or a shared link keeps them. */
export function usePaymentFilters() {
  const [params, setParams] = useSearchParams();

  const values = useMemo<PaymentFilterValues>(() => {
    const race = params.get('race_id');
    const status = params.get('status');
    return {
      raceId: race === 'all' ? 'all' : positiveInt(race),
      paymentType: positiveInt(params.get('payment_type')),
      status: STATUSES.includes(status as PaymentStatus) ? (status as PaymentStatus) : 'all',
      q: params.get('q') ?? '',
      page: positiveInt(params.get('page')) ?? 1,
    };
  }, [params]);

  const setFilter = useCallback(
    <K extends Key>(key: K, value: PaymentFilterValues[K]) => {
      setParams(
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
    [setParams],
  );

  /** Drops every filter except the race. */
  const clearAll = useCallback(() => {
    setParams(
      (previous) => {
        const next = new URLSearchParams();
        const race = previous.get('race_id');
        if (race) next.set('race_id', race);
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  return { values, setFilter, clearAll };
}
