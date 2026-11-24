import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { PaymentFilterValues, PaymentsResponse } from '../types';

export const paymentsQueryKey = (values: PaymentFilterValues) =>
  ['staff', 'payments', values] as const;

/** Only filters that are set go on the URL; the server defaults the rest. */
export function paymentsPath(values: PaymentFilterValues): string {
  const params = new URLSearchParams();
  if (values.raceId !== undefined) params.set('race_id', String(values.raceId));
  if (values.paymentType !== undefined) params.set('payment_type', String(values.paymentType));
  if (values.status !== 'all') params.set('status', values.status);
  if (values.q) params.set('q', values.q);
  params.set('page', String(values.page));
  return `/staff/payments?${params.toString()}`;
}

export function usePayments(values: PaymentFilterValues) {
  return useQuery({
    queryKey: paymentsQueryKey(values),
    queryFn: () => apiFetch<PaymentsResponse>(paymentsPath(values)),
    placeholderData: keepPreviousData,
  });
}
