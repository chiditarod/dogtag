import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { emptyPayments } from '../test-fixtures';
import type { PaymentFilterValues } from '../types';
import { usePayments } from './use-payments';

async function requestedParams(values: PaymentFilterValues) {
  let url: URL | undefined;
  server.use(
    http.get('/api/v1/staff/payments', ({ request }) => {
      url = new URL(request.url);
      return HttpResponse.json(emptyPayments);
    }),
  );
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => usePayments(values), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return Object.fromEntries(url!.searchParams);
}

describe('usePayments', () => {
  it('sends the filters as query params', async () => {
    expect(
      await requestedParams({ raceId: 4, paymentType: 9, status: 'paid', q: 'ada', page: 2 }),
    ).toEqual({ race_id: '4', payment_type: '9', status: 'paid', q: 'ada', page: '2' });
  });

  it('omits params that are not set', async () => {
    expect(await requestedParams({ status: 'all', q: '', page: 1 })).toEqual({ page: '1' });
  });
});
